import { useState, useEffect, type ReactNode } from 'react';

interface Field {
  name: string;
  type: string;
  required?: boolean;
  label?: string;
  description?: string;
  width?: string;
}

interface QuestionProps {
  questionText?: string;
  questionData: { fields: Field[]; template?: string };
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

export function Forms({ questionText, questionData, value = {}, onChange }: QuestionProps) {
  const fields = questionData?.fields || [];
  const template = questionData?.template || questionText || '';
  const [formData, setFormData] = useState<Record<string, string>>(value || {});

  useEffect(() => {
    if (value && typeof value === 'object') {
      setFormData(value);
    }
  }, [value]);

  const handleChange = (name: string, val: string) => {
    const updated = { ...formData, [name]: val };
    setFormData(updated);
    onChange(updated);
  };

  const renderLabel = (field: Field) => (
    <label
      key={`label-${field.name}`}
      style={{
        fontSize: '0.875rem',
        fontWeight: 600,
        color: '#374151',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}
    >
      <span>{field.label || field.name}</span>
      {field.required && <span style={{ color: '#dc2626' }}>*</span>}
    </label>
  );

  const renderFieldInput = (field: Field) => {
    const val = formData[field.name] || '';
    const customWidth = field.width || '100%';

    if (field.type === 'checkbox') {
      return (
        <label
          key={`input-${field.name}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 500,
            color: '#1f2937',
          }}
        >
          <input
            type="checkbox"
            checked={val === 'true' || val === 'yes' || val === 'on'}
            onChange={(e) => handleChange(field.name, e.target.checked ? 'true' : 'false')}
            style={{ width: '1.125rem', height: '1.125rem', cursor: 'pointer' }}
          />
          <span>{field.label || field.name} {field.required && <span style={{ color: '#dc2626' }}>*</span>}</span>
        </label>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={`input-${field.name}`} style={{ width: customWidth, display: 'inline-block' }}>
          <textarea
            rows={3}
            value={val}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.description || field.label || ''}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      );
    }

    return (
      <div key={`input-${field.name}`} style={{ width: customWidth, display: 'inline-block' }}>
        <input
          type={field.type || 'text'}
          value={val}
          onChange={(e) => handleChange(field.name, e.target.value)}
          placeholder={field.description || field.label || ''}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            border: '1px solid #d1d5db',
            fontSize: '0.95rem',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  };

  const renderBothInline = (field: Field) => {
    if (field.type === 'checkbox') {
      return renderFieldInput(field);
    }
    return (
      <div
        key={`both-${field.name}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: field.width || '100%',
          maxWidth: '100%',
          flexWrap: 'wrap',
        }}
      >
        {renderLabel(field)}
        <div style={{ flex: 1, minWidth: '120px' }}>{renderFieldInput(field)}</div>
      </div>
    );
  };

  const renderVertical = (field: Field) => {
    if (field.type === 'checkbox') {
      return renderFieldInput(field);
    }
    return (
      <div
        key={`vert-${field.name}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          width: field.width || '100%',
          marginBottom: '0.5rem',
        }}
      >
        {renderLabel(field)}
        {field.description && (
          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
            {field.description}
          </span>
        )}
        {renderFieldInput(field)}
      </div>
    );
  };

  const renderFieldByMode = (fieldIdx: number, mode: string): ReactNode => {
    const field = fields[fieldIdx];
    if (!field) return null;

    switch (mode) {
      case 'label':
        return renderLabel(field);
      case 'field':
        return renderFieldInput(field);
      case 'vertical':
        return renderVertical(field);
      case 'both':
      default:
        return renderBothInline(field);
    }
  };

  // Check if template contains placeholders like {0}, {1:label}, {2:field}, {3:vertical}
  const hasPlaceholders = /\{[\d]+(?::[a-zA-Z]+)?\}/.test(template);

  if (hasPlaceholders) {
    const parts = template.split(/(\{[\d]+(?::[a-zA-Z]+)?\})/g);
    const substitutedFieldIndices = new Set<number>();

    parts.forEach((part) => {
      const match = part.match(/^\{(\d+)(?::([a-zA-Z]+))?\}$/);
      if (match) {
        substitutedFieldIndices.add(parseInt(match[1], 10));
      }
    });

    const unplacedFields = fields.filter((_, idx) => !substitutedFieldIndices.has(idx));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="lms-rich-content" style={{ width: '100%', overflowX: 'auto' }}>
          {parts.map((part, pIdx) => {
            const match = part.match(/^\{(\d+)(?::([a-zA-Z]+))?\}$/);
            if (match) {
              const idx = parseInt(match[1], 10);
              const mode = match[2] || 'both';
              return <span key={pIdx} style={{ display: 'inline-block', verticalAlign: 'middle' }}>{renderFieldByMode(idx, mode)}</span>;
            }
            return <span key={pIdx} dangerouslySetInnerHTML={{ __html: part }} />;
          })}
        </div>

        {/* Fallback for any unplaced fields */}
        {unplacedFields.length > 0 && (
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h5 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>
              Additional Form Fields:
            </h5>
            {unplacedFields.map((field) => renderVertical(field))}
          </div>
        )}
      </div>
    );
  }

  // Fallback if no layout template is defined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {fields.map((field) => renderVertical(field))}
    </div>
  );
}
