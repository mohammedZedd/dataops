import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StickyNote, Plus, Search, Pin, Trash2, Bold, Italic, List as ListIcon, CheckSquare, Heading, Code, X, Loader2, FileText } from 'lucide-react';
import apiClient from '../api/axios';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NoteAuthor { id: string | null; name: string; initials: string }
interface Note {
  id: string;
  title: string | null;
  content: string;
  color: string;
  is_pinned: boolean;
  tags: string;  // comma-separated
  client_id: string | null;
  client_name: string | null;
  author: NoteAuthor;
  created_at: string;
  updated_at: string;
}
interface ClientBrief { id: string; name: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLORS = ['yellow', 'blue', 'green', 'pink', 'gray'] as const;
function colorTheme(c: string) {
  const m: Record<string, { bg: string; border: string; accent: string }> = {
    yellow: { bg: '#FFFBEB', border: '#FDE68A', accent: '#F59E0B' },
    blue:   { bg: '#EFF6FF', border: '#BFDBFE', accent: '#3B82F6' },
    green:  { bg: '#F0FDF4', border: '#BBF7D0', accent: '#16A34A' },
    pink:   { bg: '#FDF2F8', border: '#F9A8D4', accent: '#EC4899' },
    gray:   { bg: '#F9FAFB', border: '#E5E7EB', accent: '#6B7280' },
  };
  return m[c] || m.yellow;
}

function fmtTime(iso: string): string {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

// Lightweight markdown-ish render for the note preview area
function renderRich(content: string): React.ReactNode {
  const lines = content.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('# ')) return <h2 key={i} style={{ fontSize: 18, fontWeight: 700, margin: '10px 0 6px' }}>{line.slice(2)}</h2>;
    if (line.startsWith('## ')) return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 4px' }}>{line.slice(3)}</h3>;
    if (line.startsWith('- [ ] ')) return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>☐ {line.slice(6)}</div>;
    if (line.startsWith('- [x] ')) return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0', color: '#9CA3AF', textDecoration: 'line-through' }}>☑ {line.slice(6)}</div>;
    if (line.startsWith('- ')) return <div key={i} style={{ marginLeft: 14, margin: '2px 0' }}>• {line.slice(2)}</div>;
    if (line.startsWith('```')) return <div key={i} style={{ background: '#F3F4F6', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 }}>{line.slice(3)}</div>;
    if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;
    const parts: React.ReactNode[] = [];
    let rest = line;
    let key = 0;
    while (rest.length) {
      const b = rest.indexOf('**');
      const it = rest.indexOf('*');
      if (b !== -1 && (it === -1 || b < it)) {
        if (b > 0) parts.push(rest.slice(0, b));
        const end = rest.indexOf('**', b + 2);
        if (end !== -1) { parts.push(<b key={key++}>{rest.slice(b + 2, end)}</b>); rest = rest.slice(end + 2); continue; }
      }
      if (it !== -1) {
        if (it > 0) parts.push(rest.slice(0, it));
        const end = rest.indexOf('*', it + 1);
        if (end !== -1) { parts.push(<i key={key++}>{rest.slice(it + 1, end)}</i>); rest = rest.slice(end + 1); continue; }
      }
      parts.push(rest); break;
    }
    return <div key={i} style={{ margin: '2px 0', lineHeight: 1.6 }}>{parts}</div>;
  });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [clients, setClients] = useState<ClientBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const defaultNew = { title: '', content: '', color: 'yellow', tags: '', client_id: '' };
  const [newNote, setNewNote] = useState(defaultNew);

  // Fetch
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/notes');
      setNotes(data.notes ?? []);
      setClients(data.clients ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Filter + sort
  const filtered = useMemo(() => notes.filter(n => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (n.title ?? '').toLowerCase().includes(s) || n.content.toLowerCase().includes(s);
  }).sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  }), [notes, search]);

  const selected = filtered.find(n => n.id === selectedId) || filtered[0] || null;

  // Handlers
  async function handleCreate() {
    if (!newNote.content.trim() || !newNote.client_id) return;
    try {
      await apiClient.post(`/clients/${newNote.client_id}/notes`, newNote);
      setShowNew(false); setNewNote(defaultNew);
      fetchAll();
    } catch { /* */ }
  }
  async function handleUpdate(note: Note, updates: Record<string, unknown>) {
    if (!note.client_id) return;
    try { await apiClient.patch(`/clients/${note.client_id}/notes/${note.id}`, updates); fetchAll(); } catch { /* */ }
  }
  async function handleDelete(note: Note) {
    if (!confirm('Supprimer cette note ?')) return;
    if (!note.client_id) return;
    try { await apiClient.delete(`/clients/${note.client_id}/notes/${note.id}`); setSelectedId(null); fetchAll(); } catch { /* */ }
  }
  async function handlePin(note: Note) {
    if (!note.client_id) return;
    try { await apiClient.patch(`/clients/${note.client_id}/notes/${note.id}/pin`); fetchAll(); } catch { /* */ }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', margin: '-16px -24px', background: '#fff' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 280, borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', background: '#FAFAFA', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #E5E7EB', background: '#fff' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={15} /> Notes
          </h2>
          <button
            onClick={() => setShowNew(true)}
            style={{ width: '100%', padding: '7px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}
          >
            <Plus size={13} /> Nouvelle note
          </button>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ width: '100%', height: 31, border: '1px solid #E5E7EB', borderRadius: 7, padding: '0 10px 0 29px', fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
            />
          </div>
        </div>

        {/* Note list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 16px' }}>
          {loading && (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <Loader2 size={18} className="animate-spin" style={{ color: '#9CA3AF', margin: '0 auto' }} />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>
              <StickyNote size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 12, margin: 0 }}>{search ? 'Aucun résultat' : 'Aucune note'}</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filtered.map(n => {
              const c = colorTheme(n.color);
              const isActive = selected?.id === n.id;
              const icon = n.is_pinned ? '📌' : n.content.includes('- [ ]') || n.content.includes('- [x]') ? '✅' : '📄';
              const diffMs = Date.now() - new Date(n.updated_at + (n.updated_at.endsWith('Z') ? '' : 'Z')).getTime();
              const isNew = diffMs < 5 * 60 * 1000;
              return (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
                    border: `1px solid ${isActive ? c.border : '#F3F4F6'}`,
                    borderLeft: `3px solid ${isActive ? c.accent : 'transparent'}`,
                    borderRadius: 8, background: isActive ? c.bg : '#fff',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', width: '100%',
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title || 'Sans titre'}
                  </span>
                  {isNew
                    ? <span style={{ fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#16A34A', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>NEW</span>
                    : <span style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', flexShrink: 0, whiteSpace: 'nowrap' }}>{fmtTime(n.updated_at)}</span>
                  }
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Editor ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected
          ? <NoteEditor key={selected.id} note={selected} onUpdate={(u) => handleUpdate(selected, u)} onPin={() => handlePin(selected)} onDelete={() => handleDelete(selected)} />
          : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexDirection: 'column', gap: 12 }}>
              <StickyNote size={48} color="#D1D5DB" />
              <p style={{ fontWeight: 500, margin: 0 }}>Sélectionnez une note ou créez-en une nouvelle</p>
            </div>
          )
        }
      </div>

      {/* ── New note modal ── */}
      {showNew && (
        <>
          <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, background: 'white', borderRadius: 16, padding: '24px 28px', zIndex: 10000, boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Nouvelle note</h3>
              <button onClick={() => setShowNew(false)} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setNewNote({ ...newNote, color: c })} style={{ width: 22, height: 22, borderRadius: '50%', background: colorTheme(c).accent, border: newNote.color === c ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
            <select value={newNote.client_id} onChange={e => setNewNote({ ...newNote, client_id: e.target.value })} style={{ width: '100%', height: 38, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 13, marginBottom: 10, background: 'white' }}>
              <option value="">Sélectionner un client *</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={newNote.title} onChange={e => setNewNote({ ...newNote, title: e.target.value })} placeholder="Titre (optionnel)" style={{ width: '100%', height: 38, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 14, marginBottom: 10, fontWeight: 600, boxSizing: 'border-box' }} />
            <textarea value={newNote.content} onChange={e => setNewNote({ ...newNote, content: e.target.value })} placeholder="Contenu (markdown supporté : # titre, **gras**, - liste, - [ ] checkbox)" rows={6} autoFocus style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
            <input value={newNote.tags} onChange={e => setNewNote({ ...newNote, tags: e.target.value })} placeholder="Tags (séparés par des virgules)" style={{ width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 13, marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowNew(false); setNewNote(defaultNew); }} style={{ padding: '8px 16px', background: 'white', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={handleCreate} disabled={!newNote.content.trim() || !newNote.client_id} style={{ padding: '8px 18px', background: newNote.content.trim() && newNote.client_id ? '#F59E0B' : '#E5E7EB', color: newNote.content.trim() && newNote.client_id ? 'white' : '#9CA3AF', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Créer</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function NoteEditor({ note, onUpdate, onPin, onDelete }: { note: Note; onUpdate: (u: Record<string, unknown>) => void; onPin: () => void; onDelete: () => void }) {
  const [title, setTitle] = useState(note.title ?? '');
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags ?? '');
  const [editing, setEditing] = useState(false);
  const c = colorTheme(note.color);

  function save() {
    if (title !== (note.title ?? '') || content !== note.content || tags !== (note.tags ?? '')) {
      onUpdate({ title, content, tags });
    }
    setEditing(false);
  }

  function insertMd(prefix: string) {
    setContent(prev => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + prefix);
    setEditing(true);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8, background: '#FAFAFA' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button title="Titre" onClick={() => insertMd('# ')} style={tbBtn}><Heading size={14} /></button>
          <button title="Gras" onClick={() => insertMd('**texte**')} style={tbBtn}><Bold size={14} /></button>
          <button title="Italique" onClick={() => insertMd('*texte*')} style={tbBtn}><Italic size={14} /></button>
          <button title="Liste" onClick={() => insertMd('- ')} style={tbBtn}><ListIcon size={14} /></button>
          <button title="Checklist" onClick={() => insertMd('- [ ] ')} style={tbBtn}><CheckSquare size={14} /></button>
          <button title="Code" onClick={() => insertMd('```')} style={tbBtn}><Code size={14} /></button>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {COLORS.map(col => (
            <button key={col} onClick={() => onUpdate({ color: col })} style={{ width: 18, height: 18, borderRadius: '50%', background: colorTheme(col).accent, border: note.color === col ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
          ))}
        </div>
        <button onClick={onPin} title={note.is_pinned ? 'Désépingler' : 'Épingler'} style={{ ...tbBtn, color: note.is_pinned ? c.accent : '#6B7280' }}><Pin size={14} fill={note.is_pinned ? c.accent : 'none'} /></button>
        <button onClick={onDelete} title="Supprimer" style={{ ...tbBtn, color: '#EF4444' }}><Trash2 size={14} /></button>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setEditing(true); }}
          onBlur={save}
          placeholder="Sans titre"
          style={{ width: '100%', border: 'none', outline: 'none', fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>
          {note.client_name && <Link to={`/clients/${note.client_id}`} style={{ color: c.accent, textDecoration: 'none' }}>📁 {note.client_name}</Link>}
          <span>·</span>
          <span>Créé {fmtTime(note.created_at)}</span>
          <span>·</span>
          <span>Modifié {fmtTime(note.updated_at)}</span>
        </div>
        <input
          value={tags}
          onChange={e => { setTags(e.target.value); setEditing(true); }}
          onBlur={save}
          placeholder="Tags (séparés par des virgules)"
          style={{ width: '100%', border: '1px dashed #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 16, outline: 'none', background: 'transparent', color: '#6B7280', boxSizing: 'border-box' }}
        />
        {editing ? (
          <textarea value={content} onChange={e => setContent(e.target.value)} onBlur={save} autoFocus style={{ width: '100%', minHeight: 400, border: 'none', outline: 'none', fontSize: 14, lineHeight: 1.7, fontFamily: 'inherit', resize: 'none', color: '#374151', background: 'transparent', boxSizing: 'border-box' }} />
        ) : (
          <div onClick={() => setEditing(true)} style={{ minHeight: 400, fontSize: 14, lineHeight: 1.7, color: '#374151', cursor: 'text' }}>
            {content ? renderRich(content) : <span style={{ color: '#9CA3AF' }}>Cliquez pour écrire...</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const tbBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' };
