import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { contactsApi } from '../api';
import { validateStudentOnboarding, type OnboardingValidationResult } from '../utils/onboardingValidation';
import { MyDetailsPage } from '../pages/MyDetailsPage';

interface Props {
  children: ReactNode;
}

const AXCELERATE_LEARNER_URL = 'https://lifesavingfirstaid.app.axcelerate.com/learner';

export function StudentOnboardingGuard({ children }: Props) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<any>(null);
  const [validation, setValidation] = useState<OnboardingValidationResult | null>(null);
  const [step, setStep] = useState<'checking' | 'incomplete' | 'learning_intro' | 'complete'>('checking');

  useEffect(() => {
    if (user && user.role === 'STUDENT') {
      checkStatus();
    } else {
      setStep('complete');
      setLoading(false);
    }
  }, [user]);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await contactsApi.getMyContact();
      const contactData = res.data || {};
      setContact(contactData);

      const valResult = validateStudentOnboarding(contactData);
      setValidation(valResult);

      if (!valResult.isComplete) {
        setStep('incomplete');
      } else {
        // If already dismissed in session, or completed before, go to complete
        const introDismissed = sessionStorage.getItem(`onboarding_intro_dismissed_${user?.id}`);
        if (!introDismissed && sessionStorage.getItem(`onboarding_just_completed_${user?.id}`)) {
          setStep('learning_intro');
        } else {
          setStep('complete');
        }
      }
    } catch (err) {
      console.error('Failed to load student contact for onboarding check:', err);
      // In case of error, default to complete so student is not completely blocked if API fails
      setStep('complete');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSaved = async () => {
    // Re-check status after saving
    try {
      const res = await contactsApi.getMyContact();
      const updatedContact = res.data || {};
      setContact(updatedContact);
      const valResult = validateStudentOnboarding(updatedContact);
      setValidation(valResult);

      if (valResult.isComplete) {
        if (user?.id) {
          sessionStorage.setItem(`onboarding_just_completed_${user.id}`, 'true');
        }
        setStep('learning_intro');
      }
    } catch (err) {
      console.error('Failed to re-verify contact:', err);
    }
  };

  const handleDismissIntro = () => {
    if (user?.id) {
      sessionStorage.setItem(`onboarding_intro_dismissed_${user.id}`, 'true');
    }
    setStep('complete');
  };

  if (loading || step === 'checking') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748b' }}>
        Verifying student enrolment checklist...
      </div>
    );
  }

  // ── Step 1: Locked-down Onboarding Form ─────────────────────────────────────
  if (step === 'incomplete') {
    return (
      <div style={overlayStyle}>
        <div style={lockdownHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="https://lifesavingfirstaid.com.au/wp-content/uploads/2019/08/RTO-test2.svg?t=1784182630"
              alt="LSFA Logo"
              style={{ height: 32 }}
            />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>LSFA Central &bull; Student Onboarding Checklist</span>
          </div>
          <button type="button" onClick={logout} style={logoutButtonStyle}>
            Sign Out / Exit
          </button>
        </div>

        <div style={{ maxWidth: 1000, margin: '24px auto', padding: '0 20px', paddingBottom: 60 }}>
          <div style={alertBannerStyle}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#991b1b' }}>Required Student Details Outstanding</h3>
            <p style={{ margin: 0, fontSize: 14, color: '#7f1d1d', lineHeight: 1.5 }}>
              Before you can access LSFA Central, government compliance rules require us to collect and verify your complete enrolment and AVETMISS information. Please fill out all required fields below and click <strong>Save Details</strong> to continue.
            </p>
            {validation && validation.missingFields.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #fca5a5' }}>
                <strong style={{ fontSize: 13, color: '#991b1b' }}>Missing Required Fields ({validation.missingFields.length}):</strong>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: 20, fontSize: 13, color: '#991b1b' }}>
                  {validation.missingFields.map((f, idx) => (
                    <li key={idx}>
                      {f.label} <span style={{ opacity: 0.8, fontSize: 12 }}>({f.tab.toUpperCase()} section)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <MyDetailsPage onSavedCallback={handleOnboardingSaved} />
        </div>
      </div>
    );
  }

  // ── Step 2: Online Learning Instructions Screen ──────────────────────────────
  if (step === 'learning_intro') {
    return (
      <div style={overlayStyle}>
        <div style={lockdownHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="https://lifesavingfirstaid.com.au/wp-content/uploads/2019/08/RTO-test2.svg?t=1784182630"
              alt="LSFA Logo"
              style={{ height: 32 }}
            />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>LSFA Central &bull; Online Learning Instructions</span>
          </div>
          <button type="button" onClick={logout} style={logoutButtonStyle}>
            Sign Out
          </button>
        </div>

        <div style={{ maxWidth: 700, margin: '60px auto', padding: '0 20px' }}>
          <div style={cardStyle}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
                Onboarding Complete!
              </h1>
              <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                Thank you for completing your enrolment details. The next step in your training is to log in to Axcelerate to complete your required online learning coursework before attending your practical workshop.
              </p>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 20, border: '1px solid #e2e8f0', marginBottom: 28 }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>How to complete your online learning:</h3>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
                <li>Click <strong>Go to Online Learning</strong> below to open the Axcelerate Learner Portal.</li>
                <li>Log in using your registered email address.</li>
                <li>Complete all required pre-course modules prior to your practical training date.</li>
              </ol>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a
                href={AXCELERATE_LEARNER_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: '#2563eb',
                  color: '#ffffff',
                  padding: '14px 20px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 16,
                  textDecoration: 'none',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                }}
              >
                Go to Online Learning &rarr;
              </a>

              <button
                type="button"
                onClick={handleDismissIntro}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '12px 20px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Return to LSFA CENTRAL
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Normal App Access ───────────────────────────────────────────────
  return <>{children}</>;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#f8fafc',
  zIndex: 9999,
  overflowY: 'auto',
};

const lockdownHeaderStyle: React.CSSProperties = {
  background: '#ffffff',
  borderBottom: '1px solid #e2e8f0',
  padding: '12px 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'sticky',
  top: 0,
  zIndex: 10000,
};

const alertBannerStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 8,
  padding: 20,
  marginBottom: 24,
};

const logoutButtonStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#dc2626',
  border: '1px solid #fca5a5',
  padding: '6px 14px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 12,
  padding: 32,
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
};
