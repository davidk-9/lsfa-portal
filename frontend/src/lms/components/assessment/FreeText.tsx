interface QuestionProps {
  questionData?: { minWords?: number; maxWords?: number };
  value?: string;
  onChange: (value: string) => void;
}

export function FreeText({ questionData, value = '', onChange }: QuestionProps) {
  const minWords = questionData?.minWords;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your detailed response here..."
        style={{
          padding: '0.875rem',
          borderRadius: '0.375rem',
          border: '1px solid #d1d5db',
          fontSize: '1rem',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
        <span>Word count: {wordCount}</span>
        {minWords && <span>Minimum required: {minWords} words</span>}
      </div>
    </div>
  );
}
