import { useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, ListChecks, ShieldAlert, Radio, BarChart3, FileSpreadsheet,
  Menu, X, LogOut, Sun, Moon, ArrowLeft, RefreshCw, TriangleAlert,
} from 'lucide-react';
import { useLang, LANGS } from '../../i18n/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { auth } from '../../services/db.js';
import { isSupabase } from '../../lib/supabase.js';
import Logo from '../../components/Logo.jsx';
import Loader from '../../components/Loader.jsx';
import ErrorBox from '../../components/ErrorBox.jsx';
import DemoBanner from '../../components/DemoBanner.jsx';
import { AdminDataProvider, useAdminData } from './AdminData.jsx';
import { initials, relTime } from './utils.js';

const NAV = [
  ['/admin', 'tp_nav_overview', LayoutDashboard, true],
  ['/admin/students', 'tp_nav_students', Users],
  ['/admin/results', 'tp_nav_results', ClipboardList],
  ['/admin/progress', 'tp_nav_progress', ListChecks],
  ['/admin/integrity', 'tp_nav_integrity', ShieldAlert],
  ['/admin/live', 'tp_nav_live', Radio],
  ['/admin/errors', 'tp_nav_errors', BarChart3],
  ['/admin/reports', 'tp_nav_reports', FileSpreadsheet],
];

export default function AdminShell() {
  return <AdminDataProvider><Shell /></AdminDataProvider>;
}

function Shell() {
  const { t, lang, setLang } = useLang();
  const { theme, toggle } = useTheme();
  const { profile, user } = useAuth();
  const { model, raw, loading, error, reload, refresh, realtime, updatedAt, now } = useAdminData();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const close = () => setOpen(false);

  const current = NAV.find(([to, , , end]) => (end ? loc.pathname === to : loc.pathname.startsWith(to)));
  const title = loc.pathname.startsWith('/admin/students/') ? t('tp_nav_students') : t(current?.[1] || 'tp_nav_overview');

  async function logout() {
    await auth.signOut();
    navigate('/');
  }

  return (
    <div className="ap">
      <aside className={`ap-side ${open ? 'open' : ''}`}>
        <div className="ap-side-head">
          <Link to="/admin" onClick={close} className="brand"><Logo /></Link>
          <button className="ap-iconbtn ap-only-mobile" onClick={close} aria-label="Close"><X size={18} /></button>
        </div>
        <span className="ap-badge-role">{t('tp_teacher_panel')}</span>
        <nav className="ap-nav">
          {NAV.map(([to, key, Icon, end]) => (
            <NavLink key={to} to={to} end={!!end} onClick={close} className={({ isActive }) => `ap-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /><span>{t(key)}</span>
              {to === '/admin/live' && model && <em className="ap-count">{model.kpi.online}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="ap-side-foot">
          <Link to="/dashboard" className="ap-link" onClick={close}><ArrowLeft size={18} /><span>{t('tp_back_site')}</span></Link>
          <button className="ap-link" onClick={logout}><LogOut size={18} /><span>{t('logout')}</span></button>
        </div>
      </aside>
      {open && <div className="ap-scrim" onClick={close} aria-hidden="true" />}

      <div className="ap-main">
        <header className="ap-top">
          <button className="ap-iconbtn ap-only-mobile" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} /></button>
          <h1 className="ap-title">{title}</h1>
          <div className="ap-top-right">
            <span className={`ap-live ${realtime ? 'on' : ''}`} title={updatedAt ? relTime(new Date(updatedAt).toISOString(), now, t) : ''}>
              <i />{realtime ? t('tp_live_rt') : t('tp_live_poll')}
            </span>
            <button className="ap-iconbtn" onClick={refresh} aria-label={t('tp_refresh')} title={t('tp_refresh')}><RefreshCw size={17} /></button>
            <div className="lang-switch" role="group" aria-label="Language">
              {LANGS.map((l) => <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
            </div>
            <button className="theme-toggle" onClick={toggle} aria-label={t('theme_toggle')} title={t('theme_toggle')}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="ap-user" title={user?.email}><b>{initials(profile || user)}</b><span>{profile?.name || user?.email}</span></span>
          </div>
        </header>

        <div className="ap-content">
          {!isSupabase && <DemoBanner>{t('tp_demo_note')}</DemoBanner>}
          {raw?.missingMigration && (
            <div className="ap-warn" role="alert"><TriangleAlert size={18} /><span>{t('tp_migration_warn')}</span></div>
          )}
          {loading && !model ? <Loader text={t('loading')} />
            : error ? <ErrorBox onRetry={reload} message={error?.message} />
              : <Outlet />}
        </div>
      </div>
    </div>
  );
}
