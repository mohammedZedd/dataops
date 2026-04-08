import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, Plus, X, MessageSquare, Calendar, LayoutGrid, List,
  AlertCircle, Loader2, Trash2, Search,
} from 'lucide-react';
import apiClient from '../api/axios';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserBrief { id: string; name: string; initials: string; role?: string }
interface ClientBrief { id: string; name: string }
interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  due_date: string | null;
  status: string;
  progress: number;
  priority: string;
  comments_count: number;
  client_id: string | null;
  client_name: string | null;
  assignee: UserBrief | null;
  created_by: UserBrief | null;
  created_at: string;
}
interface Comment { id: string; content: string; created_at: string; author_name: string; author_initials: string }

// ─── Config ──────────────────────────────────────────────────────────────────

const TASK_TYPES = [
  { key: 'envoyer_document', label: 'Envoyer document', short: 'Email' },
  { key: 'appeler_client', label: 'Appel', short: 'Appel' },
  { key: 'relance_paiement', label: 'Relance paiement', short: 'Relance' },
  { key: 'reunion', label: 'Réunion', short: 'Réunion' },
  { key: 'validation_facture', label: 'Validation facture', short: 'Validation' },
  { key: 'declaration_fiscale', label: 'Déclaration fiscale', short: 'Fiscal' },
  { key: 'bilan_annuel', label: 'Bilan annuel', short: 'Bilan' },
  { key: 'autre', label: 'Autre', short: 'Autre' },
];
const getTaskType = (k: string) => TASK_TYPES.find(t => t.key === k) || TASK_TYPES[7];

const COLUMNS = [
  { key: 'todo',        label: 'À faire',  color: '#6B7280', bg: '#F9FAFB', headerBg: '#F3F4F6' },
  { key: 'in_progress', label: 'En cours', color: '#3B82F6', bg: '#EFF6FF', headerBg: '#DBEAFE' },
  { key: 'in_review',   label: 'En revue', color: '#7C3AED', bg: '#F5F3FF', headerBg: '#EDE9FE' },
  { key: 'done',        label: 'Terminé',  color: '#16A34A', bg: '#F0FDF4', headerBg: '#DCFCE7' },
  { key: 'cancelled',   label: 'Annulé',   color: '#EF4444', bg: '#FEF2F2', headerBg: '#FECACA' },
];

