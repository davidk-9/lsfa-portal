import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { lmsApi } from '../services/lmsApi';
import { LearningMode } from '../types/lms';

export function LmsModeSelector() {
  const { enrollment, setSession } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!enrollment) {
      navigate('/lms');
    } else {
      navigate('/lms/learn');
    }
  }, [enrollment, navigate]);

  if (!enrollment) return null;

  const modes = [
    {
      mode: LearningMode.FastTrack,
      title: 'Fast Track',
      icon: '⚡',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      description: 'Accelerated path for experienced first aid practitioners holding current certificates.',
    },
    {
      mode: LearningMode.Refresher,
      title: 'Refresher',
      icon: '🔄',
      color: '#2563eb',
      bg: '#eff6ff',
      border: '#bfdbfe',
      description: 'Re-certification pathway focusing on updated guidelines and key practical skills.',
    },
    {
      mode: LearningMode.DeepDive,
      title: 'Deep Dive',
      icon: '📖',
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      description: 'Comprehensive guided learning for first-time students or thorough knowledge revision.',
    },
    {
      mode: LearningMode.Offline,
      title: 'Offline Mode',
      icon: '📥',
      color: '#9333ea',
      bg: '#faf5ff',
      border: '#e9d5ff',
      description: 'Download study materials and complete assessments offline.',
    },
  ];

  const handleSelectMode = async (mode: LearningMode) => {
    try {
      const updated = await lmsApi.updateLearningMode(enrollment.id, mode);
      setSession({ ...enrollment, learningMode: updated.learningMode });
      navigate('/lms/learn');
    } catch (err) {
      console.error('Failed to update mode:', err);
      navigate('/lms/learn');
    }
  };

  return (
    <div style={{ maxWidth: '56rem', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.5rem' }}>
          Select Your Learning Path
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#4b5563' }}>
          Choose how you would like to complete your pre-course assessment
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {modes.map((m) => (
          <div
            key={m.mode}
            onClick={() => handleSelectMode(m.mode)}
            style={{
              backgroundColor: m.bg,
              border: `2px solid ${m.border}`,
              borderRadius: '0.75rem',
              padding: '1.75rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'transform 0.15s ease-in-out',
            }}
          >
            <div>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{m.icon}</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: m.color, marginBottom: '0.5rem' }}>
                {m.title}
              </h3>
              <p style={{ fontSize: '0.95rem', color: '#374151', lineHeight: 1.5 }}>{m.description}</p>
            </div>

            <button
              type="button"
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem',
                backgroundColor: m.color,
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Select {m.title}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
