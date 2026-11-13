import { Link } from 'react-router-dom';
import { Users, Radio, LogIn, CheckCircle2, Hourglass, ClipboardCheck, Percent, XCircle, CalendarCheck, ShieldAlert } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import { subjectName, topicName } from '../../lib/stats.js';
import { analyzeStudent, LEVEL } from '../../lib/integrity.js';
import { useMemo } from 'react';
import EmptyState from '../../components/EmptyState.jsx';
import { useAdminData } from './AdminData.jsx';
import { AreaChart, BarChart, Donut, HBars } from './charts.jsx';
import { displayName, fmtDateTime, pctClass, testTitle } from './utils.js';

export default function Overview() {
  const { t, lang } = useLang();
  const { model: m } = useAdminData();
  const k = m.kpi;

  const cards = [
    [Users, 'tp_k_registered', k.registered, '/admin/students'],
    [Radio, 'tp_k_online', k.online, '/admin/live', true],
    [LogIn, 'tp_k_entered', k.entered, '/admin/students'],
    [CheckCircle2, 'tp_k_completed', k.completed, '/admin/progress'],
    [Hourglass, 'tp_k_not_completed', k.notCompleted, '/admin/progress'],
    [ClipboardCheck, 'tp_k_tests', k.tests, '/admin/results'],
    [Percent, 'tp_k_avg', k.avgPct === null ? '—' : `${k.avgPct}%`, '/admin/errors'],
    [XCircle, 'tp_k_wrong', k.wrong, '/admin/errors'],
    [CalendarCheck, 'tp_k_today', k.today, '/admin/results'],
  ];

  const unfinishedStudents = m.students.filter((s) => s.status === 'unfinished').length;
  const notStarted = m.students.filter((s) => s.status === 'not_started').length;
  const donut = [
    { label: t('tp_st_completed'), value: k.completed, color: 'var(--good)' },
    { label: t('tp_st_unfinished'), value: unfinishedStudents, color: '#f59e0b' },
    { label: t('tp_st_not_started'), value: notStarted, color: 'var(--line)' },
  ];

  const integ = useMemo(() => {
    const c = { review: 0, possible: 0 };
    m.students.forEach((s) => { const r = analyzeStudent(s.attempts); if (r.level === LEVEL.REVIEW) c.review += 1; if (r.level === LEVEL.POSSIBLE) c.possible += 1; });
    return c;
  }, [m]);

  return (
    <div className="ap-stack">
      <div className="ap-kpis">
        {cards.map(([Icon, key, value, to, pulse]) => (
          <Link key={key} to={to} className="card ap-kpi">
            <span className="icon-box"><Icon size={20} /></span>
            <div><strong>{value}</strong><span className="muted">{t(key)}</span></div>
            {pulse && value > 0 && <i className="ap-pulse" />}
          </Link>
        ))}
      </div>

      <div className="ap-grid-2">
        <section className="card">
          <div className="ap-card-head"><h3>{t('tp_chart_tests14')}</h3></div>
          <AreaChart data={m.days.map((d) => ({ label: d.label, value: d.tests }))} />
        </section>
        <section className="card">
          <div className="ap-card-head"><h3>{t('tp_chart_status')}</h3></div>
          <Donut segments={donut} center={k.registered} sub={t('tp_k_registered')} />
        </section>
      </div>

      <div className="ap-grid-2">
        <section className="card">
          <div className="ap-card-head"><h3>{t('tp_chart_subjects')}</h3></div>
          {m.subjects.length === 0 ? <EmptyState title={t('tp_empty_t')} text={t('tp_empty_d')} />
            : <BarChart data={m.subjects.map((s) => ({ label: subjectName(s.subject, lang), value: s.pct, tone: s.pct >= 80 ? 'good' : s.pct >= 55 ? 'mid' : 'bad' }))} />}
        </section>
        <section className="card">
          <div className="ap-card-head"><h3>{t('tp_chart_topics')}</h3><Link className="small" to="/admin/errors">{t('tp_more')}</Link></div>
          {m.topics.length === 0 ? <EmptyState title={t('tp_empty_t')} text={t('tp_empty_d')} />
            : <HBars rows={m.topics.slice(0, 6).map((x) => ({ key: x.key, label: topicName(x.topic, lang), sub: subjectName(x.subject, lang), value: x.mistakes, right: t('ad_weak_mistakes', { n: x.mistakes }) }))} />}
        </section>
      </div>

      <div className="ap-grid-2">
        <section className="card">
          <div className="ap-card-head"><h3>{t('tp_recent')}</h3><Link className="small" to="/admin/results">{t('tp_more')}</Link></div>
          {m.recent.length === 0 ? <EmptyState title={t('tp_empty_t')} text={t('tp_empty_d')} /> : (
            <ul className="ap-list">
              {m.recent.map((a) => {
                const s = m.byId[a.user_id]; const p = a.total ? Math.round((a.score / a.total) * 100) : 0;
                return (
                  <li key={a.id}>
                    <div><Link to={`/admin/students/${a.user_id}`}><b>{displayName(s)}</b></Link><div className="muted small">{testTitle(a, lang, t)} · {fmtDateTime(a.created_at, lang)}</div></div>
                    <span className={`chip ${pctClass(p)}`}>{a.score}/{a.total} · {p}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card">
          <div className="ap-card-head"><h3>{t('tp_integrity_card')}</h3><Link className="small" to="/admin/integrity">{t('tp_more')}</Link></div>
          <p className="muted small">{t('tp_integrity_card_d')}</p>
          <div className="ap-mini-stats">
            <div><ShieldAlert size={18} /><strong>{integ.review}</strong><span>{t('tp_lv_review')}</span></div>
            <div><ShieldAlert size={18} /><strong>{integ.possible}</strong><span>{t('tp_lv_possible')}</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
