// Ehtimoliy signallar tahlili. DIQQAT: bu AI ishlatilganining isboti EMAS — faqat statistik belgilar.
// Natija o‘quvchini ayblash uchun emas, ustoz qo‘shimcha e’tibor berishi uchun.

export const LEVEL = { NONE: 'none', REVIEW: 'review', POSSIBLE: 'possible', NODATA: 'nodata' };
const LEVEL_RANK = { nodata: -1, none: 0, review: 1, possible: 2 };
export const levelFor = (score) => (score >= 55 ? LEVEL.POSSIBLE : score >= 25 ? LEVEL.REVIEW : LEVEL.NONE);

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// attempt.timing: { times:[sek], choices:[idx|null], correct:[0|1], events:[{t,type,q}], leaves, away_sec, copies }
export function analyzeAttempt(a) {
  const tm = a?.timing;
  if (!tm || !Array.isArray(tm.times) || tm.times.length < 5) return { level: LEVEL.NODATA, score: 0, signals: [] };

  const n = tm.times.length;
  const choices = Array.isArray(tm.choices) ? tm.choices : [];
  const correct = Array.isArray(tm.correct) ? tm.correct : [];
  const answered = tm.times.map((x, i) => ({ t: Number(x) || 0, c: choices[i] ?? null, ok: correct[i] === 1, i })).filter((x) => x.c !== null);
  const signals = [];
  const add = (id, points, params = {}) => { if (points > 0) signals.push({ id, points: Math.round(points), params }); };

  if (answered.length >= 5) {
    const times = answered.map((x) => x.t);
    const med = median(times);
    const quick = times.filter((x) => x < 2).length;
    const share = quick / times.length;

    // 1) Juda tez javoblar (o‘qishga ham yetmaydigan vaqt)
    if (times.length >= 8 && share >= 0.5) add('fast', Math.min(30, 12 + share * 24), { n: quick, total: times.length });

    // 2) Javob vaqtlari orasidagi keskin farq: bir nechta juda tez javob va uzoq pauzalar
    const pauseLimit = Math.max(40, med * 5);
    const pauses = times.filter((x) => x > pauseLimit).length;
    if (pauses >= 2 && quick >= 3) add('contrast', Math.min(25, 8 + pauses * 5), { pauses, quick });
    else {
      const mean = times.reduce((s, x) => s + x, 0) / times.length;
      const sd = Math.sqrt(times.reduce((s, x) => s + (x - mean) ** 2, 0) / times.length);
      if (mean > 0 && sd / mean > 1.6 && times.length >= 8) add('variance', 8, { cv: Math.round((sd / mean) * 10) / 10 });
    }

    // 3) Bir xil javoblarning noodatiy takrorlanishi
    const counts = {};
    answered.forEach((x) => { counts[x.c] = (counts[x.c] || 0) + 1; });
    const top = Math.max(...Object.values(counts));
    let run = 1; let best = 1;
    for (let k = 1; k < answered.length; k += 1) {
      run = answered[k].c === answered[k - 1].c ? run + 1 : 1;
      best = Math.max(best, run);
    }
    if (answered.length >= 10 && (top / answered.length >= 0.8 || best >= Math.max(6, answered.length * 0.6))) {
      add('repeat', 15, { share: Math.round((top / answered.length) * 100), run: best });
    }
  }

  // 4) Test paytida sahifadan chiqib ketish va qaytish
  const leaves = Number(tm.leaves) || 0;
  const awaySec = Number(tm.away_sec) || 0;
  if (leaves >= 1) {
    let pts = Math.min(30, 8 + 6 * (leaves - 1));
    if (awaySec >= 60) pts = Math.min(30, pts + 5);
    add('leaves', pts, { n: leaves, sec: awaySec });
  }
  // Qaytgandan so‘ng darhol to‘g‘ri javob berish
  const events = Array.isArray(tm.events) ? tm.events : [];
  const returns = events.filter((e) => e.type === 'show' || e.type === 'focus');
  let quickAfter = 0;
  returns.forEach((e) => { const q = answered.find((x) => x.i === e.q); if (q && q.ok && q.t < 4) quickAfter += 1; });
  if (quickAfter >= 2) add('return_fast', Math.min(15, quickAfter * 5), { n: quickAfter });

  // 5) Savol matnidan nusxa olish
  const copies = Number(tm.copies) || 0;
  if (copies >= 1) add('copy', Math.min(25, 12 + (copies - 1) * 4), { n: copies });

  // 6) Mukammal natija juda qisqa vaqtda
  const allowed = n * 40;
  if (a.total && a.score === a.total && Number(a.duration_sec) > 0 && a.duration_sec < allowed * 0.25 && n >= 10) {
    add('perfect_fast', 10, { sec: a.duration_sec });
  }

  signals.sort((x, y) => y.points - x.points);
  const score = Math.min(100, signals.reduce((s, x) => s + x.points, 0));
  return { level: levelFor(score), score, signals };
}

// O‘quvchi darajasi: eng yuqori 2 ta urinish o‘rtachasi (bitta tasodifiy hodisa "ehtimol" darajasiga olib chiqmaydi)
export function analyzeStudent(attempts) {
  const items = attempts.map((attempt) => ({ attempt, res: analyzeAttempt(attempt) }));
  const real = items.filter((x) => x.res.level !== LEVEL.NODATA);
  if (!real.length) return { items, analyzed: 0, score: 0, level: LEVEL.NODATA, flagged: 0, signals: [] };
  const top = real.map((x) => x.res.score).sort((a, b) => b - a).slice(0, 2);
  const score = Math.round(top.reduce((s, x) => s + x, 0) / top.length);
  const ids = {};
  real.forEach((x) => x.res.signals.forEach((s) => { ids[s.id] = (ids[s.id] || 0) + 1; }));
  const signals = Object.entries(ids).sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count }));
  return {
    items, analyzed: real.length, score, level: levelFor(score),
    flagged: real.filter((x) => LEVEL_RANK[x.res.level] >= 1).length, signals,
  };
}
