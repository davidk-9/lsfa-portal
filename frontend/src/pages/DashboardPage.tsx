import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>Welcome back, {user?.email}</p>
    </div>
  );
}
