import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ImpersonationBanner } from './ImpersonationBanner';
import './AppLayout.css';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSuperOrAdmin = user?.role === 'SUPER_USER' || user?.role === 'ADMIN';
  const isSuperUser = user?.role === 'SUPER_USER';

  return (
    <div className="app-layout">
      <ImpersonationBanner />
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img
              className="sidebar-logo-image"
              src="https://lifesavingfirstaid.com.au/wp-content/uploads/2019/08/RTO-test2.svg?t=1784182630"
              alt="Life Saving First Aid logo"
            />
            <div className="sidebar-brand-text">
              <div className="sidebar-logo">LSFA Central</div>
              <div className="sidebar-role">{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {isSuperOrAdmin && (
            <>
              <div className="nav-section-label">Administration</div>
              <NavLink to="/admin-calendar" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Admin Calendar
              </NavLink>
              <NavLink to="/trainers" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Trainer Portal
              </NavLink>
            </>
          )}

          <div className="nav-section-label">Trainer</div>
          <NavLink to="/my-calendar" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            My Calendar
          </NavLink>

          {isSuperUser && (
            <>
              <div className="nav-section-label">System</div>
              <NavLink to="/users" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                User Management
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Settings
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-name">{user?.email}</div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
