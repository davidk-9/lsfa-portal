interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionText: string;
  supportVideoId?: string | null;
}

export function HelpModal({ isOpen, onClose, questionText, supportVideoId }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          maxWidth: '36rem',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#1e3a8a' }}>
          💡 Assessment Support & Guidance
        </h3>
        <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem' }}>
          Questions about: <strong>"{questionText}"</strong>
        </p>

        {supportVideoId ? (
          <div style={{ margin: '1rem 0', aspectRatio: '16/9', borderRadius: '0.5rem', overflow: 'hidden' }}>
            <iframe
              src={`https://player.vimeo.com/video/${supportVideoId}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="autoplay; fullscreen; picture-in-picture"
              title="Support Video"
            />
          </div>
        ) : (
          <div
            style={{
              padding: '1rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0.5rem',
              color: '#1e40af',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            Please re-read the question carefully and select the best answer based on standard Australian First Aid Guidelines (ARC).
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: '0.375rem',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to Question
          </button>
        </div>
      </div>
    </div>
  );
}
