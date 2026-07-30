import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { profileApi, contactsApi, usersApi } from '../api';
import { useNavigate } from 'react-router-dom';

export function UserProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [syncingAxcelerate, setSyncingAxcelerate] = useState(false);
  const [lookingUpAx, setLookingUpAx] = useState(false);

  // Profile Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [axcelerateContactId, setAxcelerateContactId] = useState('');
  const [contactSummary, setContactSummary] = useState<any>(null);

  // Password Form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await profileApi.getProfile();
      const p = res.data;
      setName(p.name || '');
      setEmail(p.email || '');
      setAxcelerateContactId(p.axcelerateContactId || '');
      setContactSummary(p.contact || null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await profileApi.updateProfile({ name, email, axcelerateContactId });
      toast.success('Profile updated successfully');
      loadProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await profileApi.changePassword({ newPassword });
      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLookupAxcelerate = async () => {
    if (!email) {
      toast.error('Please enter an email address first');
      return;
    }
    setLookingUpAx(true);
    try {
      const res = await usersApi.lookupAxcelerateContact(email);
      if (res.data?.contactId) {
        setAxcelerateContactId(String(res.data.contactId));
        toast.success(`Found Axcelerate Contact: ${res.data.contactName} (${res.data.contactId})`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No Axcelerate contact found for email');
    } finally {
      setLookingUpAx(false);
    }
  };

  const handleSyncAxcelerate = async () => {
    setSyncingAxcelerate(true);
    try {
      const axId = axcelerateContactId ? parseInt(axcelerateContactId, 10) : undefined;
      await contactsApi.syncAxcelerate(axId);
      toast.success('Contact details successfully synced from Axcelerate!');
      loadProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to sync with Axcelerate');
    } finally {
      setSyncingAxcelerate(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: '#64748b' }}>Loading profile...</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#0f172a' }}>User Profile & Account</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Manage your personal account settings, credentials, and system links.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Account Details Card */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Account Information</h2>
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Role</label>
                <input style={{ ...inputStyle, background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} value={user?.role?.replace('_', ' ') || ''} disabled />
              </div>
              <div>
                <label style={labelStyle}>User ID</label>
                <input style={{ ...inputStyle, background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} value={`#${user?.id}`} disabled />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" style={primaryButtonStyle} disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Security & Password Reset</h2>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>New Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" style={primaryButtonStyle} disabled={savingPassword}>
                {savingPassword ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Axcelerate & Contact Linking Card */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Axcelerate Integration & Student Details Link</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: -8, marginBottom: 16 }}>
            Link your account to your Axcelerate Contact ID to keep your contact details in sync with our system.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Axcelerate Contact ID</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="e.g. 14501972"
                  value={axcelerateContactId}
                  onChange={(e) => setAxcelerateContactId(e.target.value)}
                />
                <button type="button" onClick={handleLookupAxcelerate} style={secondaryButtonStyle} disabled={lookingUpAx}>
                  {lookingUpAx ? 'Searching...' : 'Find by Email'}
                </button>
                <button type="button" onClick={handleSyncAxcelerate} style={secondaryButtonStyle} disabled={syncingAxcelerate}>
                  {syncingAxcelerate ? 'Syncing...' : 'Sync from Axcelerate'}
                </button>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>Linked Student / Contact Record</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                  {contactSummary ? (
                    <>Connected to <strong>{contactSummary.givenName} {contactSummary.surname}</strong> (Axcelerate ID: #{contactSummary.contactId})</>
                  ) : (
                    'No contact record currently linked.'
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/my-details')}
                style={primaryButtonStyle}
              >
                Edit My Student Details →
              </button>
            </div>
          </div>
        </div>
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
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: '#0f172a',
  marginBottom: 16,
  marginTop: 0,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box',
};

const primaryButtonStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  padding: '10px 16px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: '#f1f5f9',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  padding: '10px 14px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};