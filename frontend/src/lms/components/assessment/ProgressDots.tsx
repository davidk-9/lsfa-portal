interface ProgressDotsProps {
  total: number;
  current: number;
  answeredIndices: Set<number>;
  onSelect: (index: number) => void;
}

export function ProgressDots({ total, current, answeredIndices, onSelect }: ProgressDotsProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', margin: '1rem 0' }}>
      {Array.from({ length: total }).map((_, idx) => {
        const isCurrent = idx === current;
        const isAnswered = answeredIndices.has(idx);

        let backgroundColor = '#e5e7eb';
        let color = '#374151';
        let border = '1px solid #d1d5db';

        if (isCurrent) {
          backgroundColor = '#2563eb';
          color = '#ffffff';
          border = '2px solid #1d4ed8';
        } else if (isAnswered) {
          backgroundColor = '#dcfce7';
          color = '#15803d';
          border = '1px solid #86efac';
        }

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(idx)}
            style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: '50%',
              backgroundColor,
              color,
              border,
              fontWeight: isCurrent || isAnswered ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            {idx + 1}
          </button>
        );
      })}
    </div>
  );
}
