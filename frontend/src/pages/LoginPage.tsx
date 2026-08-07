import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import './Login.css';

export function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as {
    from?: { pathname: string };
    email?: string;
    step?: 'credentials' | 'mfa' | 'forgot';
    infoMsg?: string;
  } | null;
  const from = locState?.from?.pathname ?? '/dashboard';

  const [step, setStep] = useState<'credentials' | 'mfa' | 'forgot'>(locState?.step ?? 'credentials');
  const [email, setEmail] = useState(locState?.email ?? '');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg] = useState(locState?.infoMsg ?? '');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.requiresMfa) {
        setStep('mfa');
      } else {
        // Trusted device - logged in directly without MFA
        navigate(from, { replace: true });
      }
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyMfa(email, mfaCode, trustDevice);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSuccessMsg(res.data.message || 'If your email exists in our system, you will receive a reset email.');
    } catch {
      setError('Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img
            className="login-logo-image"
            src="https://lifesavingfirstaid.com.au/wp-content/uploads/2019/08/RTO-test2.svg?t=1784182630"
            alt="Life Saving First Aid logo"
          />
        </div>
        <div className="login-tagline">LSFA Central</div>

        {step === 'credentials' && (
          <form onSubmit={handleLogin}>
            <h2>Sign in</h2>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Continue'}
            </button>
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setError('');
                  setSuccessMsg('');
                  setStep('forgot');
                }}
              >
                Forgotten password?
              </button>
            </div>
          </form>
        )}

        {step === 'mfa' && (
          <form onSubmit={handleMfa}>
            <h2>Verification code</h2>
            {infoMsg && <div className="login-success" style={{ marginBottom: 12 }}>{infoMsg}</div>}
            <p className="mfa-hint">A 6-digit code has been sent to <strong>{email}</strong></p>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group">
              <label>Code</label>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
              />
            </div>
            <div className="form-group-checkbox" style={{ margin: '14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="trustDevice"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="trustDevice" style={{ fontSize: 13, color: '#334155', cursor: 'pointer', margin: 0 }}>
                Trust this device for 7 days
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" className="btn-link" onClick={() => setStep('credentials')}>
              ← Back
            </button>
          </form>
        )}

        {step === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <h2>Forgotten Password</h2>
            <p className="mfa-hint">
              Enter your email address. If it exists in our system, you will be sent a password reset link and verification code via email.
            </p>
            {error && <div className="login-error">{error}</div>}
            {successMsg && <div className="login-success" style={{ padding: '10px 12px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>{successMsg}</div>}
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Email'}
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setError('');
                setSuccessMsg('');
                setStep('credentials');
              }}
            >
              ← Back to Sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
