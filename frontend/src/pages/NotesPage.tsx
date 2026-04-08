import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StickyNote, Plus, Search, Pin, Trash2, Bold, Italic, List as ListIcon, CheckSquare, Heading, Code, X, Loader2, Tag } from 'lucide-react';
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
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

function parseTags(s: string): string[] {
  return (s || '').split(',').map(t => t.trim()).filter(Boolean);
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
    // bold/italic inline
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
  const [activeNotebook, setActiveNotebook] = useState<string | null>(null); // client_id or null = all
  const [activeTag, setActiveTag] = useState<string | null>(null);
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

  // Group by client (notebooks)
  const notebooks = useMemo(() => {
    const map: Record<string, { id: string; name: string; count: number }> = {};
    notes.forEach(n => {
      const id = n.client_id || 'sans-client';
      const name = n.client_name || 'Sans client';
      if (!map[id]) map[id] = { id, name, count: 0 };
      map[id].count++;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [notes]);

  // All tags
  const allTags = useMemo(() => {
    const s = new Set<string>();
    notes.forEach(n => parseTags(n.tags).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [notes]);

  // Filter
  const filtered = useMemo(() => notes.filter(n => {
    if (activeNotebook && (n.client_id || 'sans-client') !== activeNotebook) return false;
    if (activeTag && !parseTags(n.tags).includes(activeTag)) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(n.title ?? '').toLowerCase().includes(s) && !n.content.toLowerCase().includes(s) && !(n.tags ?? '').toLowerCase().includes(s)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  }), [notes, activeNotebook, activeTag, search]);

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
      {/* Left: Notebooks sidebar */}
      <aside style={{ width: 240, borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}><StickyNote size={16} /> Notes</h2>
          <button onClick={() => setShowNew(true)} style={{ marginTop: 12, width: '100%', padding: '8px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Plus size={14} /> Nouvelle note</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          <div style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Carnets</div>
          <button onClick={() => setActiveNotebook(null)} style={notebookBtn(activeNotebook === null)}>📚 Toutes les notes <span style={countBadge}>{notes.length}</span></button>
          {notebooks.map(nb => (
            <button key={nb.id} onClick={() => setActiveNotebook(nb.id)} style={notebookBtn(activeNotebook === nb.id)}>
              📁 {nb.name} <span style={countBadge}>{nb.count}</span>
            </button>
          ))}
          {allTags.length > 0 && (<>
            <div style={{ padding: '12px 10px 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tags</div>
            <button onClick={() => setActiveTag(null)} style={notebookBtn(activeTag === null)}>Tous</button>
            {allTags.map(t => (
              <button key={t} onClick={() => setActiveTag(t)} style={notebookBtn(activeTag === t)}>
                <Tag size={11} style={{ display: 'inline', marginRight: 4 }} /> {t}
              </button>
            ))}
          </>)}
        </div>
      </aside>

      {/* Middle: Note list */}
      <div style={{ width: 320, borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ width: '100%', height: 34, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px 0 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} className="animate-spin" /></div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Aucune note</div>}
          {filtered.map(n => {
            const c = colorTheme(n.color);
            const isActive = selected?.id === n.id;
            return (
              <div key={n.id} onClick={() => setSelectedId(n.id)} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', borderLeft: isActive ? `3px solid ${c.accent}` : '3px solid transparent', background: isActive ? c.bg : 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {n.is_pinned && <Pin size={11} fill={c.accent} color={c.accent} />}
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Sans titre'}</span>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{n.content.replace(/[#*`-]/g, '').slice(0, 80)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#9CA3AF' }}>
                  {n.client_name && <span>📁 {n.client_name}</span>}
                  <span style={{ marginLeft: 'auto' }}>{fmtTime(n.updated_at)}</span>
                </div>
                {parseTags(n.tags).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {parseTags(n.tags).slice(0, 3).map(t => <span key={t} style={{ fontSize: 9, background: c.bg, color: c.accent, borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>#{t}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? <NoteEditor key={selected.id} note={selected} onUpdate={(u) => handleUpdate(selected, u)} onPin={() => handlePin(selected)} onDelete={() => handleDelete(selected)} /> : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexDirection: 'column', gap: 12 }}>
            <StickyNote size={48} color="#D1D5DB" />
            <p style={{ fontWeight: 500 }}>Sélectionnez une note ou créez-en une nouvelle</p>
          </div>
        )}
      </div>

      {/* New note modal */}
      {showNew && (
        <>
          <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 520, background: 'white', borderRadius: 16, padding: '24px 28px', zIndex: 10000, boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Nouvelle note</h3>
              <button onClick={() => setShowNew(false)} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>{COLORS.map(c => <button key={c} onClick={() => setNewNote({ ...newNote, color: c })} style={{ width: 22, height: 22, borderRadius: '50%', background: colorTheme(c).accent, border: newNote.color === c ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />)}</div>
            <select value={newNote.client_id} onChange={e => setNewNote({ ...newNote, client_id: e.target.value })} style={{ width: '100%', height: 38, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 13, marginBottom: 10, background: 'white' }}>
              <option value="">Sélectionner un client *</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={newNote.title} onChange={e => setNewNote({ ...newNote, title: e.target.value })} placeholder="Titre (optionnel)" style={{ width: '100%', height: 38, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 14, marginBottom: 10, fontWeight: 600, boxSizing: 'border-box' }} />
            <textarea value={newNote.content} onChange={e => setNewNote({ ...newNote, content: e.target.value })} placeholder="Contenu (markdown supporté: # titre, **gras**, - liste, - [ ] checkbox)" rows={6} autoFocus style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
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

  // Auto-save on blur
  function save() {
    if (title !== (note.title ?? '') || content !== note.content || tags !== (note.tags ?? '')) {
      onUpdate({ title, content, tags });
    }
    setEditing(false);
  }

  function insertMd(prefix: string, suffix = '') {
    setContent(prev => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + prefix + suffix);
    setEditing(true);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8, background: '#FAFAFA' }}>
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
          {COLORS.map(col => <button key={col} onClick={() => onUpdate({ color: col })} style={{ width: 18, height: 18, borderRadius: '50%', background: colorTheme(col).accent, border: note.color === col ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />)}
        </div>
        <button onClick={onPin} title={note.is_pinned ? 'Désépingler' : 'Épingler'} style={{ ...tbBtn, color: note.is_pinned ? c.accent : '#6B7280' }}><Pin size={14} fill={note.is_pinned ? c.accent : 'none'} /></button>
        <button onClick={onDelete} title="Supprimer" style={{ ...tbBtn, color: '#EF4444' }}><Trash2 size={14} /></button>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <input value={title} onChange={e => { setTitle(e.target.value); setEditing(true); }} onBlur={save} placeholder="Sans titre" style={{ width: '100%', border: 'none', outline: 'none', fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>
          {note.client_name && <Link to={`/clients/${note.client_id}`} style={{ color: c.accent, textDecoration: 'none' }}>📁 {note.client_name}</Link>}
          <span>·</span>
          <span>Créé {fmtTime(note.created_at)}</span>
          <span>·</span>
          <span>Modifié {fmtTime(note.updated_at)}</span>
        </div>

        <input value={tags} onChange={e => { setTags(e.target.value); setEditing(true); }} onBlur={save} placeholder="Tags (séparés par des virgules)" style={{ width: '100%', border: '1px dashed #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 12, marginBottom: 16, outline: 'none', background: 'transparent', color: '#6B7280', boxSizing: 'border-box' }} />

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
const countBadge: React.CSSProperties = { marginLeft: 'auto', fontSize: 10, color: '#9CA3AF', fontWeight: 600 };
function notebookBtn(active: boolean): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', width: '100%', padding: '7px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: active ? '#111827' : '#374151', background: active ? '#F3F4F6' : 'transparent', textAlign: 'left', fontWeight: active ? 600 : 400, marginBottom: 1 };
}
