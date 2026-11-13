import { supabase, isSupabase } from '../lib/supabase.js';
import { tracking, isSchemaError } from './tracking.js';

// Bitta interfeys, ikki rejim: Supabase (haqiqiy) yoki localStorage (DEMO).
const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const emit = () => window.dispatchEvent(new Event('xx-auth'));

async function sha(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`xx:${s}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const DEFAULT_PROFILE = { name: '', grade: 7, language: 'uz', goal: 'bsb', role: 'student' };
const toUser = (u) => (u ? { id: u.id, email: u.email } : null);

export const auth = {
  async getUser() {
    if (isSupabase) {
      const { data } = await supabase.auth.getSession();
      return toUser(data.session?.user);
    }
    const id = ls.get('xx_session', null);
    return toUser(ls.get('xx_users', []).find((u) => u.id === id));
  },

  onChange(cb) {
    if (isSupabase) {
      const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    }
    const h = () => auth.getUser().then(cb);
    window.addEventListener('xx-auth', h);
    return () => window.removeEventListener('xx-auth', h);
  },

  async signUp({ name, email, password, language }) {
    if (isSupabase) {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name, language }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      return { needsConfirm: !data.session };
    }
    const users = ls.get('xx_users', []);
    if (users.some((u) => u.email === email.toLowerCase())) throw new Error('User already registered');
    const user = { id: uid(), email: email.toLowerCase(), hash: await sha(password), profile: { ...DEFAULT_PROFILE, name, language, created_at: new Date().toISOString() } };
    ls.set('xx_users', [...users, user]);
    ls.set('xx_session', user.id);
    emit();
    return { needsConfirm: false };
  },

  async signIn({ email, password }) {
    if (isSupabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return;
    }
    const user = ls.get('xx_users', []).find((u) => u.email === email.toLowerCase());
    if (!user || user.hash !== (await sha(password))) throw new Error('Invalid login credentials');
    ls.set('xx_session', user.id);
    emit();
  },

  async signOut() {
    await tracking.markOffline();
    if (isSupabase) { await supabase.auth.signOut(); return; }
    localStorage.removeItem('xx_session');
    emit();
  },

  async resetPassword(email) {
    if (!isSupabase) throw new Error('demo_reset');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/update-password` });
    if (error) throw error;
  },

  async updatePassword(password) {
    if (isSupabase) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return;
    }
    const id = ls.get('xx_session', null);
    const hash = await sha(password);
    ls.set('xx_users', ls.get('xx_users', []).map((u) => (u.id === id ? { ...u, hash } : u)));
  },
};

