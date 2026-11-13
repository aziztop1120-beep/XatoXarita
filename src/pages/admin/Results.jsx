import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { useAdminData } from './AdminData.jsx';
import StudentResults from './StudentResults.jsx';
import { displayName, fmtDateTime, pctClass, testTitle } from './utils.js';

// Ustoz istalgan o'quvchini tanlab uning barcha test natijalarini ko'radi
export default function Results() {
  const { t, lang } = useLang();
  const { model: m } = useAdminData();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const id = params.get('student');
  const s = id ? m.byId[id] : null;

  const options = useMemo(() => {
    const x = q.trim().toLowerCase();
    return [...m.students].sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .filter((r) => !x || displayName(r).toLowerCase().includes(x) || (r.email || '').toLowerCase().includes(x));
  }, [m, q]);

  const pick = (v) => { if (v) setParams({ student: v }); else setParams({}); };

  return (
    <div className="ap-stack">
      <section className="card ap-picker">
        <div className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ad_search')} aria-label={t('ad_search')} /></div>
        <select value={id || ''} onChange={(e) => pick(e.target.value)} aria-label={t('tp_pick_student')}>
          <option value="">{t('tp_pick_student')}</option>
          {options.map((r) => <option key={r.id} value={r.id}>{displayName(r)} — {t('grade_n', { n: r.grade })} ({r.tests})</option>)}
        </select>
        {s && <Link className="btn btn-outline btn-sm" to={`/admin/students/${s.id}`}>{t('tp_open_profile')}</Link>}
      </section>

      {s ? (
        <>
          <div className="grid grid-3">
            <div className="card stat"><strong>{s.tests}</strong><span className="muted">{t('ad_s_tests')}</span></div>
            <div className="card stat"><strong>{s.pct === null ? '—' : `${s.pct}%`}</strong><span className="muted">{t('tp_col_pct')}</span></div>
            <div className="card stat"><strong>{s.wrong}</strong><span className="muted">{t('tp_col_wrong')}</span></div>
          </div>
          <StudentResults key={s.id} student={s} />
        </>
      ) : (
        <section className="card">
          <h3>{t('tp_recent')}</h3>
          {m.attempts.length === 0 ? <EmptyState title={t('tp_empty_t')} text={t('tp_empty_d')} /> : (
            <ul className="ap-list">
              {m.attempts.slice(0, 15).map((a) => {
                const p = a.total ? Math.round((a.score / a.total) * 100) : 0;
                return (
                  <li key={a.id}>
                    <div><button className="ap-linkbtn" onClick={() => pick(a.user_id)}><b>{displayName(m.byId[a.user_id])}</b></button>
                      <div className="muted small">{testTitle(a, lang, t)} · {fmtDateTime(a.created_at, lang)}</div></div>
                    <span className={`chip ${pctClass(p)}`}>{a.score}/{a.total} · {p}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
