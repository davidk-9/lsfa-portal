import { useLocation, useNavigate } from 'react-router-dom';
import type { AssessmentSummaryDto } from '../types/lms';
import { LmsVideoPlayer } from '../components/media/LmsVideoPlayer';
import { lmsApi } from '../services/lmsApi';

export function LmsResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.result as AssessmentSummaryDto | undefined;

  if (!result) {
    navigate('/lms');
    return null;
  }

  const handleBlobCompleted = async (blobId: string, duration: number) => {
    try {
      await lmsApi.recordBlobView(result.enrollmentId, blobId, duration, true);
    } catch (err) {
      console.error('Failed to record blob view:', err);
    }
  };

  const percentage = Math.round((result.pointsEarned / result.totalPoints) * 100);

  return (
    <div style={{ maxWidth: '52rem', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>
            {result.isCompetent ? '🎉' : '📖'}
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.5rem' }}>
            {result.isCompetent ? 'Congratulations!' : 'Keep Learning & Review'}
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#4b5563' }}>
            {result.isCompetent
              ? 'You have successfully achieved theory competency!'
              : 'Review the recommended support topics below and re-attempt'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ padding: '1.25rem', backgroundColor: '#eff6ff', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid #bfdbfe' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e40af', textTransform: 'uppercase' }}>Score</p>
            <p style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#1e3a8a' }}>{percentage}%</p>
            <p style={{ fontSize: '0.875rem', color: '#3b82f6' }}>{result.pointsEarned} / {result.totalPoints} points</p>
          </div>

          <div style={{ padding: '1.25rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Correct</p>
            <p style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#15803d' }}>{result.correctAnswers}</p>
            <p style={{ fontSize: '0.875rem', color: '#22c55e' }}>out of {result.totalQuestions} questions</p>
          </div>

          <div style={{ padding: '1.25rem', backgroundColor: result.isCompetent ? '#f0fdf4' : '#fff7ed', borderRadius: '0.5rem', textAlign: 'center', border: `1px solid ${result.isCompetent ? '#bbf7d0' : '#fed7aa'}` }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: result.isCompetent ? '#166534' : '#9a3412', textTransform: 'uppercase' }}>Status</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: result.isCompetent ? '#15803d' : '#c2410c', marginTop: '0.5rem' }}>
              {result.isCompetent ? 'COMPETENT' : 'NOT YET COMPETENT'}
            </p>
          </div>
        </div>

        {!result.isCompetent && result.gaps && result.gaps.length > 0 && (
          <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#9a3412', marginBottom: '0.5rem' }}>
              📚 Recommended Review Topics
            </h3>
            <p style={{ fontSize: '0.95rem', color: '#c2410c', marginBottom: '1rem' }}>
              We identified the following topics for your review before your next attempt:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {result.gaps.map((gap, idx) => (
                <div key={idx} style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #ffedd5' }}>
                  <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#9a3412', marginBottom: '0.25rem' }}>{gap.title}</h4>
                  {gap.description && <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.75rem' }}>{gap.description}</p>}
                  <p style={{ fontSize: '0.875rem', color: '#ea580c', marginBottom: '0.75rem' }}>
                    Duration: {Math.floor(gap.durationSeconds / 60)}m {gap.durationSeconds % 60}s | Failed Questions: {gap.failedQuestions.length}
                  </p>

                  <LmsVideoPlayer
                    title={gap.title}
                    vimeoId={gap.vimeoId}
                    azureBlobUrl={gap.azureBlobUrl}
                    onCompleted={() => handleBlobCompleted(gap.blobId, gap.durationSeconds)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={() => navigate('/lms')}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Return to LMS Home
          </button>

          {!result.isCompetent && (
            <button
              type="button"
              onClick={() => navigate('/lms/learn')}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Review & Retry Assessment →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
