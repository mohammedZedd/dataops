import { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Calendar, Clock, CheckCircle, TrendingUp,
  Ban, Power, AlertCircle, Loader2, X, Pencil, Search, Save, Users,
} from 'lucide-react';
import apiClient from '../api/axios';
import { getClients, getAssignedClients, setAssignedClients } from '../api/clients';
import { useToast } from '../context/ToastContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  role: string;
  role_label: string;
  is_active: boolean;
  created_at: string;
  last_seen: string | null;
}

interface AssignedClient {
  id: string;
  name: string;
  open_tasks: number;
  total_tasks: number;
  last_activity: string | null;
}

interface MemberTask {
  id: string;
  title: string;
  task_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  client_name: string | null;
  client_id: string | null;
  is_overdue: boolean;
}

interface Performance {
  weeks: { label: string; count: number }[];
  completion_rate: number;
  avg_processing_days: number;
  total_done: number;
}

interface Activity { type: string; at: string; label: string; client_name: string }

interface MemberDetail {
  member: Member;
  clients: AssignedClient[];
  tasks: MemberTask[];
  performance: Performance;
  activity: Activity[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtTimeAgo(iso: string): string {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `Il y a ${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const PRIORITY_CFG: Record<string, { color: string }> = {
  low:    { color: '#3B82F6' },
  normal: { color: '#F59E0B' },
  high:   { color: '#F97316' },
  urgent: { color: '#EF4444' },
};

const kanbanCols = [
  { key: 'todo',        label: 'À faire',  color: '#6B7280', bg: '#F9FAFB', headerBg: '#F3F4F6' },
  { key: 'in_progress', label: 'En cours', color: '#3B82F6', bg: '#EFF6FF', headerBg: '#DBEAFE' },
  { key: 'in_review',   label: 'En revue', color: '#7C3AED', bg: '#F5F3FF', headerBg: '#EDE9FE' },
  { key: 'done',        label: 'Terminé',  color: '#16A34A', bg: '#F0FDF4', headerBg: '#DCFCE7' },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeamMemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskClientFilter, setTaskClientFilter] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('');

  // ── Edit modal ───────────────────────────────────────────────────────────
  const [editOpen,   setEditOpen]   = useState(false);
  const [editFirst,  setEditFirst]  = useState('');
  const [editLast,   setEditLast]   = useState('');
  const [editPhone,  setEditPhone]  = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editErr,    setEditErr]    = useState<string | null>(null);

  function openEdit() {
    if (!data) return;
    setEditFirst(data.member.name.split(' ')[0] ?? '');
    setEditLast(data.member.name.split(' ').slice(1).join(' ') ?? '');
    setEditPhone(data.member.phone ?? '');
    setEditErr(null);
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!memberId || !editFirst.trim() || !editLast.trim()) {
      setEditErr('Le prénom et le nom sont obligatoires.');
      return;
    }
    setEditSaving(true);
    setEditErr(null);
    try {
      await apiClient.patch(`/team/${memberId}`, {
        first_name:   editFirst.trim(),
        last_name:    editLast.trim(),
        phone_number: editPhone.trim() || null,
      });
      // Recharger les données pour refléter les changements
      const r = await apiClient.get(`/team/${memberId}`);
      setData(r.data);
      setEditOpen(false);
      toast.success('Informations mises à jour.');
    } catch {
      setEditErr('Impossible de mettre à jour les informations.');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Assignation ──────────────────────────────────────────────────────────
  const [allClients, setAllClients] = useState<{ id: string; name: string }[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [editingAssign, setEditingAssign] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [saving, setSaving] = useState(false);
  // snapshot pour annuler
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadAssignments = useCallback(async () => {
    if (!memberId) return;
    try {
      const [clients, assigned] = await Promise.all([
        getClients(),
        getAssignedClients(memberId),
      ]);
      setAllClients(clients.map(c => ({ id: c.id, name: c.name })));
      const ids = new Set(assigned.map(c => c.id));
      setAssignedIds(ids);
      setSavedIds(ids);
    } catch { /* */ }
  }, [memberId]);

  useEffect(() => {
    if (!memberId) return;
    setLoading(true);
    Promise.all([
      apiClient.get(`/team/${memberId}`),
      loadAssignments(),
    ])
      .then(([r]) => setData(r.data))
      .catch(() => {/* */})
      .finally(() => setLoading(false));
  }, [memberId, loadAssignments]);

  async function handleSaveAssignment() {
    if (!memberId) return;
    setSaving(true);
    try {
      await setAssignedClients(memberId, Array.from(assignedIds));
      setSavedIds(new Set(assignedIds));
      setEditingAssign(false);
      // Recharger les données du membre pour mettre à jour clients_count
      const r = await apiClient.get(`/team/${memberId}`);
      setData(r.data);
      toast.success(`${assignedIds.size} client${assignedIds.size !== 1 ? 's' : ''} assigné${assignedIds.size !== 1 ? 's' : ''} avec succès.`);
    } catch {
      toast.error("Impossible de sauvegarder l'assignation. Réessayez.");
    }
    finally { setSaving(false); }
  }

  function handleCancelAssignment() {
    setAssignedIds(new Set(savedIds));
    setEditingAssign(false);
    setAssignSearch('');
  }

  function toggleClient(id: string) {
    setAssignedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filteredPickerClients = useMemo(() =>
    allClients.filter(c => c.name.toLowerCase().includes(assignSearch.toLowerCase())),
    [allClients, assignSearch]
  );

  // Clients actuellement assignés (pour l'affichage en mode lecture)
  const assignedClientsList = useMemo(() =>
    allClients.filter(c => savedIds.has(c.id)),
    [allClients, savedIds]
  );

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter(t => {
      if (taskClientFilter && t.client_id !== taskClientFilter) return false;
      if (taskPriorityFilter && t.priority !== taskPriorityFilter) return false;
      return true;
    });
  }, [data, taskClientFilter, taskPriorityFilter]);

  async function handleToggle() {
    if (!data || !memberId) return;
    const action = data.member.is_active ? 'Désactiver' : 'Réactiver';
    if (!confirm(`${action} ${data.member.name} ?`)) return;
    try {
      await apiClient.patch(`/team/${memberId}/active`);
      const newActive = !data.member.is_active;
      setData(prev => prev ? { ...prev, member: { ...prev.member, is_active: newActive } } : null);
      toast.success(`${data.member.name} a été ${newActive ? 'réactivé' : 'désactivé'}.`);
    } catch {
      toast.error('Impossible de modifier le statut.');
    }
  }

  const maxWeek = data ? Math.max(1, ...data.performance.weeks.map(w => w.count)) : 1;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={28} className="animate-spin" color="#3B82F6" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '40px 32px', textAlign: 'center' }}>
        <AlertCircle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: '#6B7280', fontSize: 14 }}>Membre introuvable.</p>
        <button onClick={() => navigate('/equipe')} style={{ marginTop: 12, padding: '8px 16px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          Retour à l'équipe
        </button>
      </div>
    );
  }

  const isAdmin = data.member.role === 'admin';

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Breadcrumb + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button
          onClick={() => navigate('/equipe')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280', padding: 0 }}
        >
          <ArrowLeft size={16} /> Équipe du cabinet
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={openEdit}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: '1px solid #E5E7EB',
              background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151',
            }}
          >
            <Pencil size={14} /> Modifier
          </button>
          <button
            onClick={handleToggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: '1px solid #E5E7EB',
              background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151',
            }}
          >
            {data.member.is_active ? <><Ban size={14} /> Désactiver</> : <><Power size={14} /> Réactiver</>}
          </button>
        </div>
      </div>

      {/* Header */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '24px 28px', marginBottom: 24, display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          background: isAdmin ? 'linear-gradient(135deg,#3B82F6,#1D4ED8)' : 'linear-gradient(135deg,#10B981,#047857)',
          color: 'white', fontSize: 20, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {data.member.initials}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>{data.member.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: isAdmin ? '#FEF3C7' : '#EFF6FF', color: isAdmin ? '#C2410C' : '#3B82F6' }}>
              {data.member.role_label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: data.member.is_active ? '#DCFCE7' : '#F3F4F6', color: data.member.is_active ? '#16A34A' : '#6B7280' }}>
              {data.member.is_active ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InfoCell icon={<Mail size={14} />} label="Email" value={data.member.email} />
          <InfoCell icon={<Phone size={14} />} label="Téléphone" value={data.member.phone || '—'} />
          <InfoCell icon={<Calendar size={14} />} label="Date d'entrée" value={fmtDate(data.member.created_at)} />
          <InfoCell icon={<Clock size={14} />} label="Dernière activité" value={fmtDateTime(data.member.last_seen)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Performance */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 24px' }}>
          <Section title="Performance">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <StatBox icon={<CheckCircle size={16} />} color="#16A34A" label="Terminées" value={data.performance.total_done} />
              <StatBox icon={<TrendingUp size={16} />} color="#3B82F6" label="Taux à temps" value={`${data.performance.completion_rate}%`} />
              <StatBox icon={<Clock size={16} />} color="#F59E0B" label="Temps moyen" value={`${data.performance.avg_processing_days} j`} />
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '14px 16px', border: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>Tâches terminées / semaine</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
                {data.performance.weeks.map((w, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: '100%', background: '#3B82F6', borderRadius: '4px 4px 0 0', height: `${(w.count / maxWeek) * 64}px`, minHeight: 2, position: 'relative' }}>
                      {w.count > 0 && <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: '#3B82F6' }}>{w.count}</span>}
                    </div>
                    <span style={{ fontSize: 9, color: '#9CA3AF' }}>{w.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>

        {/* Clients assignés */}
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 24px' }}>
          {/* En-tête section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Clients assignés ({savedIds.size})
            </h4>
            {!editingAssign ? (
              <button
                onClick={() => setEditingAssign(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                <Pencil size={12} /> Modifier
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleCancelAssignment}
                  style={{ fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveAssignment}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'white', background: '#3B82F6', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Sauvegarder
                </button>
              </div>
            )}
          </div>

          {/* Mode édition — sélecteur de clients */}
          {editingAssign ? (
            <div>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                <input
                  autoFocus
                  value={assignSearch}
                  onChange={e => setAssignSearch(e.target.value)}
                  placeholder="Rechercher un client…"
                  style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {/* Compteur sélectionnés */}
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
                {assignedIds.size} client{assignedIds.size !== 1 ? 's' : ''} sélectionné{assignedIds.size !== 1 ? 's' : ''}
              </div>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                {filteredPickerClients.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Aucun client trouvé</div>
                ) : filteredPickerClients.map((c, i) => {
                  const checked = assignedIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleClient(c.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px',
                        borderTop: i > 0 ? '1px solid #F3F4F6' : 'none',
                        cursor: 'pointer',
                        background: checked ? '#EFF6FF' : 'white',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = checked ? '#EFF6FF' : 'white'; }}
                    >
                      {/* Checkbox custom */}
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: checked ? 'none' : '1.5px solid #D1D5DB',
                        background: checked ? '#3B82F6' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? '#1D4ED8' : '#374151' }}>
                        {c.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Mode lecture */
            assignedClientsList.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 8 }}>
                <Users size={20} style={{ margin: '0 auto 6px', display: 'block', opacity: 0.4 }} />
                Aucun client assigné — cliquez sur Modifier
              </div>
            ) : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                {assignedClientsList.map((c, i) => {
                  const detail = data.clients.find(x => x.id === c.id);
                  return (
                    <Link key={c.id} to={`/clients/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none', textDecoration: 'none', color: 'inherit', background: 'white' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{c.name}</div>
                        {detail && (
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                            {detail.open_tasks} tâche{detail.open_tasks !== 1 ? 's' : ''} ouverte{detail.open_tasks !== 1 ? 's' : ''} · {detail.total_tasks} au total
                          </div>
                        )}
                      </div>
                      {detail?.last_activity && (
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtTimeAgo(detail.last_activity)}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Kanban des tâches */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
        <Section title={`Suivi des tâches (${filteredTasks.length})`}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={taskClientFilter} onChange={e => setTaskClientFilter(e.target.value)} style={smallSel}>
              <option value="">Tous clients</option>
              {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={taskPriorityFilter} onChange={e => setTaskPriorityFilter(e.target.value)} style={smallSel}>
              <option value="">Toutes priorités</option>
              <option value="urgent">Urgente</option>
              <option value="high">Haute</option>
              <option value="normal">Moyenne</option>
              <option value="low">Basse</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {kanbanCols.map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col.key);
              const overdueCount = colTasks.filter(t => t.is_overdue).length;
              return (
                <div key={col.key} style={{ background: col.bg, borderRadius: 10, overflow: 'hidden', minHeight: 120 }}>
                  <div style={{ background: col.headerBg, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 11, color: col.color }}>{col.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {overdueCount > 0 && <span style={{ background: '#EF4444', color: 'white', borderRadius: 20, padding: '0 5px', fontSize: 9, fontWeight: 700 }}>{overdueCount} ⚠</span>}
                      <span style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 20, padding: '0 6px', fontSize: 10, fontWeight: 600, color: col.color }}>{colTasks.length}</span>
                    </div>
                  </div>
                  <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {colTasks.map(t => {
                      const pc = PRIORITY_CFG[t.priority] || PRIORITY_CFG.normal;
                      return (
                        <div key={t.id} style={{ background: 'white', borderRadius: 6, padding: '6px 8px', border: '1px solid #E5E7EB', borderLeft: `3px solid ${t.is_overdue ? '#EF4444' : pc.color}`, fontSize: 11 }}>
                          <div style={{ fontWeight: 600, color: '#111827', marginBottom: 2, lineHeight: 1.3 }}>{t.title}</div>
                          {t.client_name && <div style={{ color: '#9CA3AF', fontSize: 10 }}>📁 {t.client_name}</div>}
                          {t.due_date && <div style={{ color: t.is_overdue ? '#EF4444' : '#9CA3AF', fontSize: 10, marginTop: 2 }}>{fmtDate(t.due_date)}{t.is_overdue && ' ⚠'}</div>}
                        </div>
                      );
                    })}
                    {colTasks.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 10, padding: '12px 4px' }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Activité récente */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 24px' }}>
        <Section title="Activité récente">
          {data.activity.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 8 }}>Aucune activité récente</div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 2, background: '#E5E7EB' }} />
              {data.activity.map((a, i) => (
                <div key={i} style={{ position: 'relative', paddingBottom: 12 }}>
                  <div style={{ position: 'absolute', left: -18, top: 4, width: 10, height: 10, borderRadius: '50%', background: a.type === 'task_completed' ? '#22C55E' : '#3B82F6', border: '2px solid white' }} />
                  <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{a.label}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{a.client_name} · {fmtTimeAgo(a.at)}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Modal d'édition */}
      {editOpen && createPortal(
        <>
          <style>{`@keyframes mIn{from{opacity:0;transform:translate(-50%,-50%) scale(.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999 }} onClick={() => setEditOpen(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 420, background: '#fff', borderRadius: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            zIndex: 10000, animation: 'mIn 180ms ease-out forwards',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Modifier le membre</div>
              <button onClick={() => setEditOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={16} /></button>
            </div>
            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  Prénom
                  <input value={editFirst} onChange={e => setEditFirst(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, outline: 'none' }} />
                </label>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  Nom
                  <input value={editLast} onChange={e => setEditLast(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, outline: 'none' }} />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Téléphone
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+212 6 00 00 00 00" style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, outline: 'none' }} />
              </label>
              {editErr && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{editErr}</p>}
            </div>
            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditOpen(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3B82F6', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: editSaving ? 0.7 : 1 }}
              >
                {editSaving && <Loader2 size={13} className="animate-spin" />} Enregistrer
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h4>
      {children}
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 12px', border: '1px solid #F3F4F6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{icon} {label}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{value}</div>
    </div>
  );
}

function StatBox({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: number | string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{icon} {label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  );
}

const smallSel: React.CSSProperties = { height: 32, border: '1px solid #E5E7EB', borderRadius: 6, padding: '0 8px', fontSize: 12, outline: 'none', background: 'white', cursor: 'pointer' };
