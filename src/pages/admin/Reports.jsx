import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Users, ClipboardList, ListOrdered, XCircle, BarChart3, ShieldAlert, Package } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import { adminApi } from '../../services/db.js';
import { subjectName, topicName } from '../../lib/stats.js';
import { analyzeStudent } from '../../lib/integrity.js';
import { SUBJECTS } from '../../lib/questions.js';
import { downloadCsv, downloadXlsx, stamp } from '../../lib/exportFile.js';
import { useAdminData } from './AdminData.jsx';
import { studentRows } from './Students.jsx';
import { displayName, fmtDateTime, fmtDuration, inRange, optText, testTitle } from './utils.js';

// Hisobotlar: CSV va Excel (.xlsx). Filtrlar: sana, sinf, fan.
export default function Reports() {
  const { t, lang, pick } = useLang();
  const { model: m } = useAdminData();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [grade, setGrade] = useState('all');
  const [subject, setSubject] = useState('all');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const f = useMemo(() => {
    const stOk = (s) => grade === 'all' || String(s?.grade) === grade;
    const subOk = (x) => subject === 'all' || (x.subject === subject || (subject === 'frontend' && x.subject === 'it'));
    const students = m.students.filter(stOk);
    const ids = new Set(students.map((s) => s.id));
    return {
      students,
      attempts: m.attempts.filter((a) => ids.has(a.user_id) && subOk(a) && inRange(a.created_at, from, to)),
      mistakes: m.mistakes.filter((x) => ids.has(x.user_id) && subOk(x) && inRange(x.created_at, from, to)),
      ids,
    };
  }, [m, from, to, grade, subject]);

  const S = (id) => m.byId[id];
  const head = (...k) => k.map((x) => t(x));

  const sheets = {
    students: () => ({ name: t('tp_nav_students'), rows: studentRows(f.students, t, lang) }),
    results: () => ({
      name: t('tp_nav_results'),
      rows: [
        head('tp_col_name', 'tp_col_email', 'tp_col_grade', 'tp_col_test', 'tp_col_date', 'tp_col_total', 'tp_correct', 'tp_wrong', 'tp_col_pct', 'tp_col_duration'),
        ...f.attempts.map((a) => [displayName(S(a.user_id)), S(a.user_id)?.email, S(a.user_id)?.grade, testTitle(a, lang, t), fmtDateTime(a.created_at, lang), a.total, a.score, a.total - a.score, a.total ? Math.round((a.score / a.total) * 100) : 0, fmtDuration(a.duration_sec)]),
      ],
    }),
    mistakes: () => ({
      name: t('tp_nav_errors'),
      rows: [
        head('tp_col_name', 'tp_col_grade', 'subject', 'topic', 'tp_col_question', 'tp_col_answer', 'tp_col_correct_answer', 'tp_col_date'),
        ...f.mistakes.map((x) => [displayName(S(x.user_id)), S(x.user_id)?.grade, subjectName(x.subject, lang), topicName(x.topic, lang), x.question,
          x.user_answer === null ? t('ad_noanswer') : optText(x.options, x.user_answer), optText(x.options, x.correct_answer), fmtDateTime(x.created_at, lang)]),
      ],
    }),
    topics: () => ({
      name: t('tp_rep_topics'),
      rows: [
        head('subject', 'topic', 'tp_col_wrong', 'tp_k_students_n'),
        ...Object.values(f.mistakes.reduce((acc, x) => {
          const k = `${x.subject}|${x.topic}`;
          const o = (acc[k] ||= { subject: x.subject, topic: x.topic, n: 0, who: new Set() });
          o.n += 1; o.who.add(x.user_id); return acc;
        }, {})).sort((a, b) => b.n - a.n).map((o) => [subjectName(o.subject, lang), topicName(o.topic, lang), o.n, o.who.size]),
      ],
    }),
    classes: () => ({
      name: t('tp_err_by_grade'),
      rows: [
        head('tp_col_grade', 'tp_k_students_n', 'tp_active_n', 'tp_col_tests', 'tp_col_pct', 'tp_col_wrong'),
        ...m.grades.map((g) => [g.grade, g.students, g.active, g.tests, g.pct ?? '', g.wrong]),
      ],
    }),
    integrity: () => ({
      name: t('tp_nav_integrity'),
      rows: [
        head('tp_col_name', 'tp_col_grade', 'tp_int_analyzed', 'tp_int_signal', 'tp_col_status'),
        ...f.students.filter((s) => s.tests > 0).map((s) => { const r = analyzeStudent(s.attempts); return [displayName(s), s.grade, `${r.analyzed}/${s.tests}`, r.level === 'nodata' ? '' : r.score, t(`tp_lv_${r.level}`)]; }),
        [],
        [t('tp_integrity_disclaimer_d')],
      ],
    }),
    answers: async () => {
      const all = await adminApi.allAnswers();
      const idToAttempt = Object.fromEntries(m.attempts.map((a) => [a.id, a]));
      const rows = all.filter((x) => f.ids.has(x.user_id) && idToAttempt[x.attempt_id] && inRange(idToAttempt[x.attempt_id].created_at, from, to)
        && (subject === 'all' || x.subject === subject));
      return {
        name: t('tp_rep_answers'),
        rows: [
          head('tp_col_name', 'tp_col_test', 'tp_col_date', '#', 'tp_col_question', 'tp_col_answer', 'tp_col_correct_answer', 'tp_col_result', 'tp_col_time'),
          ...rows.map((x) => [displayName(S(x.user_id)), testTitle(idToAttempt[x.attempt_id], lang, t), fmtDateTime(idToAttempt[x.attempt_id].created_at, lang), x.position, x.question,
            x.user_answer === null ? t('ad_noanswer') : optText(x.options, x.user_answer), optText(x.options, x.correct_answer), x.is_correct ? t('tp_correct') : t('tp_wrong'), x.time_spent_ms == null ? '' : Math.round(x.time_spent_ms / 100) / 10]),
        ],
      };
    },
  };

  async function run(key, fmt) {
    setBusy(`${key}-${fmt}`); setErr('');
    try {
      const file = `xatoxarita-${key}-${stamp()}`;
      if (key === 'full') {
        const list = await Promise.all(['students', 'results', 'answers', 'mistakes', 'topics', 'classes', 'integrity'].map((k) => sheets[k]()));
        downloadXlsx(file, list);
      } else {
        const sh = await sheets[key]();
        if (fmt === 'csv') downloadCsv(file, sh.rows); else downloadXlsx(file, [sh]);
      }
    } catch (e) { console.error(e); setErr(t('err_load')); } finally { setBusy(''); }
  }

  const items = [
    ['students', Users, 'tp_rep_students', f.students.length],
    ['results', ClipboardList, 'tp_rep_results', f.attempts.length],
    ['answers', ListOrdered, 'tp_rep_answers', null],
    ['mistakes', XCircle, 'tp_rep_mistakes', f.mistakes.length],
    ['topics', BarChart3, 'tp_rep_topics', null],
    ['classes', BarChart3, 'tp_err_by_grade', m.grades.length],
    ['integrity', ShieldAlert, 'tp_rep_integrity', null],
  ];

  return (
    <div className="ap-stack">
      <section className="card">
        <h3>{t('tp_rep_filters')}</h3>
        <div className="ap-toolbar">
          <label className="ap-field">{t('tp_rep_from')}<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="ap-field">{t('tp_rep_to')}<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label={t('tp_col_grade')}>
            <option value="all">{t('tp_all_grades')}</option>
            {[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>{t('grade_n', { n: g })}</option>)}
          </select>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={t('subject')}>
            <option value="all">{t('ad_all_subjects')}</option>
            {Object.entries(SUBJECTS).map(([k, v]) => <option key={k} value={k}>{pick(v)}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); setGrade('all'); setSubject('all'); }}>{t('tp_rep_reset')}</button>
        </div>
        {err && <p className="error-text">{err}</p>}
      </section>

      <div className="ap-reports">
        {items.map(([key, Icon, label, n]) => (
          <section key={key} className="card ap-report">
            <span className="icon-box"><Icon size={20} /></span>
            <div className="ap-report-main"><b>{t(label)}</b>{n !== null && <span className="muted small">{t('tp_rows_n', { n })}</span>}</div>
            <div className="ap-report-btns">
              <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => run(key, 'csv')}><Download size={15} /> {busy === `${key}-csv` ? '…' : 'CSV'}</button>
              <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => run(key, 'xlsx')}><FileSpreadsheet size={15} /> {busy === `${key}-xlsx` ? '…' : 'Excel'}</button>
            </div>
          </section>
        ))}
        <section className="card ap-report full">
          <span className="icon-box"><Package size={20} /></span>
          <div className="ap-report-main"><b>{t('tp_rep_full')}</b><span className="muted small">{t('tp_rep_full_d')}</span></div>
          <div className="ap-report-btns">
            <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => run('full', 'xlsx')}><FileSpreadsheet size={15} /> {busy === 'full-xlsx' ? '…' : 'Excel'}</button>
          </div>
        </section>
      </div>
    </div>
  );
}
