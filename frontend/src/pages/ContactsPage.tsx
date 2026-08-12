import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsApi } from '../api';

export function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);

  // Debounce search input so auto-filter happens as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchContacts = async (p: number, s: string, st: string) => {
    setLoading(true);
    try {
      const res = await contactsApi.getPaginated(p, 20, s, st);
      setContacts(res.data.data);
      setTotal(res.data.total);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error('Failed to load contacts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts(page, search, status);
  }, [page, search, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1>Student Management</h1>
          <p className="users-subtitle">Search, view, and manage all student profiles ({total.toLocaleString()} total)</p>
        </div>
      </div>

      <div className="users-filters" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 500 }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search by full name, email, mobile, USI..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-save" style={{ height: 38, padding: '0 16px' }}>
            Search
          </button>
          {searchInput && (
            <button type="button" className="btn-secondary" onClick={handleClearSearch} style={{ height: 38 }}>
              Clear
            </button>
          )}
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Status:</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, color: '#0f172a' }}
          >
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All Contacts</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: '#64748b' }}>Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div style={{ padding: 24, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', color: '#64748b' }}>
          No contacts found matching "{search}"
        </div>
      ) : (
        <>
          <div style={{ background: '#ffffff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={thStyle}>Full Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Mobile</th>
                  <th style={thStyle}>USI</th>
                  <th style={thStyle}>Linked User Account</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const fullName = [c.givenName, c.surname].filter(Boolean).join(' ') || 'Unnamed Contact';
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => navigate(`/contacts/${c.id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#2563eb',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textAlign: 'left',
                          }}
                        >
                          {fullName}
                        </button>
                      </td>
                      <td style={tdStyle}>{c.emailAddress || <span style={{ color: '#94a3b8' }}>None</span>}</td>
                      <td style={tdStyle}>{c.mobilePhone || c.phone || <span style={{ color: '#94a3b8' }}>None</span>}</td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                          {c.usi || <span style={{ color: '#94a3b8' }}>-</span>}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {c.user ? (
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                            {c.user.email} ({c.user.role})
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Unlinked</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => navigate(`/contacts/${c.id}?mode=edit`)}
                          style={{
                            background: '#f1f5f9',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            padding: '4px 12px',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Edit Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  color: '#475569',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#0f172a',
};
