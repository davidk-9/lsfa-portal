interface QuestionProps {
  questionData: { options: string[] };
  value?: string[];
  onChange: (value: string[]) => void;
}

export function MultipleChoiceMultiple({ questionData, value = [], onChange }: QuestionProps) {
  const options = questionData?.options || [];

  const handleToggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((o) => o !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {options.map((option, idx) => {
        const isSelected = value.includes(option);
        return (
          <label
            key={idx}
            onClick={() => handleToggle(option)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1rem 1.25rem',
              borderRadius: '0.5rem',
              border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
              cursor: 'pointer',
              fontSize: '1.125rem',
              fontWeight: isSelected ? 600 : 400,
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggle(option)}
              style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem', accentColor: '#2563eb' }}
            />
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}
