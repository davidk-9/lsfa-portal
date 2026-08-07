import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { usersApi } from '../api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  axcelerateContactId?: string | null;
}

interface UserForm {
  name: string;
  email: string;
  role: string;
  password: string;
  axcelerateContactId: string;
}

const emptyForm = (): UserForm => ({
  name: '',
  email: '',
  role: 'TRAINER',
  password: '',
  axcelerateContactId: '',
});

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [lookingUpContact, setLookingUpContact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [magicLinkModal, setMagicLinkModal] = useState<{
    open: boolean;
    user: User | null;
    data?: { fullMagicLink: string; axcelerateSynced: boolean; axcelerateContactId?: number | null };
  } | null>(null);

  const handleGenerateMagicLink = async (u: User) => {
    setBusyId(u.id);
    setError(null);
    try {
      const res = await usersApi.generateMagicLink(u.id);
      setMagicLinkModal({
        open: true,
        user: u,
        data: res.data,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to generate magic link.');
    } finally {
      setBusyId(null);
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = async (p: number, s: string, r: string, st: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.getPaginated(p, 20, s, r, st);
      setUsers(res.data.data);
      setTotal(res.data.total);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    } catch (err: any) {
      setError('Unable to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, search, selectedRole, status);
  }, [page, search, selectedRole, status]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setSelectedRole('');
    setStatus('active');
    setPage(1);
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      axcelerateContactId: user.axcelerateContactId ?? '',
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm());
    setError(null);
  };

  const handleChange = (field: keyof UserForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const lookupContact = async () => {
    if (!form.email.trim()) {
      setError('Enter an email address before looking up the Axcelerate contact.');
      return;
    }

    setLookingUpContact(true);
    setError(null);

    try {
      const res = await usersApi.lookupAxcelerateContact(form.email.trim());
      setForm((prev) => ({ ...prev, axcelerateContactId: res.data.contactId ?? '' }));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to find an Axcelerate contact for that email.');
    } finally {
      setLookingUpContact(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        role: form.role,
        axcelerateContactId: form.axcelerateContactId || undefined,
      };

      if (editingUser) {
        await usersApi.update(editingUser.id, payload);
      } else {
        await usersApi.create({
          ...payload,
          email: form.email,
          password: form.password,
        });
      }

      closeModal();
      fetchUsers(page, search, selectedRole, status);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (user: User) => {
    setBusyId(user.id);
    setError(null);

    try {
      if (user.isActive) {
        await usersApi.archive(user.id);
      } else {
        await usersApi.restore(user.id);
      }
      fetchUsers(page, search, selectedRole, status);
    } catch (err: any) {
      setError(err.response?.data?.message || `Unable to ${user.isActive ? 'archive' : 'restore'} user.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>User Management</h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Create, update, and archive users without deleting them ({total.toLocaleString()} total).
          </p>
        </div>
        <button type="button" onClick={openCreate} style={primaryButton}>Add User</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 400 }}>
          <input
            type="text"
            placeholder="Search by name, email, or user ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        <select
          value={selectedRole}
          onChange={(e) => {
            setSelectedRole(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 14,
            background: '#ffffff',
          }}
        >
          <option value="">All Roles</option>
          <option value="SUPER_USER">Super User</option>
          <option value="ADMIN">Admin</option>
          <option value="TRAINER">Trainer</option>
          <option value="STUDENT">Student</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 14,
            background: '#ffffff',
          }}
        >
          <option value="active">Active Only</option>
          <option value="inactive">Archived / Inactive Only</option>
          <option value="all">All Users</option>
        </select>

        {(searchInput || selectedRole || status !== 'active') && (
          <button
            type="button"
            onClick={handleClearFilters}
            style={{
              padding: '8px 16px',
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {error ? <div style={errorBox}>{error}</div> : null}

      {loading ? (
        <div style={{ padding: 24, color: '#64748b' }}>Loading users...</div>
      ) : users.length === 0 ? (
        <div style={{ padding: 24, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', color: '#64748b' }}>
          No users found matching your search or filters.
        </div>
      ) : (
        <>
          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>{u.name}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 12,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: roleColor(u.role),
                      color: '#fff',
                    }}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ color: u.isActive ? '#16a34a' : '#dc2626', fontSize: 13 }}>
                      {u.isActive ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => openEdit(u)} style={secondaryButton}>Edit</button>
                      <button
                        type="button"
                        onClick={() => handleGenerateMagicLink(u)}
                        style={{ ...secondaryButton, background: '#f0f9ff', color: '#0284c7', borderColor: '#bae6fd' }}
                        disabled={busyId === u.id}
                      >
                        {busyId === u.id ? 'Working...' : 'Magic Link'}
                      </button>
                      <button type="button" onClick={() => toggleArchive(u)} style={dangerButton} disabled={busyId === u.id}>
                        {busyId === u.id ? 'Working...' : u.isActive ? 'Archive' : 'Restore'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Page {page} of {totalPages} ({total.toLocaleString()} records)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  background: page <= 1 ? '#f1f5f9' : '#ffffff',
                  color: page <= 1 ? '#94a3b8' : '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                &larr; Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                  color: page >= totalPages ? '#94a3b8' : '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </>
    )}

      {modalOpen ? (
        <div style={modalOverlay} onClick={closeModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>{editingUser ? 'Edit User' : 'Add User'}</h2>
              <button type="button" onClick={closeModal} style={secondaryButton}>Close</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: 12 }}>
                <label>
                  <div style={label}>Name</div>
                  <input value={form.name} onChange={handleChange('name')} required style={input} />
                </label>

                <label>
                  <div style={label}>Email</div>
                  <input value={form.email} onChange={handleChange('email')} type="email" required={!editingUser} disabled={Boolean(editingUser)} style={input} />
                </label>

                {!editingUser ? (
                  <label>
                    <div style={label}>Temporary Password</div>
                    <input value={form.password} onChange={handleChange('password')} type="password" required style={input} />
                  </label>
                ) : null}

                <label>
                  <div style={label}>Role</div>
                  <select value={form.role} onChange={handleChange('role')} style={input}>
                    <option value="SUPER_USER">Super User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="TRAINER">Trainer</option>
                    <option value="STUDENT">Student</option>
                  </select>
                </label>

                <label>
                  <div style={label}>Axcelerate Contact ID</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={form.axcelerateContactId} onChange={handleChange('axcelerateContactId')} style={{ ...input, flex: 1 }} />
                    <button type="button" onClick={lookupContact} style={secondaryButton} disabled={lookingUpContact}>
                      {lookingUpContact ? 'Looking up...' : 'Find by Email'}
                    </button>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button type="button" onClick={closeModal} style={secondaryButton}>Cancel</button>
                <button type="submit" style={primaryButton} disabled={saving}>
                  {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {magicLinkModal?.open && magicLinkModal.user && magicLinkModal.data ? (
        <div style={modalOverlay} onClick={() => setMagicLinkModal(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Magic Link</h2>
              <button type="button" onClick={() => setMagicLinkModal(null)} style={secondaryButton}>Close</button>
            </div>

            <p style={{ fontSize: 14, color: '#334155', marginBottom: 16 }}>
              Magic link generated for <strong>{magicLinkModal.user.name}</strong> ({magicLinkModal.user.email}).
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Full Magic Link URL
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={magicLinkModal.data.fullMagicLink}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(magicLinkModal.data!.fullMagicLink);
                    alert('Magic link copied to clipboard!');
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Copy Link
                </button>
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 6, background: magicLinkModal.data.axcelerateSynced ? '#f0fdf4' : '#fffbe2', border: `1px solid ${magicLinkModal.data.axcelerateSynced ? '#bbf7d0' : '#fde68a'}`, fontSize: 13 }}>
              {magicLinkModal.data.axcelerateSynced ? (
                <span style={{ color: '#166534' }}>
                  ✓ Successfully written to Axcelerate contact custom field (<code>u_lsfalink</code>) for contact #{magicLinkModal.data.axcelerateContactId}.
                </span>
              ) : magicLinkModal.data.axcelerateContactId ? (
                <span style={{ color: '#854d0e' }}>
                  ⚠️ Magic link saved locally, but Axcelerate sync could not be completed for contact #{magicLinkModal.data.axcelerateContactId}.
                </span>
              ) : (
                <span style={{ color: '#64748b' }}>
                  ℹ️ User is not linked to an Axcelerate contact, so link was saved in local database only.
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' };
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 14 };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' };
const primaryButton: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 6, cursor: 'pointer' };
const secondaryButton: React.CSSProperties = { background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: 6, cursor: 'pointer' };
const dangerButton: React.CSSProperties = { background: '#dc2626', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 6, cursor: 'pointer' };
const errorBox: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: 6, marginBottom: 16 };
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1000 };
const modalCard: React.CSSProperties = { background: '#fff', width: '100%', maxWidth: 560, borderRadius: 12, padding: 24, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' };
const roleColor = (role: string) => ({ SUPER_USER: '#7c3aed', ADMIN: '#2563eb', TRAINER: '#0891b2', STUDENT: '#059669' }[role] ?? '#64748b');
