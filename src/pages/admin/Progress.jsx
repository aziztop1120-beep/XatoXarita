import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Hourglass, CircleDashed, Search } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { useAdminData } from './AdminData.jsx';
import { displayName, fmtDate, fmtDateTime, pctClass, relTime, testTitle } from './utils.js';

// Testni bajarganlar / boshlab tugatmaganlar / hali boshlamaganlar
export default function Progress() {
  const { t, lang } = useLang();
  const { model: m, now } = useAdminData();
  const [tab, setTab] = useState('completed');
  const [q, setQ] = useState('');
  const match = (s) => { const x = q.trim().toLowerCase(); return !x || displayName(s).toLowerCase().includes(x) || (s.email || '').toLowerCase().includes(x); };

  const completed = useMemo(() => m.students.filter((s) => s.tests > 0), [m]);
  const notStarted = useMemo(() => m.students.filter((s) => s.tests === 0 && s.sessions.length === 0), [m]);
  const unfinished = m.unfinishedSessions;
  const unfinishedStudents = new Set(unfinished.map((x) => x.user_id)).size;

  const tabs = [
    ['completed', CheckCircle2, completed.length, 'tp_tab_completed'],
    ['unfinished', Hourglass, unfinishedStudents, 'tp_tab_unfinished'],
    ['not_started', CircleDashed, notStarted.length, 'tp_tab_not_started'],
  ];

  const nameCell = (s) => <div><Link to={`/admin/students/${s.id}`}><b>{displayName(s)}</b></Link><div className="muted small">{s.email}</div></div>;

  return (
    <div className="ap-stack">
      <div className="ap-tabs">
        {tabs.map(([key, Icon, n, label]) => (
          <button key={key} className={`card ap-tab ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)}>
            <Icon size={20} /><strong>{n}</strong><span>{t(label)}</span>
          </button>
        ))}
      </div>
      <div className="ap-toolbar"><div className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ad_search')} aria-label={t('ad_search')} /></div></div>

      <section className="card">
        {tab === 'completed' && (() => {
          const rows = completed.filter(match);
          return rows.length === 0 ? <EmptyState title={t('tp_empty_t')} text={t('tp_empty_d')} /> : (
            <div className="table-wrap"><table className="atable ap-table">
              <thead><tr><th>{t('tp_col_name')}</th><th>{t('tp_col_grade')}</th><th>{t('tp_col_tests')}</th><th>{t('tp_col_pct')}</th><th>{t('tp_col_last_test')}</th></tr></thead>
              <tbody>{rows.map((s) => (
                <tr key={s.id}><td>{nameCell(s)}</td><td>{s.grade}</td><td>{s.tests}</td>
                  <td><span className={`chip ${pctClass(s.pct)}`}>{s.pct}%</span></td>
                  <td className="small">{testTitle(s.lastTest, lang, t)}<div className="muted">{fmtDateTime(s.lastTest.created_at, lang)}</div></td></tr>
              ))}</tbody></table></div>
          );
        })()}

        {tab === 'unfinished' && (() => {
          const rows = unfinished.filter((x) => x.student && match(x.student));
          return rows.length === 0 ? <EmptyState title={t('tp_none_unfinished_t')} text={t('tp_none_unfinished_d')} /> : (
            <div className="table-wrap"><table className="atable ap-table">
              <thead><tr><th>{t('tp_col_name')}</th><th>{t('tp_col_test')}</th><th>{t('tp_col_started')}</th><th>{t('tp_col_status')}</th><th>{t('tp_col_last_activity')}</th></tr></thead>
              <tbody>{rows.map((x) => (
                <tr key={x.id}><td>{nameCell(x.student)}</td>
                  <td className="small">{testTitle(x, lang, t)}<div className="muted">{t('tp_questions_n', { n: x.total })}</div></td>
                  <td className="small">{fmtDateTime(x.started_at, lang)}</td>
                  <td><span className={`chip ${x.state === 'running' ? '' : 'chip-mid'}`}>{x.state === 'running' ? t('tp_st_running') : t('tp_st_abandoned')}</span></td>
                  <td className="small">{relTime(x.last_ping_at || x.started_at, now, t)}</td></tr>
              ))}</tbody></table></div>
          );
        })()}

        {tab === 'not_started' && (() => {
          const rows = notStarted.filter(match);
          return rows.length === 0 ? <EmptyState title={t('tp_none_notstarted_t')} text={t('tp_none_notstarted_d')} /> : (
            <div className="table-wrap"><table className="atable ap-table">
              <thead><tr><th>{t('tp_col_name')}</th><th>{t('tp_col_grade')}</th><th>{t('tp_col_registered')}</th><th>{t('tp_col_last_login')}</th></tr></thead>
              <tbody>{rows.map((s) => (
                <tr key={s.id}><td>{nameCell(s)}</td><td>{s.grade}</td><td className="small">{fmtDate(s.created_at, lang)}</td>
                  <td className="small">{s.last_login_at ? fmtDateTime(s.last_login_at, lang) : t('tp_never_entered')}</td></tr>
              ))}</tbody></table></div>
          );
        })()}
      </section>
    </div>
  );
}
