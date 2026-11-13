import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../../i18n/LangContext.jsx';
import { SUBJECTS } from '../../lib/questions.js';
import { subjectName, topicName } from '../../lib/stats.js';
import { normSubject } from '../../lib/questions.js';
import { adminApi } from '../../services/db.js';
import { useLoad } from '../../lib/useLoad.js';
import EmptyState from '../../components/EmptyState.jsx';
import { topicKey } from '../../lib/adminModel.js';
import { useAdminData } from './AdminData.jsx';
import { BarChart, HBars } from './charts.jsx';
import { displayName, pctClass } from './utils.js';

// Xatolar tahlili: qiyin savollar va mavzular, o'quvchi × mavzu, sinflar va fanlar
export default function Errors() {
  const { t, lang, pick } = useLang();
  const { model: m } = useAdminData();
  const [subject, setSubject] = useState('all');
  const qs = useLoad(() => adminApi.questionStats(), []);
  const ts = useLoad(() => adminApi.topicStats(), []);

  const inSubject = (s) => subject === 'all' || normSubject(s) === subject;

  // Savollar: bazadagi hisob (javoblar soni bilan) bo'lsa — o'sha, bo'lmasa xato yozuvlaridan
  const questions = useMemo(() => {
    if (qs.data?.length) {
      return qs.data.filter((x) => inSubject(x.subject)).map((x) => ({
        question: x.question, subject: x.subject, topic: x.topic, wrong: Number(x.wrong), answered: Number(x.answered), students: Number(x.students_wrong),
        rate: Number(x.answered) ? Math.round((Number(x.wrong) / Number(x.answered)) * 100) : null,
      })).slice(0, 15);
    }
    const map = {};
    m.mistakes.filter((x) => inSubject(x.subject)).forEach((x) => {
      const o = (map[x.question] ||= { question: x.question, subject: x.subject, topic: x.topic, wrong: 0, answered: null, rate: null, who: new Set() });
      o.wrong += 1; o.who.add(x.user_id);
    });
    return Object.values(map).map((o) => ({ ...o, students: o.who.size })).sort((a, b) => b.wrong - a.wrong).slice(0, 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs.data, m, subject]);

  // Mavzular
  const topics = useMemo(() => {
    const rate = {};
    (ts.data || []).forEach((x) => { rate[topicKey(x.subject, x.topic)] = Number(x.answered) ? Math.round((Number(x.wrong) / Number(x.answered)) * 100) : null; });
    return m.topics.filter((x) => inSubject(x.subject)).map((x) => ({ ...x, rate: rate[x.key] ?? null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, ts.data, subject]);

  // O'quvchi × mavzu issiqlik jadvali
  const matrix = useMemo(() => {
    const cols = topics.slice(0, 8);
    const rows = m.students.map((s) => {
      const st = m.studentTopic[s.id] || {};
      const total = cols.reduce((sum, c) => sum + (st[c.key] || 0), 0);
      return { s, st, total };
    }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 25);
    const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => r.st[c.key] || 0)));
    return { cols, rows, max };
  }, [m, topics]);

  const grades = m.grades;

  return (
    <div className="ap-stack">
      <div className="ap-toolbar">
        <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={t('subject')}>
          <option value="all">{t('ad_all_subjects')}</option>
          {Object.entries(SUBJECTS).map(([k, v]) => <option key={k} value={k}>{pick(v)}</option>)}
        </select>
      </div>

      <div className="ap-grid-2">
        <section className="card">
          <div className="ap-card-head"><h3>{t('tp_err_hard_topics')}</h3></div>
          {topics.length === 0 ? <EmptyState title={t('m_empty_t')} text={t('m_empty_d')} /> : (
            <HBars rows={topics.slice(0, 8).map((x) => ({
              key: x.key, label: topicName(x.topic, lang), sub: subjectName(x.subject, lang), value: x.mistakes,
              right: `${t('ad_weak_mistakes', { n: x.mistakes })}${x.rate !== null ? ` · ${x.rate}%` : ''}`,
            }))} />
          )}
        </section>
        <section className="card">
          <div className="ap-card-head"><h3>{t('tp_err_by_subject')}</h3></div>
          {m.subjects.length === 0 ? <EmptyState title={t('tp_empty_t')} text={t('tp_empty_d')} />
            : <BarChart data={m.subjects.map((s) => ({ label: subjectName(s.subject, lang), value: s.pct, tone: s.pct >= 80 ? 'good' : s.pct >= 55 ? 'mid' : 'bad' }))} />}
        </section>
      </div>

      <section className="card">
        <div className="ap-card-head"><h3>{t('tp_err_by_subject_tbl')}</h3></div>
        <div className="table-wrap"><table className="atable ap-table">
          <thead><tr><th>{t('subject')}</th><th>{t('tp_col_tests')}</th><th>{t('tp_k_students_n')}</th><th>{t('tp_col_pct')}</th><th>{t('tp_col_wrong')}</th></tr></thead>
          <tbody>
            {m.subjects.length === 0 && <tr><td colSpan={5} className="muted">{t('tp_empty_d')}</td></tr>}
            {m.subjects.map((s) => (
              <tr key={s.subject}><td><b>{subjectName(s.subject, lang)}</b></td><td>{s.tests}</td><td>{s.students}</td>
                <td><span className={`chip ${pctClass(s.pct)}`}>{s.pct}%</span></td><td>{s.wrong}</td></tr>
            ))}
          </tbody></table></div>
      </section>

      <section className="card">
        <div className="ap-card-head"><h3>{t('tp_err_hard_questions')}</h3></div>
        {questions.length === 0 ? <EmptyState title={t('m_empty_t')} text={t('m_empty_d')} /> : (
          <div className="table-wrap"><table className="atable ap-table">
            <thead><tr><th>#</th><th>{t('tp_col_question')}</th><th>{t('topic')}</th><th>{t('tp_col_wrong')}</th><th>{t('tp_err_rate')}</th><th>{t('tp_k_students_n')}</th></tr></thead>
            <tbody>{questions.map((x, i) => (
              <tr key={x.question}><td>{i + 1}</td><td className="ap-q">{x.question}</td>
                <td className="small">{topicName(x.topic, lang)}<div className="muted">{subjectName(x.subject, lang)}</div></td>
                <td><span className="chip chip-bad">{x.wrong}</span></td>
                <td>{x.rate === null ? <span className="muted">—</span> : <span className={`chip ${pctClass(100 - x.rate)}`}>{x.rate}%</span>}</td>
                <td>{x.students}</td></tr>
            ))}</tbody></table></div>
        )}
      </section>

      <section className="card">
        <div className="ap-card-head"><h3>{t('tp_err_matrix')}</h3></div>
        <p className="muted small">{t('tp_err_matrix_d')}</p>
        {matrix.rows.length === 0 ? <EmptyState title={t('m_empty_t')} text={t('m_empty_d')} /> : (
          <div className="table-wrap"><table className="atable ap-table ap-matrix">
            <thead><tr><th>{t('tp_col_name')}</th>{matrix.cols.map((c) => <th key={c.key} title={subjectName(c.subject, lang)}>{topicName(c.topic, lang)}</th>)}<th>Σ</th></tr></thead>
            <tbody>{matrix.rows.map(({ s, st, total }) => (
              <tr key={s.id}>
                <td><Link to={`/admin/students/${s.id}`}><b>{displayName(s)}</b></Link></td>
                {matrix.cols.map((c) => {
                  const v = st[c.key] || 0;
                  return <td key={c.key} className="ap-heat" style={v ? { background: `color-mix(in srgb, var(--bad) ${Math.round(18 + (v / matrix.max) * 62)}%, transparent)` } : undefined}>{v || ''}</td>;
                })}
                <td><b>{total}</b></td>
              </tr>
            ))}</tbody></table></div>
        )}
      </section>

      <section className="card">
        <div className="ap-card-head"><h3>{t('tp_err_by_grade')}</h3></div>
        {grades.length === 0 ? <EmptyState title={t('tp_empty_t')} text={t('tp_empty_d')} /> : (
          <div className="table-wrap"><table className="atable ap-table">
            <thead><tr><th>{t('tp_col_grade')}</th><th>{t('tp_k_students_n')}</th><th>{t('tp_active_n')}</th><th>{t('tp_col_tests')}</th><th>{t('tp_col_pct')}</th><th>{t('tp_col_wrong')}</th><th>{t('tp_err_top_topic')}</th></tr></thead>
            <tbody>{grades.map((g) => {
              const [sj, tp] = (g.topKey || '|').split('|');
              return (
                <tr key={g.grade}><td><b>{t('grade_n', { n: g.grade })}</b></td><td>{g.students}</td><td>{g.active}</td><td>{g.tests}</td>
                  <td>{g.pct === null ? <span className="muted">—</span> : <span className={`chip ${pctClass(g.pct)}`}>{g.pct}%</span>}</td>
                  <td>{g.wrong}</td><td className="small">{g.topKey ? `${topicName(tp, lang)} (${subjectName(sj, lang)})` : '—'}</td></tr>
              );
            })}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
