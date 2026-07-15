import {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, ImpersonationInfo } from '../types/auth';
import { authApi } from '../api';

interface AuthContextType {
  user: AuthUser | null;
  impersonation: ImpersonationInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requiresMfa: boolean; email: string }>;
  verifyMfa: (email: string, code: string) => Promise<void>;
  logout: () => void;
  impersonate: (trainerId: number, trainerName: string, trainerAxcelerateContactId: string | null) => Promise<void>;
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((res) => {
        setUser(res.data);
        const imp = localStorage.getItem('impersonation');
        if (imp) setImpersonation(JSON.parse(imp));
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    return res.data as { requiresMfa: boolean; email: string };
  };

  const verifyMfa = async (email: string, code: string) => {
    const res = await authApi.verifyMfa(email, code);
    const { accessToken, user: userData } = res.data;
    localStorage.setItem('token', accessToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('impersonation');
    setUser(null);
    setImpersonation(null);
  };

  const impersonate = async (trainerId: number, trainerName: string, trainerAxcelerateContactId: string | null) => {
    const res = await authApi.impersonate(trainerId);
    localStorage.setItem('token', res.data.accessToken);
    const imp = { id: trainerId, name: trainerName, axcelerateContactId: trainerAxcelerateContactId };
    localStorage.setItem('impersonation', JSON.stringify(imp));
    setImpersonation(imp);
    const meRes = await authApi.me();
    setUser(meRes.data);
  };

  const stopImpersonating = async () => {
    const res = await authApi.stopImpersonating();
    localStorage.setItem('token', res.data.accessToken);
    localStorage.removeItem('impersonation');
    setImpersonation(null);
    const meRes = await authApi.me();
    setUser(meRes.data);
  };

  return (
    <AuthContext.Provider value={{ user, impersonation, loading, login, verifyMfa, logout, impersonate, stopImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
