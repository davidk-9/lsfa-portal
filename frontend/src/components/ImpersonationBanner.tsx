import { useAuth } from '../context/AuthContext';

export function ImpersonationBanner() {
  const { impersonation, stopImpersonating } = useAuth();
  if (!impersonation) return null;

  return (
    <div style={{
      background: '#f59e0b',
      color: '#1c1917',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '14px',
      fontWeight: 500,
    }}>
      <span>
        👁 Viewing as <strong>{impersonation.name}</strong> (Trainer)
      </span>
      <button
        onClick={stopImpersonating}
        style={{
          background: '#1c1917',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 12px',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        Exit Impersonation
      </button>
    </div>
  );
}
