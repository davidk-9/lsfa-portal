import { useState, useEffect } from 'react';

interface QuestionProps {
  questionData: { items: string[] };
  value?: number[];
  onChange: (value: number[]) => void;
}

export function OrderItems({ questionData, value, onChange }: QuestionProps) {
  const items = questionData?.items || [];
  const [currentOrder, setCurrentOrder] = useState<number[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set transparent image or drag data if needed
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...currentOrder];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setCurrentOrder(newOrder);
    onChange(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
        Drag and drop the items below using the handle (⣿) to arrange them in the correct sequence:
      </p>
      {currentOrder.map((itemIdx, posIdx) => (
        <div
          key={posIdx}
          draggable
          onDragStart={(e) => handleDragStart(e, posIdx)}
          onDragOver={(e) => handleDragOver(e, posIdx)}
          onDragEnd={handleDragEnd}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1.25rem',
            borderRadius: '0.5rem',
            border: draggedIndex === posIdx ? '2px solid #2563eb' : '1px solid #e5e7eb',
            backgroundColor: draggedIndex === posIdx ? '#eff6ff' : '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            cursor: 'grab',
            transition: 'all 0.15s ease-in-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                fontSize: '1.25rem',
                color: '#94a3b8',
                cursor: 'grab',
                userSelect: 'none',
                paddingRight: '0.25rem',
              }}
              title="Drag to reorder"
            >
              ⣿
            </span>
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
                fontSize: '0.875rem',
              }}
            >
              {posIdx + 1}
            </span>
            <span style={{ fontSize: '1.125rem', fontWeight: 500, color: '#1f2937' }}>
              {items[itemIdx]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
