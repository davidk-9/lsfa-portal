import React, { useState, useRef, useEffect } from 'react';

export interface TagItem {
  id: string | number;
  label: string;
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
    <div className="w-full space-y-2" ref={containerRef}>
      {/* Pinned tags section */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md min-h-[42px] items-center">
          {selectedItems.map((item) => (
            <span
              key={String(item.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200 shadow-sm transition-all"
            >
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded bg-blue-200 text-blue-900 font-semibold text-[10px]">
                  {item.badge}
                </span>
              )}
              <span>{item.label}</span>
              {item.sublabel && <span className="text-blue-600 font-normal">({item.sublabel})</span>}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onDeselect(item.id)}
                  className="ml-1 text-blue-500 hover:text-blue-800 hover:bg-blue-200 rounded-full p-0.5 transition-colors focus:outline-none"
                  title="Remove item"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search Input and Dropdown */}
      {!disabled && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {availableItems.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500 italic text-center">
                  {emptyMessage}
                </div>
              ) : (
                availableItems.map((item) => (
                  <button
                    key={String(item.id)}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      setQuery('');
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors border-b border-slate-100 last:border-b-0 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-sm font-medium text-slate-800 truncate">{item.label}</div>
                      {item.sublabel && (
                        <div className="text-xs text-slate-500 truncate">{item.sublabel}</div>
                      )}
                    </div>
                    {item.badge && (
                      <span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
