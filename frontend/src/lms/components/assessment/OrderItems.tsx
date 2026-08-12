import { useState, useEffect } from 'react';

interface QuestionProps {
  questionData: { items: string[] };
  value?: number[];
  onChange: (value: number[]) => void;
}

export function OrderItems({ questionData, value, onChange }: QuestionProps) {
  const items = questionData?.items || [];
  const [currentOrder, setCurrentOrder] = useState<number[]>([]);

  useEffect(() => {
    if (value && value.length === items.length) {
      setCurrentOrder(value);
    } else {
      const initial = items.map((_, idx) => idx);
      // Randomly shuffle items on initial load so they don't start in correct order
      let shuffled = [...initial].sort(() => Math.random() - 0.5);
      // If array happens to be identical to initial order and length > 1, reverse it
      if (shuffled.length > 1 && shuffled.every((val, i) => val === initial[i])) {
        shuffled = shuffled.reverse();
      }
      setCurrentOrder(shuffled);
      onChange(shuffled);
    }
  }, [questionData]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setCurrentOrder(newOrder);
    onChange(newOrder);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
        Use the up/down controls to arrange items into the correct order:
      </p>
      {currentOrder.map((itemIdx, posIdx) => (
        <div
          key={posIdx}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              {posIdx + 1}
            </span>
            <span style={{ fontSize: '1.125rem', fontWeight: 500 }}>{items[itemIdx]}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={posIdx === 0}
              onClick={() => moveItem(posIdx, 'up')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                backgroundColor: posIdx === 0 ? '#f3f4f6' : '#ffffff',
                cursor: posIdx === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ▲
            </button>
            <button
              type="button"
              disabled={posIdx === currentOrder.length - 1}
              onClick={() => moveItem(posIdx, 'down')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                backgroundColor: posIdx === currentOrder.length - 1 ? '#f3f4f6' : '#ffffff',
                cursor: posIdx === currentOrder.length - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ▼
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
