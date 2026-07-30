import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isTrainerOrAbove = user?.role === 'SUPER_USER' || user?.role === 'ADMIN' || user?.role === 'TRAINER';
  const isAdminOrAbove = user?.role === 'SUPER_USER' || user?.role === 'ADMIN';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#0f172a' }}>Dashboard</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Welcome back, {user?.name || user?.email} ({user?.role?.replace('_', ' ')})</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {/* Student Details Card */}
        <div style={cardStyle}>
          <div style={iconBadgeStyle}>📋</div>
          <h3 style={{ margin: '12px 0 6px 0', fontSize: 18, color: '#0f172a' }}>My Student Details</h3>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, flex: 1 }}>
            View and manage your personal details, USI, contact info, and AVETMISS enrolment information.
          </p>
          <button style={buttonStyle} onClick={() => navigate('/my-details')}>
            Edit Student Details →
          </button>
        </div>

        {/* User Account Profile Card */}
        <div style={cardStyle}>
          <div style={iconBadgeStyle}>👤</div>
          <h3 style={{ margin: '12px 0 6px 0', fontSize: 18, color: '#0f172a' }}>User Profile & Security</h3>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, flex: 1 }}>
            Update your account credentials, change password, or connect/resync your Axcelerate account.
          </p>
          <button style={buttonStyle} onClick={() => navigate('/profile')}>
            Manage Profile →
          </button>
        </div>

        {/* Trainer / Admin Navigation Cards */}
        {isTrainerOrAbove && (
          <div style={cardStyle}>
            <div style={iconBadgeStyle}>📅</div>
            <h3 style={{ margin: '12px 0 6px 0', fontSize: 18, color: '#0f172a' }}>My Trainer Calendar</h3>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, flex: 1 }}>
              View upcoming training workshops, mark student attendance, and complete observation checklists.
            </p>
            <button style={buttonStyle} onClick={() => navigate('/my-calendar')}>
              Open Calendar →
            </button>
          </div>
        )}

        {isAdminOrAbove && (
          <div style={cardStyle}>
            <div style={iconBadgeStyle}>🗓️</div>
            <h3 style={{ margin: '12px 0 6px 0', fontSize: 18, color: '#0f172a' }}>Admin Calendar</h3>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, flex: 1 }}>
              Manage all scheduled workshops across all trainers and locations.
            </p>
            <button style={buttonStyle} onClick={() => navigate('/admin-calendar')}>
              Open Admin Calendar →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 12,
  padding: 24,
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  display: 'flex',
  flexDirection: 'column',
};

const iconBadgeStyle: React.CSSProperties = {
  fontSize: 28,
  width: 44,
  height: 44,
  borderRadius: 8,
  background: '#f1f5f9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const buttonStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  padding: '10px 16px',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  textAlign: 'center',
};
