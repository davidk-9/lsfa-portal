import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { contactsApi } from '../api';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [loadingEnrolments, setLoadingEnrolments] = useState(true);

  const isTrainerOrAbove = user?.role === 'SUPER_USER' || user?.role === 'ADMIN' || user?.role === 'TRAINER';
  const isAdminOrAbove = user?.role === 'SUPER_USER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (user) {
      loadEnrolments();
    }
  }, [user]);

  const loadEnrolments = async () => {
    setLoadingEnrolments(true);
    try {
      const res = await contactsApi.getMyEnrolments();
      setEnrolments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load enrolments for student dashboard:', err);
      setEnrolments([]);
    } finally {
      setLoadingEnrolments(false);
    }
  };

  const activeEnrolments = enrolments.filter((enr) => enr.axStatus !== 'C' && enr.isActive !== false);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#0f172a' }}>Dashboard</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Welcome back, {user?.name || user?.email} ({user?.role?.replace('_', ' ')})</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Dynamic Enrolment / Online Learning Cards */}
        {loadingEnrolments ? (
          <div style={{ ...cardStyle, background: '#f8fafc', color: '#64748b' }}>
            Loading your online learning modules...
          </div>
        ) : activeEnrolments.length === 0 ? (
          /* Default Axcelerate Online Learning Card when no active enrolments exist */
          <div style={{ ...cardStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}>
            <div style={{ ...iconBadgeStyle, background: '#e0f2fe' }}>🎓</div>
            <h3 style={{ margin: '12px 0 6px 0', fontSize: 18, color: '#0369a1' }}>Online Learning Portal</h3>
            <p style={{ color: '#0369a1', fontSize: 14, marginBottom: 20, flex: 1, lineHeight: 1.5 }}>
              Access your online learning modules in Axcelerate to complete your pre-course learning before your practical workshop.
            </p>
            <a
              href="https://lifesavingfirstaid.app.axcelerate.com/learner"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...buttonStyle,
                background: '#0284c7',
                textDecoration: 'none',
                display: 'inline-block',
                textAlign: 'center',
              }}
            >
              Go to Online Learning &rarr;
            </a>
          </div>
        ) : (
          /* Dedicated card for each active enrolment */
          activeEnrolments.map((enr) => {
            const hasLearningPlan = Boolean(enr.learningPlanId || enr.learningPlan);
            const isLmsEnabled = enr.workshopProgress?.lmsEnabled === true;
            const isLsfaLms = hasLearningPlan && isLmsEnabled;

            const code =
              enr.learningPlan?.courseCode?.code ||
              enr.courseCodeStr ||
              'HLTAID Course';
            const courseName =
              enr.learningPlan?.courseCode?.name ||
              enr.learningPlan?.title ||
              'Online Learning Module';
            const modeLabel =
              enr.learningMode === 3 ? 'DeepDive' : enr.learningMode === 2 ? 'Assessment' : `Mode ${enr.learningMode}`;

            const statusLabel = enr.axStatus === 'B' ? 'Booked'
              : enr.axStatus === 'T' ? 'Tentative'
              : enr.axStatus === 'P' ? 'Paid'
              : enr.axStatus === 'M' ? 'Moved'
              : enr.axStatus || null;

            if (isLsfaLms) {
              return (
                <div key={enr.id} style={{ ...cardStyle, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ ...iconBadgeStyle, background: '#dcfce7', color: '#166534' }}>📚</div>
                    {enr.isCompetent ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                        ✓ Competent
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                        LSFA LMS &bull; {modeLabel}
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: '12px 0 4px 0', fontSize: 18, color: '#065f46' }}>{code}</h3>
                  <p style={{ margin: '0 0 4px 0', fontSize: 13, color: '#047857', fontWeight: 500 }}>{courseName}</p>
                  
                  <div style={{ fontSize: 12, color: '#059669', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {enr.instanceId && (
                      <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        Workshop #{enr.instanceId}
                      </span>
                    )}
                    {statusLabel && (
                      <span style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>
                        Status: {statusLabel}
                      </span>
                    )}
                  </div>

                  <p style={{ color: '#047857', fontSize: 13, marginBottom: 20, flex: 1, lineHeight: 1.5 }}>
                    {enr.isCompetent
                      ? 'You have successfully completed this LMS learning plan.'
                      : `Complete your online training modules in LSFA Central. Current Score: ${enr.currentScore || 0}/${enr.possibleScore || '-'}.`}
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate(`/lms/start/${enr.id}`)}
                    style={{
                      ...buttonStyle,
                      background: '#059669',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {enr.isCompetent ? 'Review Course Material →' : 'Start / Continue Learning →'}
                  </button>
                </div>
              );
            }

            /* Axcelerate LMS Enrolment Card */
            return (
              <div key={enr.id} style={{ ...cardStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ ...iconBadgeStyle, background: '#e0f2fe', color: '#0369a1' }}>🎓</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                    Axcelerate Portal
                  </span>
                </div>

                <h3 style={{ margin: '12px 0 4px 0', fontSize: 18, color: '#0369a1' }}>{code}</h3>
                <p style={{ margin: '0 0 4px 0', fontSize: 13, color: '#0284c7', fontWeight: 500 }}>{courseName}</p>
                
                <div style={{ fontSize: 12, color: '#0284c7', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {enr.instanceId && (
                    <span style={{ background: '#e0f2fe', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                      Workshop #{enr.instanceId}
                    </span>
                  )}
                  {statusLabel && (
                    <span style={{ background: '#e0f2fe', padding: '2px 6px', borderRadius: 4 }}>
                      Status: {statusLabel}
                    </span>
                  )}
                </div>

                <p style={{ color: '#0369a1', fontSize: 13, marginBottom: 20, flex: 1, lineHeight: 1.5 }}>
                  This workshop uses Axcelerate Online Learning. Click below to access your learning modules in Axcelerate.
                </p>

                <a
                  href="https://lifesavingfirstaid.app.axcelerate.com/learner"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...buttonStyle,
                    background: '#0284c7',
                    textDecoration: 'none',
                    display: 'inline-block',
                    textAlign: 'center',
                  }}
                >
                  Go to Axcelerate Learning &rarr;
                </a>
              </div>
            );
          })
        )}

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