const PRIORITY = {
  low:    { color: '#3B82F6', label: 'Basse',   bg: '#EFF6FF' },
  normal: { color: '#F59E0B', label: 'Moyenne', bg: '#FFFBEB' },
  high:   { color: '#F97316', label: 'Haute',   bg: '#FFF7ED' },
  urgent: { color: '#EF4444', label: 'Urgente', bg: '#FEF2F2' },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function fmtTimeAgo(iso: string): string {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function isOverdue(iso: string | null, status: string): boolean {
  if (!iso || status === 'done' || status === 'cancelled') return false;
  return new Date(iso) < new Date();
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accountants, setAccountants] = useState<UserBrief[]>([]);
  const [clients, setClients] = useState<ClientBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterRange, setFilterRange] = useState<'all' | 'week' | 'month' | 'overdue'>('all');

  // New task
  const [showNew, setShowNew] = useState(false);
  const defaultNew = { title: '', description: '', task_type: '', due_date: '', priority: 'normal', assigned_to_id: '', client_id: '' };
  const [newTask, setNewTask] = useState(defaultNew);

  // Detail modal
  const [selected, setSelected] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  // ── Fetch ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/tasks');
      setTasks(data.tasks ?? []);
      setAccountants(data.accountants ?? []);
      setClients(data.clients ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Comments ──
  useEffect(() => {
    if (!selected) return;
    (async () => {
      try { const { data } = await apiClient.get(`/clients/${selected.client_id}/tasks/${selected.id}/comments`); setComments(data); }
      catch { setComments([]); }
    })();
  }, [selected?.id, selected?.client_id]);

  // ── Filtering ──
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86400_000);
  const monthFromNow = new Date(now.getTime() + 30 * 86400_000);

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !(t.description ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterAssignee && t.assignee?.id !== filterAssignee) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterType && t.task_type !== filterType) return false;
    if (filterClient && t.client_id !== filterClient) return false;
    if (filterRange === 'overdue' && !isOverdue(t.due_date, t.status)) return false;
    if (filterRange === 'week' && (!t.due_date || new Date(t.due_date) > weekFromNow)) return false;
    if (filterRange === 'month' && (!t.due_date || new Date(t.due_date) > monthFromNow)) return false;
    return true;
  });

  // ── Handlers ──
  async function handleCreate() {
    if (!newTask.title.trim() || !newTask.task_type || !newTask.client_id) return;
    try {
      await apiClient.post(`/clients/${newTask.client_id}/tasks`, {
        ...newTask,
        assigned_to_id: newTask.assigned_to_id || null,
      });
      setShowNew(false); setNewTask(defaultNew);
      fetchAll();
    } catch { /* */ }
  }

  async function handleUpdate(task: Task, updates: Record<string, unknown>) {
    if (!task.client_id) return;
    try {
      await apiClient.patch(`/clients/${task.client_id}/tasks/${task.id}`, updates);
      fetchAll();
      if (selected && selected.id === task.id) {
        setSelected({ ...selected, ...updates } as Task);
      }
    } catch { /* */ }
  }

  async function handleDelete(task: Task) {
    if (!confirm('Supprimer cette tâche ?')) return;
    if (!task.client_id) return;
    try { await apiClient.delete(`/clients/${task.client_id}/tasks/${task.id}`); fetchAll(); setSelected(null); } catch { /* */ }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !selected || !selected.client_id) return;
    try {
      const { data } = await apiClient.post(`/clients/${selected.client_id}/tasks/${selected.id}/comments`, { content: newComment.trim() });
      setComments(prev => [...prev, data]);
      setNewComment('');
      fetchAll();
    } catch { /* */ }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckSquare size={22} /> Tâches
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>Gérez les tâches de tous vos clients</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', gap: 0, background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
            <button onClick={() => setView('kanban')} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: view === 'kanban' ? 600 : 400, background: view === 'kanban' ? 'white' : 'transparent', color: view === 'kanban' ? '#111827' : '#6B7280', boxShadow: view === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}><LayoutGrid size={14} /> Kanban</button>
            <button onClick={() => setView('list')} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: view === 'list' ? 600 : 400, background: view === 'list' ? 'white' : 'transparent', color: view === 'list' ? '#111827' : '#6B7280', boxShadow: view === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}><List size={14} /> Liste</button>
          </div>
          <button onClick={() => setShowNew(true)} style={{ padding: '9px 18px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Nouvelle tâche</button>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une tâche..." style={{ width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px 0 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={selStyle}><option value="">Tous les clients</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={selStyle}><option value="">Tous les assignés</option>{accountants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={selStyle}><option value="">Toutes priorités</option><option value="urgent">Urgente</option><option value="high">Haute</option><option value="normal">Moyenne</option><option value="low">Basse</option></select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selStyle}><option value="">Tous types</option>{TASK_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
        <select value={filterRange} onChange={e => setFilterRange(e.target.value as 'all' | 'week' | 'month' | 'overdue')} style={selStyle}><option value="all">Toutes échéances</option><option value="week">Cette semaine</option><option value="month">Ce mois</option><option value="overdue">En retard</option></select>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={24} className="animate-spin" color="#3B82F6" /></div>}

      {/* New task form */}
      {showNew && (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Nouvelle tâche</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}><label style={lblStyle}>Titre *</label><input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="Ex: Envoyer le bilan 2026" style={inputStyle} /></div>
            <div><label style={lblStyle}>Client *</label><select value={newTask.client_id} onChange={e => setNewTask({ ...newTask, client_id: e.target.value })} style={inputStyle}><option value="">Sélectionner...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label style={lblStyle}>Type *</label><select value={newTask.task_type} onChange={e => setNewTask({ ...newTask, task_type: e.target.value })} style={inputStyle}><option value="">Sélectionner...</option>{TASK_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
            <div><label style={lblStyle}>Priorité</label><select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={inputStyle}><option value="low">Basse</option><option value="normal">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></div>
            <div><label style={lblStyle}>Échéance</label><input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} style={inputStyle} /></div>
            <div><label style={lblStyle}>Assigné à</label><select value={newTask.assigned_to_id} onChange={e => setNewTask({ ...newTask, assigned_to_id: e.target.value })} style={inputStyle}><option value="">Non assigné</option>{accountants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lblStyle}>Description</label><textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="Détails..." rows={2} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'none', fontFamily: 'inherit' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowNew(false); setNewTask(defaultNew); }} style={{ padding: '9px 18px', background: 'white', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>Annuler</button>
            <button onClick={handleCreate} disabled={!newTask.title.trim() || !newTask.task_type || !newTask.client_id} style={{ padding: '9px 20px', background: newTask.title.trim() && newTask.task_type && newTask.client_id ? '#3B82F6' : '#E5E7EB', color: newTask.title.trim() && newTask.task_type && newTask.client_id ? 'white' : '#9CA3AF', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Créer la tâche</button>
          </div>
        </div>
      )}

      {/* Kanban */}
      {view === 'kanban' && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.key);
            return (
              <div key={col.key} style={{ background: col.bg, borderRadius: 12, overflow: 'hidden', minHeight: 200 }}>
                <div style={{ background: col.headerBg, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: col.color }}>{col.label}</span>
                  <span style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 600, color: col.color }}>{colTasks.length}</span>
                </div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colTasks.map(task => <KanbanCard key={task.id} task={task} onClick={() => setSelected(task)} />)}
                  {colTasks.length === 0 && <div style={{ textAlign: 'center', padding: '20px 10px', color: '#9CA3AF', fontSize: 12 }}>Aucune tâche</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {view === 'list' && !loading && (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>Aucune tâche</div>
          ) : filtered.map((t, i) => {
            const tt = getTaskType(t.task_type);
            const pc = PRIORITY[t.priority as keyof typeof PRIORITY] || PRIORITY.normal;
            const colCfg = COLUMNS.find(c => c.key === t.status);
            return (
              <div key={t.id} onClick={() => setSelected(t)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                <div style={{ width: 4, height: 24, borderRadius: 2, background: pc.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: t.status === 'done' ? '#9CA3AF' : '#111827', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{tt.label}</span>
                    {t.client_name && <span>· {t.client_name}</span>}
                  </div>
                </div>
                {colCfg && <span style={{ background: colCfg.headerBg, color: colCfg.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{colCfg.label}</span>}
                <span style={{ background: pc.bg, color: pc.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{pc.label}</span>
                {t.due_date && <span style={{ fontSize: 11, color: isOverdue(t.due_date, t.status) ? '#EF4444' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>{isOverdue(t.due_date, t.status) && <AlertCircle size={11} />}<Calendar size={11} /> {fmtDate(t.due_date)}</span>}
                {t.assignee ? <div title={t.assignee.name} style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.assignee.initials}</div> : <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px dashed #D1D5DB', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail slide-over */}
      {selected && <TaskDetail task={selected} comments={comments} newComment={newComment} setNewComment={setNewComment} accountants={accountants} onClose={() => setSelected(null)} onUpdate={(u) => handleUpdate(selected, u)} onDelete={() => handleDelete(selected)} onAddComment={handleAddComment} />}
    </div>
  );
}

// ─── KanbanCard ──────────────────────────────────────────────────────────────

function KanbanCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const tt = getTaskType(task.task_type);
  const pc = PRIORITY[task.priority as keyof typeof PRIORITY] || PRIORITY.normal;
  return (
    <div onClick={onClick} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s', borderLeft: `3px solid ${pc.color}` }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ background: '#F3F4F6', color: '#6B7280', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{tt.short}</span>
        <span style={{ background: pc.bg, color: pc.color, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>{pc.label}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6, lineHeight: 1.4 }}>{task.title}</div>
      {task.client_name && <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>📁 {task.client_name}</div>}
      <div style={{ background: '#F3F4F6', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${task.progress}%`, background: task.status === 'done' ? '#22C55E' : '#3B82F6', height: '100%' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {task.due_date ? <span style={{ fontSize: 10, color: isOverdue(task.due_date, task.status) ? '#EF4444' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10} /> {fmtDate(task.due_date)}</span> : <span />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {task.comments_count > 0 && <span style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 2 }}><MessageSquare size={10} /> {task.comments_count}</span>}
          {task.assignee ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={task.assignee.name}>{task.assignee.initials}</div> : <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px dashed #D1D5DB' }} />}
        </div>
      </div>
    </div>
  );
}

// ─── Detail Slide-over ───────────────────────────────────────────────────────

function TaskDetail({ task, comments, newComment, setNewComment, accountants, onClose, onUpdate, onDelete, onAddComment }: {
  task: Task; comments: Comment[]; newComment: string; setNewComment: (v: string) => void;
  accountants: UserBrief[]; onClose: () => void; onUpdate: (u: Record<string, unknown>) => void;
  onDelete: () => void; onAddComment: () => void;
}) {
  const tt = getTaskType(task.task_type);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, width: 560, height: '100vh', background: 'white', boxShadow: '-10px 0 40px rgba(0,0,0,0.15)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F3F4F6', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>{tt.label}</div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{task.title}</h3>
            {task.client_name && <Link to={`/clients/${task.client_id}`} style={{ fontSize: 12, color: '#3B82F6', marginTop: 6, display: 'inline-block' }}>📁 {task.client_name}</Link>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onDelete} title="Supprimer" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}><Trash2 size={14} /></button>
            <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Status transitions */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {COLUMNS.map(c => (
              <button key={c.key} onClick={() => onUpdate({ status: c.key })} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: task.status === c.key ? `2px solid ${c.color}` : '1px solid #E5E7EB', background: task.status === c.key ? c.headerBg : 'white', color: task.status === c.key ? c.color : '#6B7280' }}>{c.label}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div><div style={lblStyle}>Assigné à</div><select value={task.assignee?.id || ''} onChange={e => onUpdate({ assigned_to_id: e.target.value || null })} style={inputStyle}><option value="">Non assigné</option>{accountants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><div style={lblStyle}>Priorité</div><select value={task.priority} onChange={e => onUpdate({ priority: e.target.value })} style={inputStyle}><option value="low">Basse</option><option value="normal">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></div>
            <div><div style={lblStyle}>Échéance</div><input type="date" value={task.due_date?.split('T')[0] || ''} onChange={e => onUpdate({ due_date: e.target.value })} style={inputStyle} /></div>
            <div>
              <div style={lblStyle}>Progression — {task.progress}%</div>
              <input type="range" min="0" max="100" value={task.progress} onChange={e => onUpdate({ progress: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#3B82F6' }} />
            </div>
          </div>

          {task.description && (
            <div style={{ marginBottom: 20 }}>
              <div style={lblStyle}>Description</div>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px', border: '1px solid #F3F4F6' }}>{task.description}</div>
            </div>
          )}

          {/* Activity log (basic) */}
          <div style={{ marginBottom: 20 }}>
            <div style={lblStyle}>Activité</div>
            <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
              Créé {task.created_by ? `par ${task.created_by.name}` : ''} · {fmtTimeAgo(task.created_at)}
            </div>
          </div>

          {/* Comments */}
          <div>
            <div style={{ ...lblStyle, display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={13} /> Commentaires {comments.length > 0 && <span style={{ background: '#EFF6FF', color: '#3B82F6', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>{comments.length}</span>}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {comments.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 8 }}>Aucun commentaire</div>}
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.author_initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</span><span style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtTimeAgo(c.created_at)}</span></div>
                    <div style={{ background: '#F9FAFB', borderRadius: '0 10px 10px 10px', padding: '10px 14px', border: '1px solid #F3F4F6', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{c.content}</div>
                  </div>
                </div>
              ))}
            </div>
            <textarea value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddComment(); } }} placeholder="Ajouter un commentaire..." rows={2} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            {newComment.trim() && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => setNewComment('')} style={{ padding: '6px 12px', fontSize: 12, background: 'white', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer' }}>Annuler</button>
                <button onClick={onAddComment} style={{ padding: '6px 14px', fontSize: 12, background: '#3B82F6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Commenter</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = { width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' };
const lblStyle: React.CSSProperties = { fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 6 };
const selStyle: React.CSSProperties = { height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 10px', fontSize: 13, outline: 'none', background: 'white', cursor: 'pointer' };
