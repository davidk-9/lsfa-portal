import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../api';
import './Login.css';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const initialEmail = searchParams.get('email') ?? '';

  const [mfaCode, setMfaCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token from link');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword(token, mfaCode, newPassword);
      const { accessToken } = res.data;
      localStorage.setItem('token', accessToken);
      // Auto redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please check your verification code.';
      setError(msg);
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

        <form onSubmit={handleSubmit}>
          <h2>Set New Password</h2>
          {initialEmail && (
            <p className="mfa-hint" style={{ marginBottom: 16 }}>
              Resetting password for <strong>{initialEmail}</strong>
            </p>
          )}

          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label>Verification Code (sent via email)</label>
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

          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Updating...' : 'Set Password & Sign In'}
          </button>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Link to="/login" className="btn-link">
              ← Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
