import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsApi } from '../api';

interface ContactSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactSearchModal({ isOpen, onClose }: ContactSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await contactsApi.searchQuick(query, 10);
        setResults(res.data);
      } catch (err) {
        console.error('Failed to quick search contacts', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelectContact = (id: number) => {
    onClose();
    navigate(`/contacts/${id}`);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          backgroundColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, color: '#64748b' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type contact name, email, mobile or USI..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 16,
              color: '#0f172a',
            }}
          />
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
          {loading && <div style={{ padding: '16px 20px', color: '#64748b', fontSize: 13 }}>Searching contacts...</div>}

          {!loading && query.trim() && results.length === 0 && (
            <div style={{ padding: '16px 20px', color: '#94a3b8', fontSize: 13 }}>No contacts matching "{query}"</div>
          )}

          {!loading && results.map((c) => {
            const fullName = [c.givenName, c.surname].filter(Boolean).join(' ') || 'Unnamed Contact';
            return (
              <div
                key={c.id}
                onClick={() => handleSelectContact(c.id)}
                style={{
                  padding: '12px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                    {fullName} <span style={{ fontWeight: 400, color: '#64748b' }}>({c.emailAddress || 'No email'})</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>Mobile: {c.mobilePhone || '-'}</span>
                    <span>USI: {c.usi || '-'}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>
                  ID: {c.contactId < 900000000 ? c.contactId : 'Local'}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#64748b', textAlign: 'right' }}>
          Select a contact to open full details profile
        </div>
      </div>
    </div>
  );
}
