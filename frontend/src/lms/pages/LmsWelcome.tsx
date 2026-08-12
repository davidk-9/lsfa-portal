import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';

export function LmsWelcome() {
  const { enrollment, student, unit } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!enrollment) {
      navigate('/lms');
    }
  }, [enrollment, navigate]);

  if (!enrollment || !student || !unit) return null;

  return (
    <div style={{ maxWidth: '42rem', margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '3rem 2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.5rem' }}>
          Welcome back, {student.firstName}!
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#4b5563', marginBottom: '2rem' }}>
          Enrolled Course: <strong>{unit.unitCode} - {unit.title}</strong>
        </p>

        <div style={{ padding: '1.5rem', backgroundColor: '#eff6ff', borderRadius: '0.75rem', border: '1px solid #bfdbfe', marginBottom: '2rem' }}>
          <p style={{ fontSize: '1rem', color: '#1e40af', lineHeight: 1.5 }}>
            To personalize your learning journey, choose the path that best matches your prior experience and schedule.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/lms/select-mode')}
          style={{
            padding: '1rem 2.5rem',
            backgroundColor: '#16a34a',
            color: '#ffffff',
            borderRadius: '0.5rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          Choose Your Learning Path →
        </button>
      </div>
    </div>
  );
}
