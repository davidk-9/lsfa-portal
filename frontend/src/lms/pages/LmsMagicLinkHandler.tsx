import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { lmsApi } from '../services/lmsApi';

export function LmsMagicLinkHandler() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const { setSession } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initSession() {
      try {
        if (!enrollmentId) {
          setError('Invalid enrollment ID');
          return;
        }

        const data = await lmsApi.getEnrollment(enrollmentId);
        setSession(data);
        navigate('/lms/learn');
      } catch (err: any) {
        console.error('Magic link initialization failed:', err);
        setError('Failed to authenticate enrollment session. Please check your link.');
      }
    }

    initSession();
  }, [enrollmentId, setSession, navigate]);

  if (error) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
          <p style={{ fontSize: '1.25rem', color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
          <button
            type="button"
            onClick={() => navigate('/lms')}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔐</div>
        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e3a8a' }}>Authenticating magic link...</p>
      </div>
    </div>
  );
}
