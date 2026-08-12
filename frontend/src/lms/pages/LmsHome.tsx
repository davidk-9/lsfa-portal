import { Link } from 'react-router-dom';

export function LmsHome() {
  return (
    <div style={{ maxWidth: '48rem', margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '3rem 2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎓</div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '1rem' }}>
          Life Saving First Aid LMS
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#4b5563', marginBottom: '2rem', lineHeight: 1.6 }}>
          Welcome to the LSFA online learning portal. If you received a magic link via email or SMS, please click that link to directly access your enrolled course.
        </p>

        <div style={{ backgroundColor: '#f3f4f6', borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'left', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
            Testing / Development Helper:
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
            Click below to launch sample test student John Doe into the HLTAID011 First Aid onboarding flow:
          </p>
          <Link
            to="/lms/start/test-seed"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '0.375rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            🚀 Launch Demo Student Flow
          </Link>
        </div>
      </div>
    </div>
  );
}
