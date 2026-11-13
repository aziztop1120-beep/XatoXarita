import { Link } from 'react-router-dom';
import { Globe, PencilLine, Flag, DoorOpen } from 'lucide-react';
import { useLang } from '../../i18n/LangContext.jsx';
import { topicName, subjectName } from '../../lib/stats.js';
import { useAdminData } from './AdminData.jsx';
import { displayName, initials, pctClass, relTime } from './utils.js';

// Real vaqt: kim saytda, kim test ishlayapti, kim tugatdi, kim chiqib ketdi
export default function Live() {
  const { t, lang } = useLang();
  const { model: m, now, realtime, updatedAt } = useAdminData();
  const L = m.live;

  const cols = [
    ['testing', PencilLine, 'tp_live_testing', L.testing, 'warm'],
    ['online', Globe, 'tp_live_online', L.online, 'good'],
    ['finished', Flag, 'tp_live_finished', L.finished, 'violet'],
    ['left', DoorOpen, 'tp_live_left', L.left, 'muted'],
  ];

  const sub = (key, s) => {
    if (key === 'testing' && s.running) {
      const r = s.running;
      return `${subjectName(r.subject, lang)} · ${topicName(r.topic || 'all', lang, t('all_topics'))} · ${relTime(r.started_at, now, t)}`;
    }
    if (key === 'finished' && s.lastTest) {
      return `${s.lastTest.score}/${s.lastTest.total} · ${s.lastTest.total ? Math.round((s.lastTest.score / s.lastTest.total) * 100) : 0}%${s.online ? '' : ` · ${t('tp_left_after')}`}`;
    }
    return null;
  };

  return (
    <div className="ap-stack">
      <p className="muted small">{realtime ? t('tp_live_rt_note') : t('tp_live_poll_note')} {updatedAt ? `· ${relTime(new Date(updatedAt).toISOString(), now, t)}` : ''}</p>
      <div className="ap-live-grid">
        {cols.map(([key, Icon, label, list, tone]) => (
          <section key={key} className={`card ap-live-col ${tone}`}>
            <div className="ap-card-head"><h3><Icon size={18} /> {t(label)}</h3><span className="chip">{list.length}</span></div>
            {list.length === 0 ? <p className="muted small">{t('tp_live_none')}</p> : (
              <ul className="ap-list">
                {list.map((s) => (
                  <li key={s.id}>
                    <div className="ap-person"><b className="ap-avatar">{initials(s)}</b>
                      <div>
                        <Link to={`/admin/students/${s.id}`}><b>{displayName(s)}</b></Link>
                        <div className="muted small">{t('grade_n', { n: s.grade })}{sub(key, s) ? ` · ${sub(key, s)}` : ''}</div>
                      </div>
                    </div>
                    <span className="muted small">
                      {key === 'finished' && s.lastTest && <LastPct a={s.lastTest} />}{' '}
                      {relTime(s.lastActivity, now, t)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function LastPct({ a }) {
  const p = a.total ? Math.round((a.score / a.total) * 100) : 0;
  return <span className={`chip ${pctClass(p)}`}>{p}%</span>;
}
