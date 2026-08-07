import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import './Login.css';

export function AutoLogPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  const key = searchParams.get('key');

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    if (!key) {
      setError('Invalid or missing magic link key.');
      return;
    }

    authApi.magicLogin(key)
      .then((res) => {
        const data = res.data;
        if (data.requiresMfa) {
          navigate('/login', {
            replace: true,
            state: {
              email: data.email,
              step: 'mfa',
              infoMsg: 'Magic link authenticated! Enter the 6-digit MFA code sent to your email.',
            },
          });
        } else if (data.accessToken) {
          localStorage.setItem('token', data.accessToken);
          // Hard reload or redirect to dashboard to re-initialize AuthContext
          window.location.href = '/dashboard';
        } else {
          setError('Unexpected response from magic link login.');
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || 'Invalid, expired, or inactive magic link.';
        setError(msg);
      });
  }, [key, navigate]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="login-logo">
          <img
            className="login-logo-image"
            src="https://lifesavingfirstaid.com.au/wp-content/uploads/2019/08/RTO-test2.svg?t=1784182630"
            alt="Life Saving First Aid logo"
          />
        </div>
        <div className="login-tagline">LSFA Central</div>

        {error ? (
          <div style={{ marginTop: 20 }}>
            <h2 style={{ color: '#ef4444', marginBottom: 12 }}>Magic Link Error</h2>
            <div className="login-error" style={{ marginBottom: 20 }}>
              {error}
            </div>
            <button
              className="btn-primary"
              onClick={() => navigate('/login', { replace: true })}
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <div style={{ padding: '30px 0' }}>
            <div className="settings-loading" style={{ fontSize: 16 }}>
              Authenticating magic link... Please wait.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
