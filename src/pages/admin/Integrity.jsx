import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, ShieldCheck, ShieldQuestion, ShieldAlert, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import { analyzeStudent, LEVEL } from '../../lib/integrity.js';
import EmptyState from '../../components/EmptyState.jsx';
import { useAdminData } from './AdminData.jsx';
import { LEVEL_CHIP } from './StudentResults.jsx';
import { displayName, fmtDateTime, testTitle } from './utils.js';

// AI yordamidan foydalanish EHTIMOLINI kuzatish. Bu isbot emas — faqat statistik signallar.
export default function Integrity() {
  const { t, lang } = useLang();
  const { model: m } = useAdminData();
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);

  const rows = useMemo(() => m.students.filter((s) => s.tests > 0)
    .map((s) => ({ s, r: analyzeStudent(s.attempts) }))
    .sort((a, b) => b.r.score - a.r.score), [m]);

  const count = (lv) => rows.filter((x) => x.r.level === lv).length;
  const cards = [
    [LEVEL.NONE, ShieldCheck, 'tp_lv_none'],
    [LEVEL.REVIEW, ShieldQuestion, 'tp_lv_review'],
    [LEVEL.POSSIBLE, ShieldAlert, 'tp_lv_possible'],
    [LEVEL.NODATA, Database, 'tp_lv_nodata'],
  ];
  const shown = rows.filter((x) => filter === 'all' || x.r.level === filter);
  const sigText = (sig) => t(`tp_sig_${sig.id}`, sig.params);

  return (
    <div className="ap-stack">
      <div className="ap-note-card" role="note">
        <Info size={20} />
        <div>
          <b>{t('tp_integrity_disclaimer_t')}</b>
          <p>{t('tp_integrity_disclaimer_d')}</p>
        </div>
      </div>

      <div className="ap-tabs">
        {cards.map(([lv, Icon, label]) => (
          <button key={lv} className={`card ap-tab ${filter === lv ? 'on' : ''}`} onClick={() => setFilter(filter === lv ? 'all' : lv)}>
            <Icon size={20} /><strong>{count(lv)}</strong><span>{t(label)}</span>
          </button>
        ))}
      </div>

      <section className="card">
        {shown.length === 0 ? <EmptyState title={t('tp_empty_t')} text={t('tp_integrity_empty')} /> : (
          <div className="table-wrap">
            <table className="atable ap-table">
              <thead><tr><th>{t('tp_col_name')}</th><th>{t('tp_col_grade')}</th><th>{t('tp_int_analyzed')}</th><th>{t('tp_int_signal')}</th><th>{t('tp_col_status')}</th><th /></tr></thead>
              <tbody>
                {shown.map(({ s, r }) => (
                  <Fragment key={s.id}>
                    <tr className="click" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                      <td><Link to={`/admin/students/${s.id}`} onClick={(e) => e.stopPropagation()}><b>{displayName(s)}</b></Link></td>
                      <td>{s.grade}</td>
                      <td>{r.analyzed}/{s.tests}{r.flagged ? <span className="muted small"> · {t('tp_int_flagged', { n: r.flagged })}</span> : null}</td>
                      <td>{r.level === LEVEL.NODATA ? '—' : (
                        <div className="ap-score"><div className="hbar"><span className={r.level === LEVEL.POSSIBLE ? 'hot' : r.level === LEVEL.REVIEW ? 'warm' : 'cool'} style={{ width: `${r.score}%` }} /></div><b>{r.score}</b></div>
                      )}</td>
                      <td><span className={`chip ${LEVEL_CHIP[r.level]}`}>{t(`tp_lv_${r.level}`)}</span></td>
                      <td>{openId === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                    </tr>
                    {openId === s.id && (
                      <tr className="ap-expand"><td colSpan={6}>
                        {r.items.map(({ attempt: a, res }) => (
                          <div key={a.id} className="ap-int-item">
                            <div className="ap-int-head">
                              <b>{testTitle(a, lang, t)}</b><span className="muted small">{fmtDateTime(a.created_at, lang)}</span>
                              <span className={`chip ${LEVEL_CHIP[res.level]}`}>{t(`tp_lv_${res.level}_short`)}{res.level !== LEVEL.NODATA ? ` · ${res.score}` : ''}</span>
                            </div>
                            {res.level === LEVEL.NODATA ? <p className="muted small">{t('tp_int_nodata_d')}</p>
                              : res.signals.length === 0 ? <p className="muted small">{t('tp_int_nosig')}</p>
                                : <ul className="ap-sigs">{res.signals.map((sg) => <li key={sg.id}><b>+{sg.points}</b> {sigText(sg)}</li>)}</ul>}
                          </div>
                        ))}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>{t('tp_int_how_t')}</h3>
        <ul className="ap-howto">
          {['fast', 'contrast', 'repeat', 'leaves', 'copy'].map((k) => <li key={k}>{t(`tp_how_${k}`)}</li>)}
        </ul>
        <p className="muted small">{t('tp_int_false_pos')}</p>
      </section>
    </div>
  );
}
