import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Download, FileSpreadsheet } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { downloadCsv, downloadXlsx, stamp } from '../../lib/exportFile.js';
import { useAdminData } from './AdminData.jsx';
import { displayName, fmtDate, fmtDateTime, pctClass, relTime, initials } from './utils.js';

const PAGE = 20;
export const STATUS_CHIP = { completed: 'chip-ok', in_progress: '', unfinished: 'chip-mid', not_started: 'chip-bad' };

export function studentRows(list, t, lang) {
  return [
    [t('tp_col_name'), t('tp_col_email'), t('tp_col_grade'), t('tp_col_registered'), t('tp_col_last_login'), t('tp_col_tests'), t('tp_col_pct'), t('tp_col_wrong'), t('tp_col_status'), t('tp_col_last_activity')],
    ...list.map((s) => [displayName(s), s.email, s.grade, fmtDateTime(s.created_at, lang), fmtDateTime(s.last_login_at, lang), s.tests, s.pct ?? '', s.wrong, t(`tp_st_${s.status}`), fmtDateTime(s.lastActivity, lang)]),
  ];
}

export default function Students() {
  const { t, lang } = useLang();
  const { model: m, now } = useAdminData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('all');
  const [status, setStatus] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(0);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = m.students.filter((r) => (
      (!s || displayName(r).toLowerCase().includes(s) || (r.email || '').toLowerCase().includes(s))
      && (grade === 'all' || String(r.grade) === grade)
      && (status === 'all' || r.status === status)
      && (!onlineOnly || r.online)
    ));
    const num = (v, d) => (v === null || v === undefined ? d : v);
    const cmp = {
      recent: (a, b) => String(b.lastActivity || '').localeCompare(String(a.lastActivity || '')),
      registered: (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
      name: (a, b) => displayName(a).localeCompare(displayName(b)),
      tests: (a, b) => b.tests - a.tests,
      pct_low: (a, b) => num(a.pct, 999) - num(b.pct, 999),
      pct_high: (a, b) => num(b.pct, -1) - num(a.pct, -1),
      wrong: (a, b) => b.wrong - a.wrong,
    }[sort];
    return [...f].sort(cmp);
  }, [m, q, grade, status, onlineOnly, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = list.slice(cur * PAGE, cur * PAGE + PAGE);
  const reset = (fn) => (e) => { fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value); setPage(0); };
  const file = `oquvchilar-${stamp()}`;

  return (
    <div className="ap-stack">
      <div className="ap-toolbar">
        <div className="search"><Search size={16} /><input value={q} onChange={reset(setQ)} placeholder={t('ad_search')} aria-label={t('ad_search')} /></div>
        <select value={grade} onChange={reset(setGrade)} aria-label={t('tp_col_grade')}>
          <option value="all">{t('tp_all_grades')}</option>
          {[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>{t('grade_n', { n: g })}</option>)}
        </select>
        <select value={status} onChange={reset(setStatus)} aria-label={t('tp_col_status')}>
          <option value="all">{t('tp_all_status')}</option>
          {['completed', 'in_progress', 'unfinished', 'not_started'].map((s) => <option key={s} value={s}>{t(`tp_st_${s}`)}</option>)}
        </select>
        <select value={sort} onChange={reset(setSort)} aria-label="Sort">
          {[['recent', 'tp_sort_recent'], ['registered', 'tp_sort_registered'], ['name', 'ad_sort_name'], ['tests', 'tp_sort_tests'], ['pct_low', 'tp_sort_pct_low'], ['pct_high', 'tp_sort_pct_high'], ['wrong', 'tp_sort_wrong']]
            .map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
        </select>
        <label className="ap-check"><input type="checkbox" checked={onlineOnly} onChange={reset(setOnlineOnly)} />{t('tp_online_only')}</label>
        <button className="btn btn-outline btn-sm" onClick={() => downloadCsv(file, studentRows(list, t, lang))} disabled={!list.length}><Download size={15} /> CSV</button>
        <button className="btn btn-outline btn-sm" onClick={() => downloadXlsx(file, [{ name: t('tp_nav_students'), rows: studentRows(list, t, lang) }])} disabled={!list.length}><FileSpreadsheet size={15} /> Excel</button>
      </div>

      <section className="card">
        <div className="muted small ap-count-line">{t('tp_found', { n: list.length })}</div>
        {list.length === 0 ? <EmptyState title={t('ad_empty_t')} text={t('ad_empty_d')} /> : (
          <div className="table-wrap">
            <table className="atable ap-table">
              <thead><tr>
                <th>{t('tp_col_name')}</th><th>{t('tp_col_grade')}</th><th>{t('tp_col_registered')}</th><th>{t('tp_col_last_login')}</th>
                <th>{t('tp_col_tests')}</th><th>{t('tp_col_pct')}</th><th>{t('tp_col_wrong')}</th><th>{t('tp_col_status')}</th><th>{t('tp_col_last_activity')}</th>
              </tr></thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className="click" tabIndex={0} onClick={() => navigate(`/admin/students/${s.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/students/${s.id}`)}>
                    <td>
                      <div className="ap-person"><b className="ap-avatar">{initials(s)}</b>
                        <div><Link to={`/admin/students/${s.id}`} onClick={(e) => e.stopPropagation()}><b>{displayName(s)}</b></Link>
                          <div className="muted small">{s.email}</div></div></div>
                    </td>
                    <td>{s.grade}</td>
                    <td className="small">{fmtDate(s.created_at, lang)}</td>
                    <td className="small">{fmtDateTime(s.last_login_at, lang)}</td>
                    <td>{s.tests}</td>
                    <td>{s.pct === null ? <span className="muted">—</span> : <span className={`chip ${pctClass(s.pct)}`}>{s.pct}%</span>}</td>
                    <td>{s.wrong ? <span className="chip chip-bad">{s.wrong}</span> : 0}</td>
                    <td><span className={`chip ${STATUS_CHIP[s.status]}`}>{t(`tp_st_${s.status}`)}</span></td>
                    <td className="small">{s.online && <i className="ap-dot" title={t('tp_k_online')} />}{relTime(s.lastActivity, now, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="ap-pager">
            <button className="btn btn-outline btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>{t('back')}</button>
            <span className="muted small">{cur + 1} / {pages}</span>
            <button className="btn btn-outline btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>{t('next')}</button>
          </div>
        )}
      </section>
    </div>
  );
}
