import { useAuth } from '../context/AuthContext';

export function ImpersonationBanner() {
  const { impersonation, stopImpersonating } = useAuth();
  if (!impersonation) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 120,
        width: '100%',
        background: 'linear-gradient(90deg, rgb(205, 41, 150), rgb(164, 33, 120))',
        color: '#fff',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '14px',
        fontWeight: 600,
        boxShadow: '0 2px 10px rgba(75, 47, 61, 0.16)',
      }}
    >
      <span>
        👁 Viewing as <strong>{impersonation.name}</strong> (Trainer)
      </span>
      <button
        onClick={stopImpersonating}
        style={{
          background: '#fff',
          color: 'rgb(205, 41, 150)',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 700,
        }}
      >
        Exit Impersonation
      </button>
    </div>
  );
}
