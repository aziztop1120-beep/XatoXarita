import { useEffect, useRef, useState } from 'react';
import { Timer, ChevronLeft } from 'lucide-react';
import { useLang } from '../i18n/LangContext.jsx';
import { subjectName, topicName } from '../lib/stats.js';
import { useAuth } from '../context/AuthContext.jsx';
import { tracking } from '../services/tracking.js';
import ResultView from './ResultView.jsx';

// Butun test uchun beriladigan umumiy vaqt: 20 daqiqa (30 ta savol)
// Har bir savolga 40 soniya: 30 ta savol = 20 daqiqa, 5 ta mashq = 3:20
export const SECONDS_PER_QUESTION = 40;
const fmt = (sec) => `${String(Math.floor(Math.max(sec, 0) / 60)).padStart(2, '0')}:${String(Math.max(sec, 0) % 60).padStart(2, '0')}`;

export default function QuizSession({ questions, meta, onRetake, onExit }) {
  const { t, lang } = useLang();
   const total = questions.length;
  const totalSeconds = total * SECONDS_PER_QUESTION;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState(() => Array(total).fill(null));
  const [left, setLeft] = useState(totalSeconds);
  const [done, setDone] = useState(false);
  const [snap, setSnap] = useState(null);
  const { user, profile } = useAuth();

  // Ustoz paneli uchun: har bir savolga sarflangan vaqt, sahifadan chiqish/qaytish va nusxa olish hodisalari
  const sessionRef = useRef(null);
  const tr = useRef({ times: Array(total).fill(0), cur: 0, qStart: Date.now(), t0: Date.now(), events: [], leaves: 0, copies: 0, away: false, awayAt: 0, awayMs: 0 });

  useEffect(() => {
    if (sessionRef.current) return undefined; // StrictMode: ikkinchi marta yaratilmasin
    const promise = tracking.startTestSession(user, { subject: meta.subject, topic: meta.topic, grade: meta.grade || profile.grade, total })
      .catch(() => null);
    sessionRef.current = { id: null, promise };
    promise.then((id) => { sessionRef.current.id = id; tracking.setActivity('in_test', id); });
    tracking.setActivity('in_test', null);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => tracking.setActivity('online', null), []);

  useEffect(() => {
    const ev = (type) => { const x = tr.current; if (x.events.length < 80) x.events.push({ t: Math.round((Date.now() - x.t0) / 1000), type, q: x.cur }); };
    const leave = (type) => { const x = tr.current; if (x.away) return; x.away = true; x.awayAt = Date.now(); x.leaves += 1; ev(type); };
    const back = (type) => { const x = tr.current; if (!x.away) return; x.away = false; x.awayMs += Date.now() - x.awayAt; ev(type); };
    const onVis = () => (document.hidden ? leave('hide') : back('show'));
    const onBlur = () => leave('blur');
    const onFocus = () => back('focus');
    const onCopy = () => { tr.current.copies += 1; ev('copy'); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('copy', onCopy);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('copy', onCopy);
    };
  }, []);

  function finish() {
    if (done) return;
    const x = tr.current;
    const now = Date.now();
    x.times[x.cur] += now - x.qStart; x.qStart = now;
    const awayMs = x.awayMs + (x.away ? now - x.awayAt : 0);
    setSnap({
      sessionPromise: sessionRef.current?.promise || Promise.resolve(null),
      startedAt: new Date(x.t0).toISOString(),
      durationSec: Math.round((now - x.t0) / 1000),
      times: x.times.map((ms) => Math.round(ms / 100) / 10),
      events: x.events, leaves: x.leaves, awaySec: Math.round(awayMs / 1000), copies: x.copies,
    });
    setDone(true);
  }

  function goTo(n) {
    const x = tr.current;
    const now = Date.now();
    x.times[x.cur] += now - x.qStart; x.qStart = now; x.cur = n;
    setI(n);
  }

  function exitTest() {
    tracking.finishTestSession(user, sessionRef.current?.id, 'abandoned');
    onExit();
  }

  // Umumiy taymer: savol almashganda qayta boshlanmaydi
  useEffect(() => {
    if (done) return undefined;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [done]);

  // Vaqt tugasa — test avtomatik yakunlanadi (belgilangan javoblar hisobga olinadi)
  useEffect(() => {
    if (!done && left <= 0) finish();
  }, [left, done]);

  if (done) {
    return <ResultView questions={questions} answers={answers} meta={meta} track={snap} onRetake={onRetake} onExit={onExit} />;
  }

  const q = questions[i];
  const sel = answers[i];
  const last = i + 1 >= total;
  const low = left <= 60;

  function goNext() {
    if (i + 1 >= total) finish(); else goTo(i + 1);
  }
  const choose = (idx) => setAnswers((a) => a.map((v, k) => (k === i ? idx : v)));

  return (
    <section className="card quiz">
      <div className="quiz-head">
        <span className="chip">{subjectName(meta.subject, lang)} · {topicName(q.topic, lang)}</span>
        <span className="muted">{t('q_of', { n: i + 1, total })}</span>
      </div>
      <div className="progress"><span style={{ width: `${(i / total) * 100}%` }} /></div>
      <div className="quiz-timer" role="timer" aria-live="off">
        <Timer size={16} className={low ? 'low' : ''} />
       <div className="timer-bar"><span className={low ? 'low' : ''} style={{ width: `${Math.max(left, 0) / totalSeconds * 100}%` }} /></div>
        <span className={`timer-num ${low ? 'low' : ''}`}>{fmt(left)}</span>
      </div>
      <h2 className="quiz-q">{q.q}</h2>
      <div className="options">
        {q.options.map((o, idx) => (
          <button key={idx} className={`option ${sel === idx ? 'selected' : ''}`} onClick={() => choose(idx)}>
            <span className="option-letter">{String.fromCharCode(65 + idx)}</span>{o}
          </button>
        ))}
      </div>
      <div className="quiz-foot">
        <button className="btn btn-ghost" onClick={exitTest}>{t('q_exit')}</button>
        <div className="quiz-foot-right">
          <button className="btn btn-outline" disabled={i === 0} onClick={() => goTo(i - 1)}>
            <ChevronLeft size={16} /> {t('q_prev')}
          </button>
          <button className="btn btn-primary" onClick={goNext}>{last ? t('finish') : sel === null ? t('q_skip') : t('next')}</button>
        </div>
      </div>
    </section>
  );
}