import { useState, useEffect } from 'react';

export interface Blank {
  index: number;
  hint?: string;
  options?: string[]; // Dropdown choices including correct answer and distractors
}

interface BlankResult {
  blankIndex: number;
  isCorrect?: boolean;
}

interface QuestionProps {
  questionText?: string;
  questionData: {
    blanks: Blank[];
    template?: string; // e.g., "During CPR, perform {0} compressions at a depth of {1}, followed by {2} rescue breaths."
  };
  value?: Array<{ blankIndex: number; answer: string }>;
  onChange: (value: Array<{ blankIndex: number; answer: string }>) => void;
  blankResults?: BlankResult[];
}

export function FillInBlanks({ questionText, questionData, value = [], onChange, blankResults }: QuestionProps) {
  const blanks = questionData?.blanks || [];
  const template = questionData?.template || questionText || '';
  const [inputs, setInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (value && value.length > 0) {
      const map: Record<number, string> = {};
      value.forEach((b) => {
        map[b.blankIndex] = b.answer;
      });
      setInputs(map);
    }
  }, [value]);

  const handleChange = (index: number, selectedAnswer: string) => {
    const updated = { ...inputs, [index]: selectedAnswer };
    setInputs(updated);

    const formatted = Object.entries(updated).map(([idx, val]) => ({
      blankIndex: Number(idx),
      answer: val,
    }));
    onChange(formatted);
  };

  const getResultFeedback = (blankIndex: number) => {
    if (!blankResults) return null;
    const result = blankResults.find((r) => r.blankIndex === blankIndex);
    return result ? result.isCorrect : null;
  };

  // Helper to render dropdown select for a blank index
  const renderDropdown = (blankIndex: number) => {
    const blank = blanks.find((b) => b.index === blankIndex) || blanks[blankIndex];
    const options = blank?.options && blank.options.length > 0
      ? blank.options
      : ['Select...', '15', '30', '50', '5-6 cm', '10 cm', '2', '5']; // Default choices if none specified

    const isCorrect = getResultFeedback(blankIndex);
    let borderStyle = '1px solid #d1d5db';
    let bgColor = '#ffffff';

    if (isCorrect === true) {
      borderStyle = '2px solid #16a34a';
      bgColor = '#f0fdf4';
    } else if (isCorrect === false) {
      borderStyle = '2px solid #dc2626';
      bgColor = '#fef2f2';
    } else if (inputs[blankIndex]) {
      borderStyle = '2px solid #2563eb';
      bgColor = '#eff6ff';
    }

    return (
      <select
        key={blankIndex}
        value={inputs[blankIndex] || ''}
        onChange={(e) => handleChange(blankIndex, e.target.value)}
        style={{
          display: 'inline-block',
          margin: '0 0.35rem',
          padding: '0.4rem 0.75rem',
          borderRadius: '0.375rem',
          border: borderStyle,
          backgroundColor: bgColor,
          fontSize: '1rem',
          fontWeight: inputs[blankIndex] ? 600 : 400,
          color: '#1f2937',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease-in-out',
        }}
      >
        <option value="" disabled>
          -- {blank?.hint || `Blank #${blankIndex + 1}`} --
        </option>
        {options.map((opt, oIdx) => (
          <option key={oIdx} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  };

  // Check if template contains placeholder markers like {0}, {1} or _____
  const hasPlaceholders = template.includes('{0}') || template.includes('_____');

  if (hasPlaceholders) {
    // Split template by {0}, {1}, {2}... or _____
    const parts = template.split(/(\{[\d]+\}|_____)/g);
    let currentBlankCounter = 0;

    return (
      <div style={{ padding: '1rem 0', lineHeight: 2.2, fontSize: '1.125rem', color: '#1f2937' }}>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Select the correct option from each dropdown within the sentence below:
        </p>
        <div style={{ backgroundColor: '#f9fafb', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
          {parts.map((part, pIdx) => {
            if (/^\{[\d]+\}$/.test(part)) {
              const idx = parseInt(part.replace(/[\{\}]/g, ''), 10);
              return renderDropdown(idx);
            } else if (part === '_____') {
              const idx = currentBlankCounter++;
              return renderDropdown(idx);
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </div>
      </div>
    );
  }

  // Fallback for standard listed blanks
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
        Select the correct option for each blank below:
      </p>
      {blanks.map((blank) => (
        <div key={blank.index} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>
            Blank #{blank.index + 1} {blank.hint ? `(${blank.hint})` : ''}:
          </label>
          {renderDropdown(blank.index)}
        </div>
      ))}
    </div>
  );
}
