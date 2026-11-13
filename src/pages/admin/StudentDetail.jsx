import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import { topicName, subjectName } from '../../lib/stats.js';
import { analyzeStudent } from '../../lib/integrity.js';
import EmptyState from '../../components/EmptyState.jsx';
import { useAdminData } from './AdminData.jsx';
import StudentResults, { LEVEL_CHIP } from './StudentResults.jsx';
import { HBars } from './charts.jsx';
import { STATUS_CHIP } from './Students.jsx';
import { displayName, fmtDate, fmtDateTime, initials, relTime } from './utils.js';

export default function StudentDetail() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const { model: m, now } = useAdminData();
  const s = m.byId[id];
  const integ = useMemo(() => (s ? analyzeStudent(s.attempts) : null), [s]);

  if (!s) {
    return (
      <div className="ap-stack">
        <Link className="btn btn-ghost btn-sm" to="/admin/students"><ArrowLeft size={16} /> {t('ad_back')}</Link>
        <EmptyState title={t('tp_not_found_t')} text={t('tp_not_found_d')} />
      </div>
    );
  }

  const weak = Object.entries(m.studentTopic[s.id] || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, count]) => {
    const [subject, topic] = key.split('|');
    return { key, label: topicName(topic, lang), sub: subjectName(subject, lang), value: count, right: t('ad_weak_mistakes', { n: count }) };
  });

  return (
    <div className="ap-stack">
      <Link className="btn btn-ghost btn-sm ap-self-start" to="/admin/students"><ArrowLeft size={16} /> {t('ad_back')}</Link>
      <section className="card ap-profile">
        <b className="ap-avatar lg">{initials(s)}</b>
        <div className="ap-profile-main">
          <h2>{displayName(s)} {s.online && <span className="chip chip-ok"><i className="ap-dot" /> {t('tp_k_online')}</span>}</h2>
          <p className="muted">{s.email} · {t('grade_n', { n: s.grade })}</p>
          <p className="muted small">
            {t('tp_col_registered')}: {fmtDate(s.created_at, lang)} · {t('tp_col_last_login')}: {fmtDateTime(s.last_login_at, lang)} · {t('tp_col_last_activity')}: {relTime(s.lastActivity, now, t)}
            {s.login_count ? ` · ${t('tp_logins_n', { n: s.login_count })}` : ''}
          </p>
        </div>
        <span className={`chip ${STATUS_CHIP[s.status]}`}>{t(`tp_st_${s.status}`)}</span>
      </section>

      <div className="grid grid-4">
        <div className="card stat"><strong>{s.tests}</strong><span className="muted">{t('ad_s_tests')}</span></div>
        <div className="card stat"><strong>{s.pct === null ? '—' : `${s.pct}%`}</strong><span className="muted">{t('tp_col_pct')}</span></div>
        <div className="card stat"><strong>{s.wrong}</strong><span className="muted">{t('tp_col_wrong')}</span></div>
        <div className="card stat">
          <strong>{integ.level === 'nodata' ? '—' : `${integ.score}`}</strong>
          <span className="muted"><ShieldAlert size={13} /> {t(`tp_lv_${integ.level}_short`)}</span>
        </div>
      </div>

      <section className="card">
        <h3>{t('ad_by_topic')}</h3>
        {weak.length === 0 ? <p className="muted">{t('m_empty_d')}</p> : <HBars rows={weak} />}
      </section>

      <h3 className="ap-section">{t('tp_all_results')}</h3>
      <StudentResults student={s} />
    </div>
  );
}
