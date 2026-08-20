import React, { useState, useRef, useEffect } from 'react';

export interface TagItem {
  id: string | number;
  label: string;
  tagLabel?: string; // Concise display label for pinned tag pill (e.g. course code "HLTAID011")
  sublabel?: string;
  badge?: string;
}

export interface SearchableTagPickerProps {
  items: TagItem[];
  selectedIds: Array<string | number>;
  onSelect: (id: string | number) => void;
  onDeselect: (id: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

export const SearchableTagPicker: React.FC<SearchableTagPickerProps> = ({
  items,
  selectedIds,
  onSelect,
  onDeselect,
  placeholder = 'Type to search and add...',
  disabled = false,
  emptyMessage = 'No matching items found',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSet = new Set(selectedIds.map((id) => String(id)));

  // Selected tag objects in order of selectedIds
  const selectedItems = selectedIds
    .map((id) => items.find((item) => String(item.id) === String(id)))
    .filter((item): item is TagItem => item !== undefined);

  // Available items filtered by search query
  const availableItems = items.filter((item) => {
    if (selectedSet.has(String(item.id))) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      (item.tagLabel && item.tagLabel.toLowerCase().includes(q)) ||
      (item.sublabel && item.sublabel.toLowerCase().includes(q)) ||
      (item.badge && item.badge.toLowerCase().includes(q))
    );
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'inherit' }}>
      {/* Pinned tags section */}
      {selectedItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            padding: '6px 10px',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            minHeight: 38,
            alignItems: 'center',
          }}
        >
          {selectedItems.map((item) => {
            const displayText = item.tagLabel || item.label;
            return (
              <span
                key={String(item.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 8px 3px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 12,
                  backgroundColor: '#eff6ff',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  lineHeight: 1.2,
                }}
              >
                <span>{displayText}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onDeselect(item.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 13,
                      fontWeight: 'bold',
                      lineHeight: 1,
                      marginLeft: 2,
                      transition: 'background-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dbeafe';
                      e.currentTarget.style.color = '#1e3a8a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#3b82f6';
                    }}
                    title="Remove item"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Search Input and Dropdown */}
      {!disabled && (
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 13,
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              outline: 'none',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              boxSizing: 'border-box',
            }}
          />

          {isOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 9999,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {availableItems.length === 0 ? (
                <div style={{ padding: '12px', fontSize: 12, color: '#64748b', fontStyle: 'italic', textAlign: 'center' }}>
                  {emptyMessage}
                </div>
              ) : (
                availableItems.map((item) => {
                  const isHovered = hoveredId === item.id;
                  return (
                    <button
                      key={String(item.id)}
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        setQuery('');
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        border: 'none',
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isHovered ? '#f0f9ff' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background-color 0.15s',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </div>
                        {item.sublabel && (
                          <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                            {item.sublabel}
                          </div>
                        )}
                      </div>
                      {item.badge && (
                        <span
                          style={{
                            flexShrink: 0,
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            borderRadius: 4,
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
