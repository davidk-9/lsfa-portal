import { useState, useEffect } from 'react';

interface Field {
  name: string;
  type: string;
  required?: boolean;
  label?: string;
}

interface QuestionProps {
  questionData: { fields: Field[] };
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

export function Forms({ questionData, value = {}, onChange }: QuestionProps) {
  const fields = questionData?.fields || [];
  const [formData, setFormData] = useState<Record<string, string>>(value);

  useEffect(() => {
    if (value && typeof value === 'object') {
      setFormData(value);
    }
  }, []);

  const handleChange = (name: string, val: string) => {
    const updated = { ...formData, [name]: val };
    setFormData(updated);
    onChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {fields.map((field, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            {field.label || field.name} {field.required ? '*' : ''}:
          </label>
          <input
            type={field.type || 'text'}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            style={{
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '1rem',
            }}
          />
        </div>
      ))}
    </div>
  );
}