export const db = {
  async getProfile(user) {
    if (isSupabase) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_PROFILE, ...(data || {}) };
    }
    const u = ls.get('xx_users', []).find((x) => x.id === user.id);
    return { ...DEFAULT_PROFILE, ...(u?.profile || {}) };
  },

  async updateProfile(user, patch) {
    if (isSupabase) {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...patch, updated_at: new Date().toISOString() })
        .select().single();
      if (error) throw error;
      return { ...DEFAULT_PROFILE, ...data };
    }
    const users = ls.get('xx_users', []);
    let next = null;
    ls.set('xx_users', users.map((u) => {
      if (u.id !== user.id) return u;
      next = { ...u.profile, ...patch };
      return { ...u, profile: next };
    }));
    return { ...DEFAULT_PROFILE, ...next };
  },

  // extra (ixtiyoriy): { sessionId, startedAt, durationSec, timing, answers } — ustoz paneli uchun qo‘shimcha ma’lumot.
  async saveAttempt(user, attempt, mistakes, extra = null) {
    if (isSupabase) {
      const base = { user_id: user.id, ...attempt };
      let data = null;
      let usedExtra = false;
      if (extra) {
        const r = await supabase.from('attempts').insert({
          ...base, started_at: extra.startedAt, duration_sec: extra.durationSec, session_id: extra.sessionId, timing: extra.timing,
        }).select().single();
        if (!r.error) { data = r.data; usedExtra = true; } else if (!isSchemaError(r.error)) throw r.error;
      }
      if (!data) {
        // Migratsiya hali ishga tushirilmagan bo‘lsa ham eski usulda saqlanadi — mavjud funksiya buzilmaydi
        const r = await supabase.from('attempts').insert(base).select().single();
        if (r.error) throw r.error;
        data = r.data;
      }
      if (mistakes.length) {
        const { error: e2 } = await supabase.from('mistakes')
          .insert(mistakes.map((m) => ({ ...m, user_id: user.id, attempt_id: data.id })));
        if (e2) throw e2;
      }
      if (extra && usedExtra) {
        await tracking.saveAnswers(user, data.id, extra.answers);
        await tracking.finishTestSession(user, extra.sessionId, 'completed', { answered: extra.answered, attempt_id: data.id });
      }
      return data;
    }
    const now = new Date().toISOString();
    const row = {
      id: uid(), created_at: now, ...attempt,
      ...(extra ? { started_at: extra.startedAt, duration_sec: extra.durationSec, session_id: extra.sessionId, timing: extra.timing } : {}),
    };
    ls.set(`xx_attempts_${user.id}`, [row, ...ls.get(`xx_attempts_${user.id}`, [])]);
    ls.set(`xx_mistakes_${user.id}`, [
      ...mistakes.map((m) => ({ id: uid(), attempt_id: row.id, created_at: now, ...m })),
      ...ls.get(`xx_mistakes_${user.id}`, []),
    ]);
    if (extra) {
      await tracking.saveAnswers(user, row.id, extra.answers);
      await tracking.finishTestSession(user, extra.sessionId, 'completed', { answered: extra.answered, attempt_id: row.id });
    }
    return row;
  },

  async listAttempts(user) {
    if (isSupabase) {
      const { data, error } = await supabase.from('attempts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return ls.get(`xx_attempts_${user.id}`, []);
  },

  async listMistakes(user) {
    if (isSupabase) {
      const { data, error } = await supabase.from('mistakes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return ls.get(`xx_mistakes_${user.id}`, []);
  },
};

// Ustoz paneli: barcha o‘quvchilar, testlar va xatolar (Supabase'da faqat role='teacher' ko‘ra oladi — RLS).
async function fetchAll(table, columns, order = 'created_at') {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from(table).select(columns)
      .order(order, { ascending: false }).order('id').range(from, from + size - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

const PROFILE_FULL = 'id,name,email,grade,role,created_at,last_login_at,last_seen_at,login_count,presence';
const PROFILE_LEGACY = 'id,name,email,grade,role,created_at';
const ATTEMPT_FULL = 'id,user_id,subject,topic,grade,score,total,created_at,started_at,duration_sec,timing';
const ATTEMPT_LEGACY = 'id,user_id,subject,topic,grade,score,total,created_at';
const MISTAKE_COLS = 'id,user_id,attempt_id,question_id,subject,topic,question,options,user_answer,correct_answer,explanation,reason,created_at';
const ANSWER_COLS = 'id,attempt_id,user_id,position,question_id,subject,topic,question,options,user_answer,correct_answer,is_correct,time_spent_ms,created_at';

export const adminApi = {
  async loadAll() {
    if (isSupabase) {
      let missingMigration = false;
      const safe = async (table, full, legacy, order = 'created_at') => {
        try { return await fetchAll(table, full, order); } catch (e) {
          if (!isSchemaError(e)) throw e;
          missingMigration = true;
          return legacy ? fetchAll(table, legacy, order) : [];
        }
      };
      const [profiles, attempts, mistakes, sessions, logins] = await Promise.all([
        safe('profiles', PROFILE_FULL, PROFILE_LEGACY),
        safe('attempts', ATTEMPT_FULL, ATTEMPT_LEGACY),
        fetchAll('mistakes', MISTAKE_COLS),
        safe('test_sessions', 'id,user_id,subject,topic,grade,total,answered,status,started_at,last_ping_at,finished_at,attempt_id', null, 'started_at'),
        safe('login_events', 'id,user_id,created_at', null),
      ]);
      return { profiles, attempts, mistakes, sessions, logins, missingMigration };
    }
    const users = ls.get('xx_users', []);
    const per = (prefix, u) => ls.get(`${prefix}_${u.id}`, []).map((x) => ({ ...x, user_id: u.id }));
    return {
      profiles: users.map((u) => ({ id: u.id, email: u.email, ...DEFAULT_PROFILE, ...(u.profile || {}) })),
      attempts: users.flatMap((u) => per('xx_attempts', u)),
      mistakes: users.flatMap((u) => per('xx_mistakes', u)),
      sessions: users.flatMap((u) => per('xx_sessions', u)),
      logins: users.flatMap((u) => per('xx_logins', u)),
      missingMigration: false,
    };
  },

  // Bitta urinishning barcha savollari bo‘yicha javoblar
  async attemptAnswers(attemptId) {
    if (isSupabase) {
      const { data, error } = await supabase.from('attempt_answers').select(ANSWER_COLS).eq('attempt_id', attemptId).order('position');
      if (error) { if (isSchemaError(error)) return []; throw error; }
      return data;
    }
    const users = ls.get('xx_users', []);
    return users.flatMap((u) => ls.get(`xx_answers_${u.id}`, [])).filter((a) => a.attempt_id === attemptId).sort((a, b) => a.position - b.position);
  },

  // Hisobot uchun: barcha javoblar
  async allAnswers() {
    if (isSupabase) {
      try { return await fetchAll('attempt_answers', ANSWER_COLS); } catch (e) { if (isSchemaError(e)) return []; throw e; }
    }
    return ls.get('xx_users', []).flatMap((u) => ls.get(`xx_answers_${u.id}`, []));
  },

  // Bazada hisoblangan umumiy statistika (faqat ustoz chaqira oladi). Migratsiya yo‘q bo‘lsa — null.
  async questionStats() {
    if (!isSupabase) return null;
    const { data, error } = await supabase.rpc('admin_question_stats', { p_limit: 50 });
    return error ? null : data;
  },
  async topicStats() {
    if (!isSupabase) return null;
    const { data, error } = await supabase.rpc('admin_topic_stats');
    return error ? null : data;
  },

  // Real vaqt: Supabase Realtime (postgres_changes). Demo rejimda — localStorage kuzatuvi.
  subscribe(onEvent, onStatus) {
    if (!isSupabase) {
      const h = () => onEvent({ table: '*' });
      window.addEventListener('storage', h);
      onStatus('polling');
      return () => window.removeEventListener('storage', h);
    }
    const ch = supabase.channel(`teacher-live-${Math.random().toString(36).slice(2)}`);
    ['profiles', 'attempts', 'test_sessions', 'login_events'].forEach((table) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => onEvent({ table, payload }));
    });
    ch.subscribe((status) => onStatus(status));
    return () => { supabase.removeChannel(ch); };
  },
};
