import { supabase, isSupabase } from '../lib/supabase.js';

// O‘quvchi faolligini yozib borish: kirish, heartbeat (onlayn holat), test sessiyalari, har bir savolga javob.
// Hammasi "best-effort": xato bo‘lsa ham o‘quvchining testi va asosiy funksiyalari to‘xtamaydi.

export const BEAT_MS = 30000;
export const ONLINE_WINDOW_MS = 150000;

const ls = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* joy yetmadi */ } },
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const SCHEMA_CODES = new Set(['PGRST204', 'PGRST205', 'PGRST202', '42703', '42P01', '42883']);

// Migratsiya (teacher_panel.sql) hali ishga tushirilmagan bo‘lsa true
export const isSchemaError = (e) =>
  !!e && (SCHEMA_CODES.has(e.code) || /schema cache|does not exist|could not find/i.test(e.message || ''));

const S = { user: null, presence: 'online', sessionId: null, timer: null, token: null, cleanup: null };
const loginKey = (id) => `xx_login_logged_${id}`;

function lsPatchProfile(userId, fn) {
  ls.set('xx_users', ls.get('xx_users', []).map((u) => (u.id === userId ? { ...u, profile: fn(u.profile || {}) } : u)));
}

async function beat(presence = S.presence) {
  if (!S.user) return;
  const nowIso = new Date().toISOString();
  if (!isSupabase) {
    lsPatchProfile(S.user.id, (p) => ({ ...p, last_seen_at: nowIso, presence }));
    if (S.sessionId) {
      const k = `xx_sessions_${S.user.id}`;
      ls.set(k, ls.get(k, []).map((x) => (x.id === S.sessionId && x.status === 'in_progress' ? { ...x, last_ping_at: nowIso } : x)));
    }
    return;
  }
  try { await supabase.rpc('heartbeat', { p_presence: presence, p_session: S.sessionId }); } catch { /* tarmoq xatosi */ }
}

async function recordLogin(user) {
  try {
    if (sessionStorage.getItem(loginKey(user.id))) return;
    sessionStorage.setItem(loginKey(user.id), '1');
  } catch { /* sessionStorage yo‘q */ }
  const nowIso = new Date().toISOString();
  if (!isSupabase) {
    lsPatchProfile(user.id, (p) => ({ ...p, login_count: (p.login_count || 0) + 1, last_login_at: nowIso, last_seen_at: nowIso, presence: 'online' }));
    const k = `xx_logins_${user.id}`;
    ls.set(k, [{ id: uid(), user_id: user.id, created_at: nowIso }, ...ls.get(k, [])]);
    return;
  }
  try { await supabase.rpc('record_login'); } catch { /* ignore */ }
}

// Sahifa yopilayotganda "offline" belgisini yuborish (keepalive fetch)
function sendOffline() {
  if (!S.user) return;
  if (!isSupabase) { lsPatchProfile(S.user.id, (p) => ({ ...p, presence: 'offline', last_seen_at: new Date().toISOString() })); return; }
  if (!S.token) return;
  try {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/heartbeat`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${S.token}` },
      body: JSON.stringify({ p_presence: 'offline', p_session: null }),
    }).catch(() => {});
  } catch { /* ignore */ }
}

export const tracking = {
  startPresence(user) {
    if (S.user?.id === user.id && S.timer) return;
    tracking.stopPresence();
    S.user = user; S.presence = 'online'; S.sessionId = null;
    recordLogin(user);
    beat();
    S.timer = setInterval(() => beat(), BEAT_MS);

    const onVis = () => { if (!document.hidden) beat(); };
    const onShow = () => beat();
    const onHide = () => sendOffline();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onShow);
    window.addEventListener('pagehide', onHide);
    let unsub = null;
    if (isSupabase) {
      supabase.auth.getSession().then(({ data }) => { S.token = data.session?.access_token || null; });
      const { data } = supabase.auth.onAuthStateChange((_e, s) => { S.token = s?.access_token || null; });
      unsub = () => data.subscription.unsubscribe();
    }
    S.cleanup = () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('pagehide', onHide);
      unsub?.();
    };
  },

  stopPresence() {
    if (S.timer) clearInterval(S.timer);
    S.cleanup?.();
    S.timer = null; S.cleanup = null; S.user = null; S.sessionId = null;
  },

  // Chiqishdan oldin: "offline" yozib, keyingi kirish yangi kirish sifatida hisoblansin
  async markOffline() {
    const user = S.user;
    if (!user) return;
    try { sessionStorage.removeItem(loginKey(user.id)); } catch { /* ignore */ }
    if (isSupabase) {
      try { await supabase.rpc('heartbeat', { p_presence: 'offline', p_session: null }); } catch { /* ignore */ }
    } else {
      lsPatchProfile(user.id, (p) => ({ ...p, presence: 'offline', last_seen_at: new Date().toISOString() }));
    }
    tracking.stopPresence();
  },

  setActivity(presence, sessionId = null) {
    S.presence = presence; S.sessionId = sessionId;
    beat();
  },

  async startTestSession(user, meta) {
    const row = { subject: meta.subject, topic: meta.topic || 'all', grade: meta.grade ?? null, total: meta.total };
    if (isSupabase) {
      const { data, error } = await supabase.from('test_sessions').insert({ user_id: user.id, ...row }).select('id').single();
      if (error) { if (!isSchemaError(error)) console.warn('test_sessions:', error.message); return null; }
      return data.id;
    }
    const id = uid();
    const now = new Date().toISOString();
    const k = `xx_sessions_${user.id}`;
    ls.set(k, [{ id, user_id: user.id, ...row, answered: 0, status: 'in_progress', started_at: now, last_ping_at: now, finished_at: null }, ...ls.get(k, [])]);
    return id;
  },

  async finishTestSession(user, id, status, patch = {}) {
    if (!id) return;
    const body = { status, ...patch };
    if (status === 'completed') body.finished_at = new Date().toISOString();
    if (isSupabase) {
      const { error } = await supabase.from('test_sessions').update(body).eq('id', id).eq('user_id', user.id);
      if (error && !isSchemaError(error)) console.warn('test_sessions:', error.message);
      return;
    }
    const k = `xx_sessions_${user.id}`;
    ls.set(k, ls.get(k, []).map((x) => (x.id === id ? { ...x, ...body } : x)));
  },

  async saveAnswers(user, attemptId, rows) {
    if (!rows?.length) return;
    const full = rows.map((r) => ({ ...r, attempt_id: attemptId, user_id: user.id }));
    if (isSupabase) {
      for (let i = 0; i < full.length; i += 200) {
        const { error } = await supabase.from('attempt_answers').insert(full.slice(i, i + 200));
        if (error) { if (!isSchemaError(error)) console.warn('attempt_answers:', error.message); return; }
      }
      return;
    }
    const k = `xx_answers_${user.id}`;
    const now = new Date().toISOString();
    ls.set(k, [...full.map((r) => ({ id: uid(), created_at: now, ...r })), ...ls.get(k, [])]);
  },
};
