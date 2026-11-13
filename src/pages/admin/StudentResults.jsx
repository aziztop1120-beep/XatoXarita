import { useState } from 'react';
import { ChevronDown, ChevronUp, Download, CheckCircle2, XCircle, MinusCircle, ShieldAlert } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import { adminApi } from '../../services/db.js';
import { analyzeAttempt, LEVEL } from '../../lib/integrity.js';
import { downloadCsv } from '../../lib/exportFile.js';
import Loader from '../../components/Loader.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { useAdminData } from './AdminData.jsx';
import { displayName, fmtDateTime, fmtDuration, optText, pctClass, testTitle } from './utils.js';

export const LEVEL_CHIP = { none: 'chip-ok', review: 'chip-mid', possible: 'chip-bad', nodata: '' };

// Tanlangan o'quvchining barcha testlari; har birini batafsil (savollar bo'yicha) ochish mumkin.
export default function StudentResults({ student }) {
  const { t, lang } = useLang();
  const [openId, setOpenId] = useState(null);
  if (!student.attempts.length) return <EmptyState title={t('tp_no_tests_t')} text={t('tp_no_tests_d')} />;
  return (
    <div className="ap-stack">
      {student.attempts.map((a, idx) => (
        <AttemptCard key={a.id} a={a} n={student.attempts.length - idx} student={student} open={openId === a.id}
          onToggle={() => setOpenId(openId === a.id ? null : a.id)} t={t} lang={lang} />
      ))}
    </div>
  );
}

function AttemptCard({ a, n, student, open, onToggle, t, lang }) {
  const { raw } = useAdminData();
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
  const wrong = a.total - a.score;
  const sig = analyzeAttempt(a);

  async function toggle() {
    onToggle();
    if (!open && rows === null && !loading) {
      setLoading(true); setErr(false);
      try {
        const answers = await adminApi.attemptAnswers(a.id);
        if (answers.length) setRows(answers.map((x) => ({ ...x, kind: x.is_correct ? 'ok' : x.user_answer === null ? 'skip' : 'bad' })));
        else {
          // Eski natija: faqat xatolar saqlangan
          setRows(raw.mistakes.filter((x) => x.attempt_id === a.id).map((x, i) => ({ ...x, position: i + 1, is_correct: false, time_spent_ms: null, kind: x.user_answer === null ? 'skip' : 'bad', legacy: true })));
        }
      } catch (e) { console.error(e); setErr(true); } finally { setLoading(false); }
    }
  }

  const exportRows = () => downloadCsv(`${displayName(student)}-${a.id.slice(0, 6)}`, [
    ['#', t('tp_col_question'), t('tp_col_answer'), t('tp_col_correct_answer'), t('tp_col_result'), t('tp_col_time')],
    ...(rows || []).map((r) => [r.position, r.question, r.user_answer === null ? t('ad_noanswer') : optText(r.options, r.user_answer), optText(r.options, r.correct_answer), r.is_correct ? t('tp_correct') : t('tp_wrong'), r.time_spent_ms == null ? '' : Math.round(r.time_spent_ms / 100) / 10]),
  ]);

  return (
    <section className="card ap-attempt">
      <button className="ap-attempt-head" onClick={toggle} aria-expanded={open}>
        <div className="ap-attempt-title">
          <b>#{n} · {testTitle(a, lang, t)}</b>
          <span className="muted small">{fmtDateTime(a.created_at, lang)}</span>
        </div>
        <div className="ap-attempt-nums">
          <span title={t('tp_col_total')}>{a.total}</span>
          <span className="good-t" title={t('tp_correct')}>{a.score}</span>
          <span className="bad-t" title={t('tp_wrong')}>{wrong}</span>
          <span className={`chip ${pctClass(pct)}`}>{pct}%</span>
          <span className="muted small" title={t('tp_col_duration')}>{fmtDuration(a.duration_sec)}</span>
          {sig.level !== LEVEL.NODATA && sig.level !== LEVEL.NONE && <span className={`chip ${LEVEL_CHIP[sig.level]}`}><ShieldAlert size={12} /> {t(`tp_lv_${sig.level}_short`)}</span>}
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>
      <div className="ap-attempt-legend muted small">{t('tp_col_total')} · <span className="good-t">{t('tp_correct')}</span> · <span className="bad-t">{t('tp_wrong')}</span> · % · {t('tp_col_duration')}</div>

      {open && (
        <div className="ap-attempt-body">
          {loading && <Loader />}
          {err && <p className="error-text">{t('err_load')}</p>}
          {rows && (
            <>
              {rows[0]?.legacy && <p className="ap-note">{t('tp_legacy_note')}</p>}
              {rows.length === 0 ? <p className="muted">{t('m_empty_t')}</p> : (
                <div className="table-wrap">
                  <table className="atable ap-table">
                    <thead><tr><th>#</th><th>{t('tp_col_question')}</th><th>{t('tp_col_answer')}</th><th>{t('tp_col_correct_answer')}</th><th>{t('tp_col_time')}</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id || r.position} className={r.kind === 'ok' ? '' : 'ap-row-bad'}>
                          <td>{r.position}</td>
                          <td className="ap-q">{r.question}</td>
                          <td className={r.kind === 'ok' ? 'ans-good' : 'ans-bad'}>
                            {r.kind === 'ok' ? <CheckCircle2 size={14} /> : r.kind === 'skip' ? <MinusCircle size={14} /> : <XCircle size={14} />}{' '}
                            {r.user_answer === null ? t('ad_noanswer') : optText(r.options, r.user_answer)}
                          </td>
                          <td className="ans-good">{optText(r.options, r.correct_answer)}</td>
                          <td className="small">{r.time_spent_ms == null ? '—' : `${Math.round(r.time_spent_ms / 100) / 10} s`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length > 0 && <button className="btn btn-outline btn-sm" onClick={exportRows}><Download size={15} /> CSV</button>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
