import { useState, useEffect } from 'react';

interface Pair {
  term: string;
  definition: string;
}

interface QuestionProps {
  questionData: { pairs: Pair[] };
  value?: string[];
  onChange: (value: string[]) => void;
}

export function MatchDefinitions({ questionData, value, onChange }: QuestionProps) {
  const pairs = questionData?.pairs || [];
  const [selectedMatches, setSelectedMatches] = useState<Record<number, number>>({});

  useEffect(() => {
    if (value && Array.isArray(value)) {
      const map: Record<number, number> = {};
      value.forEach((matchStr) => {
        const [termIdx, defIdx] = matchStr.split('-').map(Number);
        if (!isNaN(termIdx) && !isNaN(defIdx)) {
          map[termIdx] = defIdx;
        }
      });
      setSelectedMatches(map);
    }
  }, []);

  const handleSelect = (termIndex: number, defIndex: number) => {
    const updated = { ...selectedMatches, [termIndex]: defIndex };
    setSelectedMatches(updated);

    const matchArray = Object.entries(updated).map(([t, d]) => `${t}-${d}`);
    onChange(matchArray);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
        Select the matching definition for each term:
      </p>
      {pairs.map((pair, termIdx) => (
        <div
          key={termIdx}
          style={{
            padding: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            backgroundColor: '#f9fafb',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#1e3a8a' }}>
            {pair.term}
          </span>
          <select
            value={selectedMatches[termIdx] ?? ''}
            onChange={(e) => handleSelect(termIdx, Number(e.target.value))}
            style={{
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '1rem',
              backgroundColor: '#ffffff',
            }}
          >
            <option value="" disabled>
              -- Select Matching Definition --
            </option>
            {pairs.map((defPair, defIdx) => (
              <option key={defIdx} value={defIdx}>
                {defPair.definition}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
