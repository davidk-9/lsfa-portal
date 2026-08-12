import { useState, useRef } from 'react';

interface LmsVideoPlayerProps {
  title?: string;
  azureBlobUrl?: string | null;
  vimeoId?: string | null;
  onCompleted?: () => void;
}

export function LmsVideoPlayer({ title, azureBlobUrl, vimeoId, onCompleted }: LmsVideoPlayerProps) {
  const [hasCompleted, setHasCompleted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleEnded = () => {
    if (!hasCompleted) {
      setHasCompleted(true);
      if (onCompleted) onCompleted();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !hasCompleted) {
      const { currentTime, duration } = videoRef.current;
      if (duration > 0 && currentTime / duration >= 0.85) {
        setHasCompleted(true);
        if (onCompleted) onCompleted();
      }
    }
  };

  const handleManualComplete = () => {
    setHasCompleted(true);
    if (onCompleted) onCompleted();
  };

  // Primary: Azure Blob Storage (Native HTML5 Video)
  if (azureBlobUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div
          style={{
            position: 'relative',
            aspectRatio: '16/9',
            backgroundColor: '#000000',
            borderRadius: '0.5rem',
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            src={azureBlobUrl}
            controls
            playsInline
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: hasCompleted ? '#16a34a' : '#6b7280', fontWeight: hasCompleted ? 600 : 400 }}>
            {hasCompleted ? '✓ Video Completed' : 'Watching video...'}
          </span>
          {!hasCompleted && (
            <button
              type="button"
              onClick={handleManualComplete}
              style={{
                fontSize: '0.875rem',
                padding: '0.25rem 0.75rem',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Mark as Reviewed
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback: Vimeo Embed
  if (vimeoId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div
          style={{
            position: 'relative',
            aspectRatio: '16/9',
            backgroundColor: '#000000',
            borderRadius: '0.5rem',
            overflow: 'hidden',
          }}
        >
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; fullscreen; picture-in-picture"
            title={title || 'Learning Video'}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: hasCompleted ? '#16a34a' : '#6b7280', fontWeight: hasCompleted ? 600 : 400 }}>
            {hasCompleted ? '✓ Video Completed' : 'Watching video...'}
          </span>
          {!hasCompleted && (
            <button
              type="button"
              onClick={handleManualComplete}
              style={{
                fontSize: '0.875rem',
                padding: '0.25rem 0.75rem',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Mark as Reviewed
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: '#f3f4f6',
        borderRadius: '0.5rem',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.875rem',
      }}
    >
      No video preview available for this topic.
    </div>
  );
}
