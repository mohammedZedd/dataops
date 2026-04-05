import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Rechercher…', disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hlIdx, setHlIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : [...options];

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const open = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setSearch('');
    setHlIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [disabled]);

  function select(val: string) {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setIsOpen(false); setSearch(''); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHlIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHlIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && hlIdx >= 0 && hlIdx < filtered.length) { e.preventDefault(); select(filtered[hlIdx]); }
  }

  // Scroll highlighted into view
  useEffect(() => {
    if (hlIdx >= 0 && listRef.current) {
      const el = listRef.current.children[hlIdx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [hlIdx]);

  function highlight(text: string, query: string) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark style={{ background: '#FEF9C3', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div onClick={open} style={{
        height: 44, border: `1px solid ${isOpen ? '#3B82F6' : '#E5E7EB'}`, borderRadius: 8,
        padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#F9FAFB' : '#fff',
        boxShadow: isOpen ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none', transition: 'all 0.15s',
        opacity: disabled ? 0.6 : 1,
      }}>
        <span style={{ fontSize: 14, color: value ? '#111827' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {value || placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {value && !disabled && (
            <button onClick={e => { e.stopPropagation(); onChange(''); }} style={{
              width: 18, height: 18, borderRadius: '50%', border: 'none', background: '#E5E7EB',
              color: '#6B7280', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>&#10005;</button>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'hidden', maxHeight: 320,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', position: 'sticky', top: 0, background: '#fff' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
                style={{ position: 'absolute', left: 10 }}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input ref={inputRef} value={search} onChange={e => { setSearch(e.target.value); setHlIdx(-1); }}
                onKeyDown={handleKey} placeholder="Rechercher…"
                style={{
                  width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 6,
                  paddingLeft: 32, paddingRight: 12, fontSize: 13, outline: 'none', background: '#F9FAFB',
                }} />
            </div>
          </div>

          {/* List */}
          <div ref={listRef} style={{ overflowY: 'auto', maxHeight: 260 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                Aucun résultat pour « {search} »
              </div>
            ) : filtered.map((opt, i) => (
              <div key={opt} onClick={() => select(opt)}
                style={{
                  padding: '10px 16px', fontSize: 14, cursor: 'pointer', minHeight: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: opt === value ? '#EFF6FF' : i === hlIdx ? '#F3F4F6' : '#fff',
                  color: opt === value ? '#3B82F6' : '#111827',
                  fontWeight: opt === value ? 500 : 400,
                  borderBottom: i < filtered.length - 1 ? '1px solid #F9FAFB' : 'none',
                }}
                onMouseEnter={() => setHlIdx(i)}>
                <span>{highlight(opt, search)}</span>
                {opt === value && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
