import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message }]);
      const ttl = type === 'error' ? 6500 : 4000;
      window.setTimeout(() => remove(id), ttl);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={containerStyle} aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{ ...toastStyle, ...toneStyle[t.type] }}
            role={t.type === 'error' ? 'alert' : 'status'}
            onClick={() => remove(t.id)}
            title="Dismiss"
          >
            <span style={{ marginRight: 8 }}>{icon[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const icon: Record<ToastType, string> = { success: '✓', error: '⚠', info: 'ℹ' };

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 100002,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxWidth: 380,
};

const toastStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '11px 14px',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,.18)',
  fontSize: 14,
  lineHeight: 1.4,
  cursor: 'pointer',
  border: '1px solid',
};

const toneStyle: Record<ToastType, React.CSSProperties> = {
  success: { background: '#dcfce7', borderColor: '#86efac', color: '#166534' },
  error: { background: '#fee2e2', borderColor: '#fca5a5', color: '#991b1b' },
  info: { background: '#dbeafe', borderColor: '#93c5fd', color: '#1e40af' },
};
