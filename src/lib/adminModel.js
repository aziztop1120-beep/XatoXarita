import { normSubject } from './questions.js';

// Ustoz paneli uchun ma'lumot modeli: bazadan kelgan xom ma'lumotlardan statistikalar hisoblanadi.
export const ONLINE_MS = 150000; // oxirgi heartbeat shu vaqtdan eski bo'lsa — "saytda emas"
export const RECENT_FINISH_MS = 15 * 60000;
const DAY = 86400000;
const ms = (d) => (d ? new Date(d).getTime() || 0 : 0);
const groupBy = (arr, key) => arr.reduce((m, x) => { (m[x[key]] ||= []).push(x); return m; }, {});
const iso = (n) => (n ? new Date(n).toISOString() : null);

export const pctOf = (score, total) => (total ? Math.round((score / total) * 100) : null);
export const topicKey = (subject, topic) => `${normSubject(subject)}|${topic}`;

// 'running' (hozir ishlayapti) | 'abandoned' (tugatilmagan) | 'completed'
export function sessionState(se, now) {
  if (se.status === 'completed') return 'completed';
  if (se.status === 'abandoned') return 'abandoned';
  return now - ms(se.last_ping_at || se.started_at) < ONLINE_MS ? 'running' : 'abandoned';
}

export function buildModel(raw, now) {
  const profiles = raw.profiles.filter((p) => p.role !== 'teacher');
  const ids = new Set(profiles.map((p) => p.id));
  const byDesc = (key) => (a, b) => ms(b[key]) - ms(a[key]);
  const attempts = raw.attempts.filter((a) => ids.has(a.user_id)).sort(byDesc('created_at'));
  const mistakes = raw.mistakes.filter((m) => ids.has(m.user_id));
  const sessions = (raw.sessions || []).filter((s) => ids.has(s.user_id)).sort(byDesc('started_at'));
  const logins = (raw.logins || []).filter((l) => ids.has(l.user_id));

  const A = groupBy(attempts, 'user_id');
  const S = groupBy(sessions, 'user_id');
  const M = groupBy(mistakes, 'user_id');

  const students = profiles.map((p) => {
    const at = A[p.id] || [];
    const se = (S[p.id] || []).map((x) => ({ ...x, state: sessionState(x, now) }));
    const score = at.reduce((s, a) => s + a.score, 0);
    const total = at.reduce((s, a) => s + a.total, 0);
    const seen = ms(p.last_seen_at);
    const online = !!p.presence && p.presence !== 'offline' && now - seen < ONLINE_MS;
    const running = se.find((x) => x.state === 'running') || null;
    const unfinished = se.filter((x) => x.state !== 'completed');
    const lastActivity = Math.max(seen, ms(p.last_login_at), ms(at[0]?.created_at), ...se.map((x) => ms(x.last_ping_at)));
    const status = running && online ? 'in_progress' : at.length ? 'completed' : unfinished.length ? 'unfinished' : 'not_started';
    return {
      ...p, attempts: at, sessions: se, unfinished, running,
      tests: at.length, scoreSum: score, totalSum: total, pct: pctOf(score, total), wrong: total - score,
      mistakeRows: (M[p.id] || []).length,
      online, inTest: online && p.presence === 'in_test' && !!running,
      entered: online || (p.login_count || 0) > 0 || !!p.last_login_at || at.length > 0 || se.length > 0,
      lastActivity: lastActivity ? iso(lastActivity) : null,
      lastTest: at[0] || null, status,
    };
  });
  const byId = Object.fromEntries(students.map((s) => [s.id, s]));

  const scoreAll = attempts.reduce((s, a) => s + a.score, 0);
  const totalAll = attempts.reduce((s, a) => s + a.total, 0);
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const completed = students.filter((s) => s.tests > 0).length;
  const kpi = {
    registered: students.length,
    online: students.filter((s) => s.online).length,
    entered: students.filter((s) => s.entered).length,
    completed,
    notCompleted: students.length - completed,
    tests: attempts.length,
    avgPct: pctOf(scoreAll, totalAll),
    wrong: totalAll - scoreAll,
    today: new Set(attempts.filter((a) => ms(a.created_at) >= dayStart.getTime()).map((a) => a.user_id)).size,
  };

  // Oxirgi 14 kun: testlar, kirishlar
  const days = [];
  for (let i = 13; i >= 0; i -= 1) {
    const from = dayStart.getTime() - i * DAY; const to = from + DAY;
    const at = attempts.filter((a) => ms(a.created_at) >= from && ms(a.created_at) < to);
    const d = new Date(from);
    days.push({
      label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      tests: at.length,
      logins: logins.filter((l) => ms(l.created_at) >= from && ms(l.created_at) < to).length,
      pct: pctOf(at.reduce((s, a) => s + a.score, 0), at.reduce((s, a) => s + a.total, 0)),
    });
  }

  // Fanlar
  const subjMap = {};
  attempts.forEach((a) => {
    const k = normSubject(a.subject);
    const o = (subjMap[k] ||= { subject: k, tests: 0, score: 0, total: 0, students: new Set() });
    o.tests += 1; o.score += a.score; o.total += a.total; o.students.add(a.user_id);
  });
  const subjects = Object.values(subjMap)
    .map((o) => ({ ...o, students: o.students.size, wrong: o.total - o.score, pct: pctOf(o.score, o.total) }))
    .sort((a, b) => b.tests - a.tests);

  // Mavzular va o'quvchi × mavzu (xato yozuvlaridan)
  const topicMap = {}; const studentTopic = {};
  mistakes.forEach((m) => {
    const k = topicKey(m.subject, m.topic);
    const o = (topicMap[k] ||= { key: k, subject: normSubject(m.subject), topic: m.topic, mistakes: 0, students: new Set() });
    o.mistakes += 1; o.students.add(m.user_id);
    const st = (studentTopic[m.user_id] ||= {});
    st[k] = (st[k] || 0) + 1;
  });
  const topics = Object.values(topicMap).map((o) => ({ ...o, students: o.students.size })).sort((a, b) => b.mistakes - a.mistakes);

  // Sinflar
  const gradeMap = {};
  students.forEach((s) => {
    const o = (gradeMap[s.grade] ||= { grade: s.grade, students: 0, active: 0, tests: 0, score: 0, total: 0, topic: {} });
    o.students += 1; if (s.tests) o.active += 1;
    o.tests += s.tests; o.score += s.scoreSum; o.total += s.totalSum;
    Object.entries(studentTopic[s.id] || {}).forEach(([k, c]) => { o.topic[k] = (o.topic[k] || 0) + c; });
  });
  const grades = Object.values(gradeMap).map((o) => {
    const top = Object.entries(o.topic).sort((a, b) => b[1] - a[1])[0];
    return { grade: o.grade, students: o.students, active: o.active, tests: o.tests, wrong: o.total - o.score, pct: pctOf(o.score, o.total), topKey: top?.[0] || null };
  }).sort((a, b) => a.grade - b.grade);

  // Tugatilmagan sessiyalar (alohida ro'yxat)
  const unfinishedSessions = sessions
    .map((x) => ({ ...x, state: sessionState(x, now), student: byId[x.user_id] }))
    .filter((x) => x.state !== 'completed');

  // Real vaqt guruhlari (har o'quvchi bittadan guruhda)
  const live = { testing: [], finished: [], online: [], left: [] };
  students.forEach((s) => {
    const lastAt = ms(s.lastTest?.created_at);
    if (s.inTest) live.testing.push(s);
    else if (lastAt && now - lastAt < RECENT_FINISH_MS && (s.online || now - ms(s.lastActivity) < DAY)) live.finished.push(s);
    else if (s.online) live.online.push(s);
    else if (s.lastActivity && now - ms(s.lastActivity) < DAY) live.left.push(s);
  });
  const rec = (a, b) => ms(b.lastActivity) - ms(a.lastActivity);
  Object.values(live).forEach((l) => l.sort(rec));

  return { students, byId, attempts, mistakes, sessions, logins, kpi, days, subjects, topics, studentTopic, grades, unfinishedSessions, live, recent: attempts.slice(0, 10) };
}
