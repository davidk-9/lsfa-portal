import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ImpersonationBanner } from './ImpersonationBanner';
import siteIcon from '../assets/siteicon.png';
import './AppLayout.css';

function getSidebarLinkClassName(isActive: boolean, collapsed: boolean) {
  return ['nav-link', collapsed ? 'nav-link-collapsed' : '', isActive ? 'active' : ''].filter(Boolean).join(' ');
}

function AdminCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M8 14h2" />
      <path d="M12 14h4" />
    </svg>
  );
}

function TrainerPortalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M7 13c1.2-1 2.8-1.5 5-1.5s3.8.5 5 1.5" />
      <path d="M16 6.5h2" />
    </svg>
  );
}

function MyCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l2.5 2.5" />
      <path d="M4 12h2" />
      <path d="M18 12h2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 19a4 4 0 0 0-8 0" />
      <circle cx="12" cy="8" r="3.5" />
      <path d="M20 19a3 3 0 0 0-2-2.8" />
      <path d="M6 16.2A3 3 0 0 0 4 19" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7.1 7.1 0 0 0-.1-1.1l2-1.6-2-3.5-2.4 1a7.6 7.6 0 0 0-1.9-1.1L14 2h-4l-.6 2.7a7.6 7.6 0 0 0-1.9 1.1l-2.4-1-2 3.5 2 1.6a7.1 7.1 0 0 0-.1 1.1 7.1 7.1 0 0 0 .1 1.1l-2 1.6 2 3.5 2.4-1a7.6 7.6 0 0 0 1.9 1.1L10 22h4l.6-2.7a7.6 7.6 0 0 0 1.9-1.1l2.4 1 2-3.5-2-1.6c.1-.4.1-.7.1-1.1Z" />
    </svg>
  );
}

function SchedulerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M4 9h16" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M8 13h2" />
      <path d="M12 13h4" />
      <path d="M8 17h8" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17l-1.4-1.4 2.6-2.6H3v-2h8.2l-2.6-2.6L10 7l5 5-5 5Z" />
      <path d="M19 4h-8v2h8v12h-8v2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14 7-5 5 5 5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m10 7 5 5-5 5" />
    </svg>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('lsfa-sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem('lsfa-sidebar-collapsed', collapsed ? 'true' : 'false');
  }, [collapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSuperOrAdmin = user?.role === 'SUPER_USER' || user?.role === 'ADMIN';
  const isSuperUser = user?.role === 'SUPER_USER';

  return (
    <div className="app-layout">
      <div className="app-shell">
        <ImpersonationBanner />
        <div className="app-content">
          <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="sidebar-header">
              <div className={`sidebar-brand ${collapsed ? 'sidebar-brand-collapsed' : ''}`}>
                <img className="sidebar-logo-image" src={siteIcon} alt="Life Saving First Aid logo" />
                {!collapsed && (
                  <div className="sidebar-brand-text">
                    <div className="sidebar-logo">LSFA Central</div>
                    <div className="sidebar-role">{user?.role?.replace('_', ' ')}</div>
                  </div>
                )}
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={() => setCollapsed((value) => !value)}
                  title={collapsed ? 'Expand menu' : 'Collapse menu'}
                  aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
                >
                  {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                </button>
              </div>
            </div>

            <nav className="sidebar-nav">
              {isSuperOrAdmin && (
                <>
                  <div className="nav-section-label">{collapsed ? 'ADM' : 'Administration'}</div>
                  <NavLink to="/admin-calendar" className={({ isActive }) => getSidebarLinkClassName(isActive, collapsed)} title="Admin Calendar">
                    <span className="nav-link-icon"><AdminCalendarIcon /></span>
                    {!collapsed && <span className="nav-link-label">Admin Calendar</span>}
                  </NavLink>
                  <NavLink to="/trainers" className={({ isActive }) => getSidebarLinkClassName(isActive, collapsed)} title="Trainer Portal">
                    <span className="nav-link-icon"><TrainerPortalIcon /></span>
                    {!collapsed && <span className="nav-link-label">Trainer Portal</span>}
                  </NavLink>
                </>
              )}

              <div className="nav-section-label">{collapsed ? 'TRN' : 'Trainer'}</div>
              <NavLink to="/my-calendar" className={({ isActive }) => getSidebarLinkClassName(isActive, collapsed)} title="My Calendar">
                <span className="nav-link-icon"><MyCalendarIcon /></span>
                {!collapsed && <span className="nav-link-label">My Calendar</span>}
              </NavLink>

              {isSuperUser && (
                <>
                  <div className="nav-section-label">{collapsed ? 'SYS' : 'System'}</div>
                  <NavLink to="/users" className={({ isActive }) => getSidebarLinkClassName(isActive, collapsed)} title="User Management">
                    <span className="nav-link-icon"><UsersIcon /></span>
                    {!collapsed && <span className="nav-link-label">User Management</span>}
                  </NavLink>
                  <NavLink to="/settings" className={({ isActive }) => getSidebarLinkClassName(isActive, collapsed)} title="Settings">
                    <span className="nav-link-icon"><SettingsIcon /></span>
                    {!collapsed && <span className="nav-link-label">Settings</span>}
                  </NavLink>
                  <NavLink to="/bulk-scheduler" className={({ isActive }) => getSidebarLinkClassName(isActive, collapsed)} title="Bulk Scheduler">
                    <span className="nav-link-icon"><SchedulerIcon /></span>
                    {!collapsed && <span className="nav-link-label">Bulk Scheduler</span>}
                  </NavLink>
                </>
              )}
            </nav>

            <div className="sidebar-footer">
              {!collapsed ? (
                <>
                  <div className="sidebar-user-name">{user?.email}</div>
                  <button className="logout-btn" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              ) : (
                <button className="logout-btn logout-btn-collapsed" onClick={handleLogout} title="Logout" aria-label="Logout">
                  <LogoutIcon />
                </button>
              )}
            </div>
          </aside>

          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
