import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api';

interface Trainer {
  id: number;
  name: string;
  email: string;
  axcelerateContactId: string | null;
}

export function TrainerPortalPage() {
  const { impersonate } = useAuth();
  const navigate = useNavigate();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.listTrainers()
      .then((res) => setTrainers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleImpersonate = async (t: Trainer) => {
    await impersonate(t.id, t.name, t.axcelerateContactId);
    navigate('/my-calendar');
  };

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Trainer Portal</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Select a trainer to view their calendar and workshops.
      </p>
      {loading ? (
        <p>Loading trainers...</p>
      ) : trainers.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No trainers found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 440 }}>
          {trainers.map((t) => (
            <div
              key={t.id}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {t.email}
                  {t.axcelerateContactId && <span style={{ marginLeft: 6 }}>· ID: {t.axcelerateContactId}</span>}
                </div>
              </div>
              <button
                onClick={() => handleImpersonate(t)}
                style={{
                  background: '#1a1a2e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                View as Trainer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
