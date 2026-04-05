import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, ChevronDown, ChevronUp, Calendar,
  User, Mail, Phone, Building2, Briefcase, FileText, ImageIcon,
  FileSpreadsheet, File as FileIcon, FolderOpen, Download,
  Pencil, ClipboardList, Loader2, Eye, Ban, RefreshCw, Mic, X, Trash2, Plus, Pin, StickyNote, MessageSquare,
} from 'lucide-react';
import apiClient from '../api/axios';
import { getClient, getClientUsers, updateClientUser, revokeClientAccess, restoreClientAccess } from '../api/clients';
import { getClientDocuments, getPresignedDownloadUrl, getPresignedPreviewUrl, createInvoiceFromDocument, uploadDocument, markDocumentViewed } from '../api/documents';
import type { AdminClientDoc } from '../api/documents';
import { SECTEURS_ACTIVITE, REGIMES_FISCAUX, FORMES_JURIDIQUES } from '../types';
import type { Client, ClientUser } from '../types';
import { SearchableSelect } from '../components/ui/SearchableSelect';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return <FileText size={18} color="#EF4444" />;
  if (['jpg', 'jpeg', 'png'].includes(ext)) return <ImageIcon size={18} color="#3B82F6" />;
  if (['xlsx', 'xls'].includes(ext)) return <FileSpreadsheet size={18} color="#16A34A" />;
  if (['webm', 'mp3', 'mp4', 'ogg', 'wav'].includes(ext)) return <Mic size={18} color="#7C3AED" />;
  return <FileIcon size={18} color="#6B7280" />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface MonthGroup { key: string; label: string; docs: AdminClientDoc[] }

function groupByMonth(docs: AdminClientDoc[]): MonthGroup[] {
  const map: Record<string, AdminClientDoc[]> = {};
  for (const doc of docs) {
    const d = new Date(doc.uploaded_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = [];
    map[key].push(doc);
  }
  return Object.keys(map).sort().reverse().map(key => {
    const [year, month] = key.split('-');
    const label = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return { key, label: label.charAt(0).toUpperCase() + label.slice(1), docs: map[key] };
  });
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 8,
  border: '1px solid #E5E7EB', outline: 'none', background: '#fff',
};

const INVOICE_STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  to_review: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', label: 'À traiter' },
  validated: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Validée' },
  rejected:  { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Rejetée' },
};

function isAudioDoc(doc: AdminClientDoc): boolean {
  return doc.doc_type === 'audio' || /\.(webm|mp3|mp4|ogg|wav)$/i.test(doc.file_name);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'details';
  const highlightDocId = searchParams.get('highlight');

  const [client,      setClient]      = useState<Client | null>(null);
  const [clientUser,  setClientUser]  = useState<ClientUser | null>(null);
  const [docs,        setDocs]        = useState<AdminClientDoc[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Edit
  const [editMode,    setEditMode]    = useState(false);
  const [editFirst,   setEditFirst]   = useState('');
  const [editLast,    setEditLast]    = useState('');
  const [editPhone,   setEditPhone]   = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editSecteur, setEditSecteur] = useState('');
  const [editRegime,  setEditRegime]  = useState('');
  const [editForme,   setEditForme]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState<string | null>(null);

  // Documents
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [creatingInv, setCreatingInv] = useState<string | null>(null);
  const [playingId,   setPlayingId]   = useState<string | null>(null);
  const [playingUrl,  setPlayingUrl]  = useState<string | null>(null);

  // Document filter
  const [docFilter, setDocFilter] = useState<'all' | 'client' | 'cabinet'>('all');

  // Revoke
  const [revoking, setRevoking] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [fiscalOpen, setFiscalOpen] = useState(false);

  // Admin upload
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Tasks
  interface TaskAssignee { id: string; name: string; initials: string; role: string }
  interface Task { id: string; title: string; description: string | null; task_type: string; due_date: string | null; due_year: number; due_month: number; status: string; progress: number; priority: string; assignee: TaskAssignee | null; created_by: TaskAssignee | null; created_at: string; completed_at: string | null }
  interface MonthData { month: number; month_name: string; tasks: Task[]; total: number; done: number; progress: number }
  interface YearData { year: number; months: MonthData[]; total: number; done: number; progress: number }
  const [groupedTasks, setGroupedTasks] = useState<YearData[]>([]);
  const [accountants, setAccountants] = useState<TaskAssignee[]>([]);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const defaultNewTask = { title: '', description: '', task_type: '', due_date: '', priority: 'normal', assigned_to_id: '' };
  const [newTask, setNewTask] = useState(defaultNewTask);
  const taskCount = groupedTasks.reduce((s, y) => s + y.total, 0);
  const doneTasks = groupedTasks.reduce((s, y) => s + y.done, 0);

  // Sub-tab + view
  const [notesSubTab, setNotesSubTab] = useState('tasks');
  const [taskView, setTaskView] = useState('kanban');

  // Task detail modal + comments
  interface TaskDetail extends Task { comments_count: number }
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  interface Comment { id: string; content: string; created_at: string; author_name: string; author_initials: string }
  const [taskComments, setTaskComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  // Notes (sticky notes)
  interface NoteAuthor { id: string | null; name: string; initials: string }
  interface Note { id: string; title: string | null; content: string; color: string; is_pinned: boolean; created_at: string; updated_at: string; author: NoteAuthor }
  const [notes, setNotes] = useState<Note[]>([]);
  const [showNewNoteForm, setShowNewNoteForm] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteColor, setNewNoteColor] = useState('yellow');

  const fetchData = useCallback(async () => {
    if (!clientId) { setError('ID manquant.'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [c, docsList, users] = await Promise.all([
        getClient(clientId), getClientDocuments(clientId), getClientUsers(),
      ]);
      setClient(c); setDocs(docsList);
      const groups = groupByMonth(docsList);
      if (groups.length > 0) setExpanded(new Set([groups[0].key]));
      setClientUser(users.find(u => u.client_id === clientId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function switchTab(tab: string) { setSearchParams({ tab }); }

  // Scroll to highlighted document from notification
  useEffect(() => {
    if (!highlightDocId || docs.length === 0) return;
    setTimeout(() => {
      const el = document.getElementById(`doc-${highlightDocId}`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.transition = 'background 0.5s'; el.style.background = '#DBEAFE'; setTimeout(() => { el.style.background = '#F0F9FF'; }, 1500); }
    }, 500);
  }, [highlightDocId, docs]);

  // ─── Edit handlers ─────────────────────────────────────────────────────────

  function enterEdit() {
    if (!clientUser) return;
    setEditFirst(clientUser.first_name); setEditLast(clientUser.last_name);
    setEditPhone(clientUser.phone_number ?? ''); setEditCompany(clientUser.client_company_name ?? '');
    setEditSecteur(client?.secteur_activite ?? ''); setEditRegime(client?.regime_fiscal ?? '');
    setEditForme(client?.forme_juridique ?? ''); setSaveMsg(null); setEditMode(true);
  }

  async function handleSave() {
    if (!clientUser) return;
    setSaving(true); setSaveMsg(null);
    try {
      const updated = await updateClientUser(clientUser.id, {
        first_name: editFirst.trim(), last_name: editLast.trim(),
        phone_number: editPhone.trim() || undefined, company_name: editCompany.trim() || undefined,
        secteur_activite: editSecteur || undefined, regime_fiscal: editRegime || undefined,
        forme_juridique: editForme || undefined,
      });
      setClientUser(updated);
      if (client) setClient({ ...client, name: editCompany.trim() || client.name, secteur_activite: editSecteur || client.secteur_activite, regime_fiscal: editRegime || client.regime_fiscal, forme_juridique: editForme || client.forme_juridique });
      setEditMode(false); setSaveMsg('Informations mises à jour');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch { setSaveMsg('Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  }

  async function handleRevoke() {
    if (!clientUser) return; setRevoking(true);
    try { await revokeClientAccess(clientUser.id); setClientUser({ ...clientUser, access_level: 'readonly' }); }
    catch { /* ignore */ } finally { setRevoking(false); }
  }

  async function handleReactivate() {
    if (!clientUser) return; setRevoking(true);
    try { await restoreClientAccess(clientUser.id); setClientUser({ ...clientUser, is_active: true, access_level: 'full' }); }
    catch { /* ignore */ } finally { setRevoking(false); }
  }

  // ─── Document handlers ─────────────────────────────────────────────────────

  async function handlePreview(doc: AdminClientDoc) {
    if (doc.is_new) { markDocumentViewed(doc.id).catch(() => {}); setDocs(p => p.map(d => d.id === doc.id ? { ...d, is_new: false } : d)); }
    try { const url = await getPresignedPreviewUrl(doc.id); window.open(url, '_blank'); } catch { /* */ }
  }

  async function handleDownload(docId: string) {
    try { const url = await getPresignedDownloadUrl(docId); window.open(url, '_blank'); } catch { /* */ }
  }

  async function handleCreateInvoice(docId: string) {
    if (!clientId) return; setCreatingInv(docId);
    try { const inv = await createInvoiceFromDocument(docId); navigate(`/clients/${clientId}/invoices/${inv.id}`); }
    catch { setError('Impossible de créer la facture.'); } finally { setCreatingInv(null); }
  }

  function handleViewInvoice(invoiceId: string) {
    if (!clientId) return;
    navigate(`/clients/${clientId}/invoices/${invoiceId}`);
  }

  async function handleAdminUpload() {
    if (!uploadFile || !clientId) return;
    setUploading(true);
    try {
      await uploadDocument(uploadFile, undefined, undefined, clientId);
      setUploadFile(null);
      setShowUpload(false);
      await fetchData();
    } catch { /* ignore */ }
    finally { setUploading(false); }
  }

  async function toggleAudioPlay(docId: string) {
    if (playingId === docId) { setPlayingId(null); setPlayingUrl(null); return; }
    try { const url = await getPresignedDownloadUrl(docId); setPlayingId(docId); setPlayingUrl(url); } catch { /* */ }
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    if (!clientId) return;
    try {
      const { data } = await apiClient.get(`/clients/${clientId}/tasks`);
      setGroupedTasks(data.grouped || []);
      setAccountants(data.accountants || []);
    } catch { /* */ }
  }, [clientId]);

  useEffect(() => { if (activeTab === 'notes') fetchTasks(); }, [activeTab, fetchTasks]);

  async function handleCreateTask() {
    if (!newTask.title.trim() || !newTask.task_type || !clientId) return;
    try {
      await apiClient.post(`/clients/${clientId}/tasks`, { ...newTask, assigned_to_id: newTask.assigned_to_id || null });
      setShowNewTaskForm(false); setNewTask(defaultNewTask);
      fetchTasks();
    } catch { /* */ }
  }

  async function handleUpdateTask(taskId: string, updates: Record<string, unknown>) {
    if (!clientId) return;
    try { await apiClient.patch(`/clients/${clientId}/tasks/${taskId}`, updates); fetchTasks(); } catch { /* */ }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Supprimer cette tâche ?')) return;
    try { await apiClient.delete(`/clients/${clientId}/tasks/${taskId}`); fetchTasks(); } catch { /* */ }
  }

  // ─── Task comments ────────────────────────────────────────────────────────

  const fetchComments = useCallback(async (taskId: string) => {
    if (!clientId) return;
    try { const { data } = await apiClient.get(`/clients/${clientId}/tasks/${taskId}/comments`); setTaskComments(data); } catch { /* */ }
  }, [clientId]);

  useEffect(() => { if (selectedTask) fetchComments(selectedTask.id); }, [selectedTask?.id, fetchComments]);

  async function handleAddComment() {
    if (!newComment.trim() || !selectedTask || !clientId) return;
    try {
      const { data } = await apiClient.post(`/clients/${clientId}/tasks/${selectedTask.id}/comments`, { content: newComment.trim() });
      setTaskComments(prev => [...prev, data]);
      setNewComment('');
      fetchTasks();
    } catch { /* */ }
  }

  // ─── Notes (sticky notes) ────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    if (!clientId) return;
    try { const { data } = await apiClient.get(`/clients/${clientId}/notes`); setNotes(data); } catch { /* */ }
  }, [clientId]);

  useEffect(() => { if (activeTab === 'notes' && notesSubTab === 'notes') fetchNotes(); }, [activeTab, notesSubTab, fetchNotes]);

  async function handleCreateNote() {
    if (!newNoteContent.trim() || !clientId) return;
    try {
      const { data } = await apiClient.post(`/clients/${clientId}/notes`, { title: newNoteTitle, content: newNoteContent, color: newNoteColor });
      setNotes(prev => [data, ...prev]);
      setShowNewNoteForm(false); setNewNoteTitle(''); setNewNoteContent(''); setNewNoteColor('yellow');
    } catch { /* */ }
  }

  async function handleUpdateNote(noteId: string, updates: { title?: string; content?: string; color?: string }) {
    if (!clientId) return;
    try { const { data } = await apiClient.patch(`/clients/${clientId}/notes/${noteId}`, updates); setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...data } : n)); } catch { /* */ }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Supprimer cette note ?')) return;
    try { await apiClient.delete(`/clients/${clientId}/notes/${noteId}`); setNotes(prev => prev.filter(n => n.id !== noteId)); } catch { /* */ }
  }

  async function handleTogglePin(noteId: string) {
    if (!clientId) return;
    try { const { data } = await apiClient.patch(`/clients/${clientId}/notes/${noteId}/pin`); setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_pinned: data.is_pinned } : n).sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))); } catch { /* */ }
  }

  // ─── Loading / Error ───────────────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="text-blue-500 animate-spin" /></div>;

  if (error && !client) return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-[13px] text-red-700">{error}</div>
      <div className="text-center py-8"><Link to="/clients" className="text-[13px] text-blue-600 hover:underline">← Retour aux clients</Link></div>
    </div>
  );

  if (!client) return (
    <div className="text-center py-24">
      <p className="text-[14px] font-semibold text-gray-600">Client introuvable.</p>
      <Link to="/clients" className="text-[13px] text-blue-600 hover:underline mt-2 inline-block">← Retour aux clients</Link>
    </div>
  );

  const initials = clientUser ? `${clientUser.first_name.charAt(0)}${clientUser.last_name.charAt(0)}`.toUpperCase() : client.name.charAt(0).toUpperCase();
  const displayName = clientUser ? `${clientUser.first_name} ${clientUser.last_name}` : client.name;
  const accessLevel = clientUser?.access_level ?? 'full';
  const isActive = (clientUser?.is_active ?? true) && accessLevel !== 'blocked' && accessLevel !== 'readonly';
  const groups = groupByMonth(docs);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Back */}
      <button onClick={() => navigate('/clients')}
        className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-blue-600 transition-colors mb-3">
        <ArrowLeft size={14} /> Clients
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 20, borderBottom: '1px solid #E5E7EB', marginBottom: 0 }}>
        <div style={{ height: 48, width: 48, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17, fontWeight: 700 }}>
          {initials}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{displayName}</p>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: isActive ? '#DCFCE7' : '#F3F4F6', color: isActive ? '#16A34A' : '#6B7280' }}>
              {isActive ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
            {clientUser?.email ?? ''}{clientUser?.email && client.name ? ' · ' : ''}{client.name}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '2px solid #F3F4F6', marginBottom: 28 }}>
        {[
          { key: 'details', label: 'Détails du client', icon: <User size={16} /> },
          { key: 'documents', label: 'Documents', icon: <FileText size={16} /> },
          { key: 'notes', label: 'Tâches & Notes', icon: <ClipboardList size={16} /> },
        ].map((tab, i) => (
          <div key={tab.key} style={{ display: 'contents' }}>
          {i > 0 && <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 4px', flexShrink: 0 }} />}
          <button onClick={() => switchTab(tab.key)} style={{
            padding: '14px 20px', fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 400,
            color: activeTab === tab.key ? '#3B82F6' : '#6B7280',
            borderBottom: activeTab === tab.key ? '2px solid #3B82F6' : '2px solid transparent',
            marginBottom: -2, background: 'none', border: 'none', borderBottomStyle: 'solid',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s',
          }}>
            {tab.icon}
            {tab.label}
            {tab.key === 'documents' && (
              <span style={{ fontSize: 12, padding: '1px 8px', borderRadius: 20, background: '#EFF6FF', color: '#3B82F6', fontWeight: 600, marginLeft: 2 }}>
                {docs.length}
              </span>
            )}
            {tab.key === 'notes' && taskCount > 0 && (
              <span style={{ fontSize: 12, padding: '1px 8px', borderRadius: 20, background: '#EFF6FF', color: '#3B82F6', fontWeight: 600, marginLeft: 2 }}>
                {taskCount}
              </span>
            )}
          </button>
          </div>
        ))}
      </div>

      {saveMsg && (
        <div style={{ maxWidth: 800, margin: '0 auto 16px', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: saveMsg.includes('Erreur') ? '#FEF2F2' : '#F0FDF4', color: saveMsg.includes('Erreur') ? '#DC2626' : '#16A34A', border: `1px solid ${saveMsg.includes('Erreur') ? '#FECACA' : '#BBF7D0'}` }}>
          {saveMsg}
        </div>
      )}

      {/* ═══ TAB: Details ═══ */}
      {activeTab === 'details' && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 0 32px' }}>

          {/* 2-column info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {clientUser && (
              <GridCell icon={<User size={16} />} iconBg="#EFF6FF" iconColor="#3B82F6" label="Nom complet">
                {editMode ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={editFirst} onChange={e => setEditFirst(e.target.value)} placeholder="Prénom" style={INPUT_STYLE} />
                    <input value={editLast} onChange={e => setEditLast(e.target.value)} placeholder="Nom" style={INPUT_STYLE} />
                  </div>
                ) : <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', marginTop: 4 }}>{displayName}</p>}
              </GridCell>
            )}
            {clientUser && (
              <GridCell icon={<Mail size={16} />} iconBg="#F5F3FF" iconColor="#7C3AED" label="Email">
                <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', marginTop: 4 }}>{clientUser.email}</p>
              </GridCell>
            )}
            {clientUser && (
              <GridCell icon={<Phone size={16} />} iconBg="#F0FDF4" iconColor="#16A34A" label="Téléphone">
                {editMode ? <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+212 6 00 00 00 00" style={INPUT_STYLE} />
                  : <p style={{ fontSize: 15, fontWeight: 500, color: clientUser.phone_number ? '#111827' : '#9CA3AF', marginTop: 4 }}>{clientUser.phone_number ?? '—'}</p>}
              </GridCell>
            )}
            <GridCell icon={<Building2 size={16} />} iconBg="#FFF7ED" iconColor="#EA580C" label="Entreprise">
              {editMode ? <input value={editCompany} onChange={e => setEditCompany(e.target.value)} placeholder="Nom entreprise" style={INPUT_STYLE} />
                : <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', marginTop: 4 }}>{client.name}</p>}
            </GridCell>
            <GridCell icon={<Briefcase size={16} />} iconBg="#F0FDF4" iconColor="#0D9488" label="Secteur d'activité">
              {editMode ? (
                <SearchableSelect options={SECTEURS_ACTIVITE} value={editSecteur} onChange={setEditSecteur} placeholder="Rechercher un secteur…" />
              ) : <p style={{ fontSize: 15, fontWeight: 500, color: client.secteur_activite ? '#111827' : '#9CA3AF', marginTop: 4 }}>{client.secteur_activite ?? '—'}</p>}
            </GridCell>
            <GridCell icon={<FileText size={16} />} iconBg="#EFF6FF" iconColor="#3B82F6" label="Régime fiscal">
              {editMode ? (
                <SearchableSelect options={REGIMES_FISCAUX} value={editRegime} onChange={setEditRegime} placeholder="Rechercher un régime…" />
              ) : <p style={{ fontSize: 15, fontWeight: 500, color: client.regime_fiscal ? '#111827' : '#9CA3AF', marginTop: 4 }}>{client.regime_fiscal ?? '—'}</p>}
            </GridCell>
            <GridCell icon={<Building2 size={16} />} iconBg="#FFF7ED" iconColor="#D97706" label="Forme juridique">
              {editMode ? (
                <SearchableSelect options={FORMES_JURIDIQUES} value={editForme} onChange={setEditForme} placeholder="Rechercher une forme…" />
              ) : <p style={{ fontSize: 15, fontWeight: 500, color: client.forme_juridique ? '#111827' : '#9CA3AF', marginTop: 4 }}>{client.forme_juridique ?? '—'}</p>}
            </GridCell>
            <GridCell icon={<Calendar size={16} />} iconBg="#F9FAFB" iconColor="#6B7280" label="Inscription">
              <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', marginTop: 4 }}>
                {new Date(client.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </GridCell>
          </div>

          {/* Fiscal IDs — collapsible */}
          <div style={{ marginTop: 16, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
            <button onClick={() => setFiscalOpen(v => !v)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px',
              background: '#F8FAFC', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#374151', flex: 1 }}>
                Identifiants fiscaux <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(Maroc)</span>
              </span>
              {fiscalOpen ? <ChevronUp size={15} color="#6B7280" /> : <ChevronDown size={15} color="#6B7280" />}
            </button>
            {fiscalOpen && (
              <div>
                {(['ice', 'if_number', 'rc', 'tp', 'cnss'] as const).map((field, i) => {
                  const labels: Record<string, string> = { ice: 'ICE', if_number: 'IF', rc: 'RC', tp: 'TP', cnss: 'CNSS' };
                  const val = (client as Record<string, unknown>)[field] as string | null | undefined;
                  return (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #F3F4F6' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', width: 48 }}>{labels[field]}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: val ? '#111827' : '#9CA3AF', fontFamily: val ? 'monospace' : 'inherit', fontStyle: val ? 'normal' : 'italic', flex: 1 }}>
                        {val ?? 'Non renseigné'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Edit / Save */}
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            {editMode ? (
              <>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button onClick={() => setEditMode(false)} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Annuler</button>
              </>
            ) : clientUser && (
              <button onClick={enterEdit} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #3B82F6', background: '#fff', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pencil size={13} /> Modifier les informations
              </button>
            )}
          </div>

          {/* Danger zone */}
          {clientUser && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E5E7EB' }}>
              {isActive ? (
                <button onClick={() => setShowLimitModal(true)} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #FED7AA', background: '#fff', color: '#C2410C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ban size={14} /> Limiter l'accès
                </button>
              ) : (
                <button onClick={() => setShowReactivateModal(true)} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #BBF7D0', background: '#fff', color: '#16A34A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={14} /> Réactiver l'accès
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Documents ═══ */}
      {activeTab === 'documents' && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Documents de {client.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#EFF6FF', color: '#3B82F6' }}>
                {docs.length} document{docs.length !== 1 ? 's' : ''} au total
              </span>
              <button onClick={() => setShowUpload(v => !v)} style={{ padding: '6px 14px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                + Ajouter
              </button>
            </div>
          </div>

          {/* Admin upload */}
          {showUpload && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <input ref={uploadInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" className="hidden" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); e.target.value = ''; }} />
              {uploadFile ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#111827', flex: 1 }}>{uploadFile.name}</span>
                  <button onClick={() => setUploadFile(null)} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>Changer</button>
                  <button onClick={handleAdminUpload} disabled={uploading}
                    style={{ padding: '8px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
                    {uploading ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              ) : (
                <button onClick={() => uploadInputRef.current?.click()}
                  style={{ width: '100%', padding: '24px 16px', border: '2px dashed #E5E7EB', borderRadius: 10, background: '#F9FAFB', cursor: 'pointer', textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
                  Cliquer pour sélectionner un fichier (PDF, JPG, PNG, XLSX)
                </button>
              )}
            </div>
          )}

          {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>{error}</div>}

          {/* Filter tabs */}
          {docs.length > 0 && (() => {
            const clientCount = docs.filter(d => d.source !== 'cabinet').length;
            const cabinetCount = docs.filter(d => d.source === 'cabinet').length;
            return (
              <div style={{ display: 'flex', gap: 0, background: '#F3F4F6', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 20 }}>
                {[{ key: 'all' as const, label: 'Tous', count: docs.length }, { key: 'client' as const, label: '📤 Du client', count: clientCount }, { key: 'cabinet' as const, label: '📥 Du cabinet', count: cabinetCount }].map(tab => (
                  <button key={tab.key} onClick={() => setDocFilter(tab.key)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: docFilter === tab.key ? 600 : 400, background: docFilter === tab.key ? '#fff' : 'transparent', color: docFilter === tab.key ? '#111827' : '#6B7280', boxShadow: docFilter === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tab.label}
                    {tab.count > 0 && <span style={{ background: docFilter === tab.key ? (tab.key === 'cabinet' ? '#EDE9FE' : '#EFF6FF') : '#E5E7EB', color: docFilter === tab.key ? (tab.key === 'cabinet' ? '#7C3AED' : '#3B82F6') : '#9CA3AF', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 600 }}>{tab.count}</span>}
                  </button>
                ))}
              </div>
            );
          })()}

          {(() => {
            const filteredDocs = docFilter === 'client' ? docs.filter(d => d.source !== 'cabinet') : docFilter === 'cabinet' ? docs.filter(d => d.source === 'cabinet') : docs;
            const filteredGroups = groupByMonth(filteredDocs);
            return filteredDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ height: 56, width: 56, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <FolderOpen size={26} color="#9CA3AF" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Aucun document</p>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Ce client n'a pas encore envoyé de documents.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredGroups.map(({ key, label, docs: groupDocs }) => (
                <div key={key} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB', background: '#fff' }}>
                  <button onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <Calendar size={15} color="#6B7280" />
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1F2937' }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 12, background: '#F3F4F6', color: '#6B7280' }}>
                      {groupDocs.length} doc{groupDocs.length !== 1 ? 's' : ''}
                    </span>
                    {expanded.has(key) ? <ChevronUp size={15} color="#6B7280" /> : <ChevronDown size={15} color="#6B7280" />}
                  </button>
                  {expanded.has(key) && groupDocs.map(doc => {
                    const docIsNew = doc.is_new;
                    const isCabinet = doc.source === 'cabinet';
                    const rowBg = docIsNew ? '#F0F9FF' : isCabinet ? '#FAF5FF' : '#fff';
                    return (
                    <div key={doc.id} id={`doc-${doc.id}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 12px 40px', borderTop: '1px solid #F3F4F6', background: rowBg, borderLeft: docIsNew ? '3px solid #3B82F6' : isCabinet ? '3px solid #DDD6FE' : '3px solid transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = rowBg; }}>
                        <div style={{ height: 36, width: 36, borderRadius: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {fileIcon(doc.file_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {doc.file_name}
                            {docIsNew && <span style={{ background: '#3B82F6', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', flexShrink: 0 }}>Nouveau</span>}
                          </p>
                          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                            {isAudioDoc(doc) ? (doc.description || 'Note vocale') : formatBytes(doc.file_size)}
                            {doc.source === 'cabinet' && <span style={{ marginLeft: 6, color: '#7C3AED', fontWeight: 500 }}>· 📥 Cabinet</span>}
                          </p>
                        </div>
                        {/* Badge */}
                        {isAudioDoc(doc) ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>Audio</span>
                        ) : doc.invoice_id && doc.invoice_status ? (
                          <button onClick={() => handleViewInvoice(doc.invoice_id!)} style={{
                            fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: INVOICE_STATUS_STYLES[doc.invoice_status]?.bg ?? '#F3F4F6',
                            color: INVOICE_STATUS_STYLES[doc.invoice_status]?.color ?? '#6B7280',
                            border: `1px solid ${INVOICE_STATUS_STYLES[doc.invoice_status]?.border ?? '#E5E7EB'}`,
                          }}>
                            {INVOICE_STATUS_STYLES[doc.invoice_status]?.label ?? doc.invoice_status}
                          </button>
                        ) : null}
                        {/* Date */}
                        <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                        {isAudioDoc(doc) ? (
                          /* Audio: play toggle */
                          <IconBtn onClick={() => toggleAudioPlay(doc.id)} title={playingId === doc.id ? 'Arrêter' : 'Écouter'}
                            active={playingId === doc.id} color="#7C3AED" bgHover="#F5F3FF">
                            {playingId === doc.id ? <X size={15} /> : <Eye size={15} />}
                          </IconBtn>
                        ) : (
                          /* Non-audio: preview + invoice */
                          <>
                            <IconBtn onClick={() => handlePreview(doc)} title="Prévisualiser">
                              <Eye size={15} />
                            </IconBtn>
                            {doc.invoice_id ? (
                              <IconBtn onClick={() => handleViewInvoice(doc.invoice_id!)} title="Voir la facture" color="#16A34A" bgHover="#F0FDF4">
                                <ClipboardList size={15} />
                              </IconBtn>
                            ) : (
                              <IconBtn onClick={() => handleCreateInvoice(doc.id)} title="Créer une facture" disabled={creatingInv === doc.id}>
                                {creatingInv === doc.id ? <Loader2 size={15} className="animate-spin" /> : <ClipboardList size={15} />}
                              </IconBtn>
                            )}
                          </>
                        )}
                        {/* Download */}
                        <IconBtn onClick={() => handleDownload(doc.id)} title="Télécharger">
                          <Download size={15} />
                        </IconBtn>
                      </div>
                      {/* Inline audio player */}
                      {playingId === doc.id && playingUrl && (
                        <div style={{ padding: '12px 20px 12px 48px', background: '#F5F3FF', borderTop: '1px solid #DDD6FE' }}>
                          <audio controls autoPlay style={{ width: '100%', height: 32 }} src={playingUrl} />
                          {doc.description && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>{doc.description}</p>}
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              ))}
            </div>
          );
          })()}
        </div>
      )}

      {/* ═══ TAB: Tâches & Notes ═══ */}
      {activeTab === 'notes' && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 0 32px' }}>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: 24 }}>
            {[{ key: 'tasks', label: 'Tâches' }, { key: 'notes', label: 'Notes' }].map(tab => (
              <button key={tab.key} onClick={() => setNotesSubTab(tab.key)} style={{ padding: '10px 24px', background: 'none', border: 'none', borderBottom: notesSubTab === tab.key ? '2px solid #3B82F6' : '2px solid transparent', marginBottom: -2, color: notesSubTab === tab.key ? '#3B82F6' : '#6B7280', fontWeight: notesSubTab === tab.key ? 600 : 400, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {tab.key === 'tasks' ? <ClipboardList size={15} /> : <StickyNote size={15} />}
                {tab.label}
                {tab.key === 'tasks' && taskCount > 0 && <span style={{ background: '#EFF6FF', color: '#3B82F6', borderRadius: 20, padding: '0 7px', fontSize: 11, fontWeight: 600 }}>{doneTasks}/{taskCount}</span>}
                {tab.key === 'notes' && notes.length > 0 && <span style={{ background: '#FFF7ED', color: '#C2410C', borderRadius: 20, padding: '0 7px', fontSize: 11, fontWeight: 600 }}>{notes.length}</span>}
              </button>
            ))}
          </div>

          {/* ── TASKS sub-tab ── */}
          {notesSubTab === 'tasks' && (<>
            {/* View toggle + new task button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 0, background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
                {[{ key: 'kanban', label: 'Kanban' }, { key: 'tree', label: 'Liste' }].map(v => (
                  <button key={v.key} onClick={() => setTaskView(v.key)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: taskView === v.key ? 600 : 400, background: taskView === v.key ? 'white' : 'transparent', color: taskView === v.key ? '#111827' : '#6B7280', boxShadow: taskView === v.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{v.label}</button>
                ))}
              </div>
              <button onClick={() => setShowNewTaskForm(true)} style={{ padding: '9px 18px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Nouvelle tâche</button>
            </div>

            {/* New task form */}
            {showNewTaskForm && (
              <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 24px', marginBottom: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Nouvelle tâche</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Titre *</label>
                    <input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="Ex: Envoyer le bilan 2026" style={{ width: '100%', height: 40, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div><label style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Type *</label><select value={newTask.task_type} onChange={e => setNewTask({ ...newTask, task_type: e.target.value })} style={{ width: '100%', height: 40, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer' }}><option value="">Sélectionner...</option>{TASK_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}</select></div>
                  <div><label style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Priorité</label><select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={{ width: '100%', height: 40, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer' }}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></div>
                  <div><label style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Échéance</label><input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} style={{ width: '100%', height: 40, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none', background: 'white', boxSizing: 'border-box' }} /></div>
                  <div><label style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Assigné à</label><select value={newTask.assigned_to_id} onChange={e => setNewTask({ ...newTask, assigned_to_id: e.target.value })} style={{ width: '100%', height: 40, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer' }}><option value="">Non assigné</option>{accountants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label><textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="Détails..." rows={2} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} /></div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowNewTaskForm(false); setNewTask(defaultNewTask); }} style={{ padding: '9px 18px', background: 'white', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>Annuler</button>
                  <button onClick={handleCreateTask} disabled={!newTask.title.trim() || !newTask.task_type} style={{ padding: '9px 20px', background: newTask.title.trim() && newTask.task_type ? '#3B82F6' : '#E5E7EB', color: newTask.title.trim() && newTask.task_type ? 'white' : '#9CA3AF', border: 'none', borderRadius: 8, cursor: newTask.title.trim() && newTask.task_type ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 13 }}>Créer la tâche</button>
                </div>
              </div>
            )}

            {/* Kanban view */}
            {taskView === 'kanban' && (
              (() => {
                const allTasks = groupedTasks.flatMap(y => y.months.flatMap(m => m.tasks));
                const cols = [
                  { key: 'todo', label: 'À faire', color: '#6B7280', bg: '#F9FAFB', headerBg: '#F3F4F6', icon: '○' },
                  { key: 'in_progress', label: 'En cours', color: '#3B82F6', bg: '#EFF6FF', headerBg: '#DBEAFE', icon: '◑' },
                  { key: 'done', label: 'Terminé', color: '#16A34A', bg: '#F0FDF4', headerBg: '#DCFCE7', icon: '✓' },
                  { key: 'cancelled', label: 'Annulé', color: '#EF4444', bg: '#FEF2F2', headerBg: '#FECACA', icon: '✕' },
                ];
                return allTasks.length === 0 && !showNewTaskForm ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
                    <div style={{ height: 56, width: 56, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><ClipboardList size={26} color="#3B82F6" /></div>
                    <div style={{ fontWeight: 500, color: '#374151', fontSize: 16 }}>Aucune tâche pour ce client</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>Créez des tâches pour suivre votre travail</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {cols.map(col => {
                      const colTasks = allTasks.filter(t => t.status === col.key);
                      return (
                        <div key={col.key} style={{ background: col.bg, borderRadius: 12, overflow: 'hidden', minHeight: 200 }}>
                          <div style={{ background: col.headerBg, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: col.color }}><span>{col.icon}</span> {col.label}</div>
                            <span style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 600, color: col.color }}>{colTasks.length}</span>
                          </div>
                          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {colTasks.map(task => <KanbanCard key={task.id} task={task} onOpenDetail={(t: TaskDetail) => setSelectedTask(t)} />)}
                            {colTasks.length === 0 && <div style={{ textAlign: 'center', padding: '20px 10px', color: '#9CA3AF', fontSize: 12 }}>Aucune tâche</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}

            {/* Tree view */}
            {taskView === 'tree' && (
              groupedTasks.length === 0 && !showNewTaskForm ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
                  <div style={{ height: 56, width: 56, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><ClipboardList size={26} color="#3B82F6" /></div>
                  <div style={{ fontWeight: 500, color: '#374151', fontSize: 16 }}>Aucune tâche pour ce client</div>
                </div>
              ) : (
                groupedTasks.map(yearGroup => (
                  <YearGroup key={yearGroup.year} yearGroup={yearGroup} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} accountants={accountants} />
                ))
              )
            )}
          </>)}

          {/* ── NOTES sub-tab ── */}
          {notesSubTab === 'notes' && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Notes privées sur {client.name} — visibles uniquement par votre cabinet</p>
              <button onClick={() => setShowNewNoteForm(true)} style={{ padding: '9px 18px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Nouvelle note</button>
            </div>
            {showNewNoteForm && (
              <div style={{ background: getNoteColor(newNoteColor).bg, border: `1px solid ${getNoteColor(newNoteColor).border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 20, borderLeft: `4px solid ${getNoteColor(newNoteColor).accent}` }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>{(['yellow', 'blue', 'green', 'pink', 'gray'] as const).map(c => (<button key={c} onClick={() => setNewNoteColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: getNoteColor(c).accent, border: newNoteColor === c ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />))}</div>
                <input value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} placeholder="Titre (optionnel)" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 15, fontWeight: 600, color: '#111827', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                <textarea value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} placeholder="Écrivez votre note ici..." autoFocus rows={4} style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 14, color: '#374151', outline: 'none', resize: 'none', lineHeight: 1.6, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setShowNewNoteForm(false); setNewNoteTitle(''); setNewNoteContent(''); setNewNoteColor('yellow'); }} style={{ padding: '7px 14px', background: 'white', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                  <button onClick={handleCreateNote} disabled={!newNoteContent.trim()} style={{ padding: '7px 16px', background: newNoteContent.trim() ? '#F59E0B' : '#E5E7EB', color: newNoteContent.trim() ? 'white' : '#9CA3AF', border: 'none', borderRadius: 8, cursor: newNoteContent.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 13 }}>Enregistrer</button>
                </div>
              </div>
            )}
            {notes.length === 0 && !showNewNoteForm ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
                <div style={{ height: 56, width: 56, borderRadius: '50%', background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><StickyNote size={26} color="#F59E0B" /></div>
                <div style={{ fontWeight: 500, color: '#374151', fontSize: 16 }}>Aucune note pour ce client</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>Ajoutez des notes, rappels ou observations</div>
                <button onClick={() => setShowNewNoteForm(true)} style={{ marginTop: 16, padding: '10px 24px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Créer la première note</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {notes.map(note => <NoteCard key={note.id} note={note} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} onPin={handleTogglePin} />)}
              </div>
            )}
          </>)}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (<>
        <div onClick={() => { setSelectedTask(null); setNewComment(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 620, maxHeight: '85vh', background: 'white', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.15)', zIndex: 10000, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F3F4F6', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>{getTaskType(selectedTask.task_type).icon} {getTaskType(selectedTask.task_type).label}</div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedTask.title}</h3>
            </div>
            <button onClick={() => { setSelectedTask(null); setNewComment(''); }} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div><div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Statut</div><select value={selectedTask.status} onChange={e => { handleUpdateTask(selectedTask.id, { status: e.target.value }); setSelectedTask({ ...selectedTask, status: e.target.value, progress: e.target.value === 'done' ? 100 : e.target.value === 'todo' ? 0 : selectedTask.progress }); }} style={{ width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 10px', fontSize: 13, cursor: 'pointer', background: 'white' }}><option value="todo">○ À faire</option><option value="in_progress">◑ En cours</option><option value="done">✓ Terminé</option><option value="cancelled">✕ Annulé</option></select></div>
              <div><div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Assigné à</div><select value={selectedTask.assignee?.id || ''} onChange={e => { handleUpdateTask(selectedTask.id, { assigned_to_id: e.target.value || null }); setSelectedTask({ ...selectedTask, assignee: accountants.find(a => a.id === e.target.value) || null }); }} style={{ width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 10px', fontSize: 13, cursor: 'pointer', background: 'white' }}><option value="">Non assigné</option>{accountants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Priorité</div><select value={selectedTask.priority} onChange={e => { handleUpdateTask(selectedTask.id, { priority: e.target.value }); setSelectedTask({ ...selectedTask, priority: e.target.value }); }} style={{ width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 10px', fontSize: 13, cursor: 'pointer', background: 'white' }}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></div>
              <div><div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Échéance</div><input type="date" value={selectedTask.due_date?.split('T')[0] || ''} onChange={e => { handleUpdateTask(selectedTask.id, { due_date: e.target.value }); setSelectedTask({ ...selectedTask, due_date: e.target.value }); }} style={{ width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 10px', fontSize: 13, background: 'white', boxSizing: 'border-box' }} /></div>
            </div>
            {/* Progress */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}><span>Progression</span><span style={{ color: '#3B82F6', fontSize: 13, fontWeight: 700 }}>{selectedTask.progress}%</span></div>
              <input type="range" min="0" max="100" value={selectedTask.progress} onChange={e => { const v = parseInt(e.target.value); handleUpdateTask(selectedTask.id, { progress: v }); setSelectedTask({ ...selectedTask, progress: v }); }} style={{ width: '100%', cursor: 'pointer', accentColor: '#3B82F6' }} />
              <div style={{ background: '#F3F4F6', borderRadius: 6, height: 8, overflow: 'hidden', marginTop: 4 }}><div style={{ width: `${selectedTask.progress}%`, background: selectedTask.progress === 100 ? '#22C55E' : '#3B82F6', height: '100%', borderRadius: 6, transition: 'width 0.3s' }} /></div>
            </div>
            {selectedTask.description && <div style={{ marginBottom: 20 }}><div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Description</div><div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px', border: '1px solid #F3F4F6' }}>{selectedTask.description}</div></div>}
            {/* Comments */}
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={13} /> Commentaires {taskComments.length > 0 && <span style={{ background: '#EFF6FF', color: '#3B82F6', borderRadius: 10, padding: '0 6px', fontSize: 10 }}>{taskComments.length}</span>}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {taskComments.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 8 }}>Aucun commentaire</div>}
                {taskComments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.author_initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</span><span style={{ fontSize: 11, color: '#9CA3AF' }}>{formatNoteTime(c.created_at)}</span></div>
                      <div style={{ background: '#F9FAFB', borderRadius: '0 10px 10px 10px', padding: '10px 14px', border: '1px solid #F3F4F6', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }} placeholder="Ajouter un commentaire..." rows={2} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }} />
                  {newComment.trim() && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}><button onClick={() => setNewComment('')} style={{ padding: '6px 12px', fontSize: 12, background: 'white', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer' }}>Annuler</button><button onClick={handleAddComment} style={{ padding: '6px 14px', fontSize: 12, background: '#3B82F6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Commenter</button></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>)}

      {/* Limit access confirmation modal */}
      {showLimitModal && (
        <>
          <div onClick={() => !revoking && setShowLimitModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, background: '#fff', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.15)', zIndex: 10000, padding: '28px 28px 24px' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>🚫</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center' }}>Limiter l'accès</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 1.6 }}>
              Voulez-vous limiter l'accès de <strong style={{ color: '#111827' }}>{displayName}</strong> ?<br />
              <span style={{ fontSize: 13 }}>Le client pourra consulter ses documents mais ne pourra plus en envoyer.</span>
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowLimitModal(false)} disabled={revoking} style={{ flex: 1, height: 42, background: '#fff', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Annuler</button>
              <button onClick={async () => { await handleRevoke(); setShowLimitModal(false); }} disabled={revoking} style={{ flex: 1, height: 42, background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: revoking ? 0.6 : 1 }}>{revoking ? 'En cours…' : 'Confirmer'}</button>
            </div>
          </div>
        </>
      )}

      {/* Reactivate confirmation modal */}
      {showReactivateModal && (
        <>
          <div onClick={() => !revoking && setShowReactivateModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, background: '#fff', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.15)', zIndex: 10000, padding: '28px 28px 24px' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>↺</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center' }}>Réactiver l'accès</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 1.6 }}>
              Voulez-vous restaurer l'accès de <strong style={{ color: '#111827' }}>{displayName}</strong> ?<br />
              <span style={{ fontSize: 13 }}>Le client pourra à nouveau envoyer des documents.</span>
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReactivateModal(false)} disabled={revoking} style={{ flex: 1, height: 42, background: '#fff', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>Annuler</button>
              <button onClick={async () => { await handleReactivate(); setShowReactivateModal(false); }} disabled={revoking} style={{ flex: 1, height: 42, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: revoking ? 0.6 : 1 }}>{revoking ? 'En cours…' : 'Confirmer'}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─── Small components ────────────────────────────────────────────────────────

function GridCell({ icon, iconBg, iconColor, label, children }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <div style={{ height: 28, width: 28, borderRadius: 6, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>{icon}</div>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8 }}>
      <div style={{ height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</p>
        {children}
      </div>
    </div>
  );
}

function IconBtn({ onClick, title, disabled, active, color, bgHover, children }: {
  onClick: () => void; title: string; disabled?: boolean; active?: boolean; color?: string; bgHover?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ height: 32, width: 32, borderRadius: 8, border: '1px solid #E5E7EB', background: active ? (bgHover || '#F3F4F6') : '#fff', cursor: disabled ? 'default' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color || '#9CA3AF', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = bgHover || '#EFF6FF'; (e.currentTarget as HTMLButtonElement).style.color = color || '#3B82F6'; } }}
      onMouseLeave={e => { if (!disabled && !active) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = color || '#9CA3AF'; } }}>
      {children}
    </button>
  );
}

// ─── Kanban card ────────────────────────────────────────────────────────────

function KanbanCard({ task, onOpenDetail }: { task: Record<string, unknown>; onOpenDetail: (t: Record<string, unknown>) => void }) {
  const typeInfo = getTaskType(task.task_type as string);
  const pc: Record<string, string> = { low: '#3B82F6', normal: '#F59E0B', high: '#F97316', urgent: '#EF4444' };
  const assignee = task.assignee as { id: string; name: string; initials: string } | null;
  return (
    <div onClick={() => onOpenDetail(task)} style={{ background: 'white', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s', borderLeft: `3px solid ${pc[task.priority as string] || '#F59E0B'}` }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F3F4F6', borderRadius: 6, padding: '2px 8px', fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}><span>{typeInfo.icon}</span> {typeInfo.label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8, lineHeight: 1.4 }}>{task.title as string}</div>
      {task.description && <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.description as string}</div>}
      <div style={{ background: '#F3F4F6', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 10 }}><div style={{ width: `${task.progress}%`, background: task.status === 'done' ? '#22C55E' : '#3B82F6', height: '100%', borderRadius: 4 }} /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {task.due_date ? <span style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10} />{new Date((task.due_date as string) + ((task.due_date as string).endsWith('Z') ? '' : 'Z')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span> : <span />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(task.comments_count as number) > 0 && <span style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 2 }}><MessageSquare size={10} /> {task.comments_count as number}</span>}
          {assignee ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={assignee.name}>{assignee.initials}</div> : <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px dashed #D1D5DB' }} />}
        </div>
      </div>
    </div>
  );
}

// ─── Note helpers ───────────────────────────────────────────────────────────

function getNoteColor(color: string) {
  const colors: Record<string, { bg: string; border: string; accent: string }> = {
    yellow: { bg: '#FFFBEB', border: '#FDE68A', accent: '#F59E0B' },
    blue: { bg: '#EFF6FF', border: '#BFDBFE', accent: '#3B82F6' },
    green: { bg: '#F0FDF4', border: '#BBF7D0', accent: '#16A34A' },
    pink: { bg: '#FDF2F8', border: '#F9A8D4', accent: '#EC4899' },
    gray: { bg: '#F9FAFB', border: '#E5E7EB', accent: '#6B7280' },
  };
  return colors[color] || colors.yellow;
}

function formatNoteTime(iso: string) {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function NoteCard({ note, onUpdate, onDelete, onPin }: {
  note: { id: string; title: string | null; content: string; color: string; is_pinned: boolean; updated_at: string; author: { id: string | null; name: string; initials: string } };
  onUpdate: (id: string, data: { title?: string; content?: string; color?: string }) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title ?? '');
  const [editContent, setEditContent] = useState(note.content);
  const [showActions, setShowActions] = useState(false);
  const colors = getNoteColor(note.color);
  return (
    <div onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '16px 18px', borderLeft: `4px solid ${colors.accent}`, position: 'relative', transition: 'box-shadow 0.2s', boxShadow: showActions ? '0 4px 16px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)', minHeight: 120 }}>
      {note.is_pinned && !showActions && <div style={{ position: 'absolute', top: 10, right: 10, color: '#F59E0B' }}><Pin size={14} fill="#F59E0B" /></div>}
      {showActions && !isEditing && (
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          <button onClick={() => onPin(note.id)} title={note.is_pinned ? 'Désépingler' : 'Épingler'} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: note.is_pinned ? '#F59E0B' : '#9CA3AF', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><Pin size={13} /></button>
          <button onClick={() => { setEditTitle(note.title ?? ''); setEditContent(note.content); setIsEditing(true); }} title="Modifier" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><Pencil size={13} /></button>
          <button onClick={() => onDelete(note.id)} title="Supprimer" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}><Trash2 size={13} /></button>
        </div>
      )}
      {isEditing ? (<>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>{(['yellow', 'blue', 'green', 'pink', 'gray'] as const).map(c => (<button key={c} onClick={() => onUpdate(note.id, { color: c })} style={{ width: 16, height: 16, borderRadius: '50%', background: getNoteColor(c).accent, border: note.color === c ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />))}</div>
        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Titre" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, outline: 'none', marginBottom: 6, boxSizing: 'border-box', fontFamily: 'inherit' }} />
        <textarea value={editContent} onChange={e => setEditContent(e.target.value)} autoFocus style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.6, minHeight: 80, boxSizing: 'border-box', fontFamily: 'inherit', color: '#374151' }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setIsEditing(false)} style={{ padding: '4px 10px', fontSize: 12, background: 'white', border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { onUpdate(note.id, { title: editTitle, content: editContent }); setIsEditing(false); }} style={{ padding: '4px 10px', fontSize: 12, background: colors.accent, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Sauvegarder</button>
        </div>
      </>) : (<>
        {note.title && <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 6, paddingRight: note.is_pinned ? 20 : 0 }}>{note.title}</div>}
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.content}</div>
      </>)}
      <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#9CA3AF' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{note.author?.initials && <span style={{ background: colors.accent, color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{note.author.initials}</span>}{note.author?.name}</span>
        <span>{formatNoteTime(note.updated_at)}</span>
      </div>
    </div>
  );
}

// ─── Task types config ──────────────────────────────────────────────────────

const TASK_TYPES = [
  { key: 'envoyer_document', label: 'Envoyer document', icon: '📤' },
  { key: 'appeler_client', label: 'Appeler le client', icon: '📞' },
  { key: 'relance_paiement', label: 'Relance paiement', icon: '💰' },
  { key: 'reunion', label: 'Réunion', icon: '🤝' },
  { key: 'validation_facture', label: 'Validation facture', icon: '✅' },
  { key: 'declaration_fiscale', label: 'Déclaration fiscale', icon: '📋' },
  { key: 'bilan_annuel', label: 'Bilan annuel', icon: '📊' },
  { key: 'autre', label: 'Autre', icon: '📌' },
];

function getTaskType(key: string) {
  return TASK_TYPES.find(t => t.key === key) || { key: 'autre', label: key, icon: '📌' };
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  todo:        { bg: '#F3F4F6', color: '#6B7280', label: 'À faire', icon: '○' },
  in_progress: { bg: '#EFF6FF', color: '#3B82F6', label: 'En cours', icon: '◑' },
  done:        { bg: '#F0FDF4', color: '#16A34A', label: 'Terminé', icon: '✓' },
  cancelled:   { bg: '#FEF2F2', color: '#EF4444', label: 'Annulé', icon: '✕' },
};

const PRIORITY_CFG: Record<string, { color: string; label: string }> = {
  low: { color: '#3B82F6', label: 'Basse' },
  normal: { color: '#F59E0B', label: 'Normale' },
  high: { color: '#F97316', label: 'Haute' },
  urgent: { color: '#EF4444', label: 'Urgente' },
};

// ─── Task tree components ───────────────────────────────────────────────────

interface TaskRowProps {
  task: { id: string; title: string; description: string | null; task_type: string; due_date: string | null; status: string; progress: number; priority: string; assignee: { id: string; name: string; initials: string } | null };
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  accountants: { id: string; name: string }[];
}

function TaskRow({ task, onUpdate, onDelete, accountants }: TaskRowProps) {
  const [showActions, setShowActions] = useState(false);
  const sc = STATUS_CFG[task.status] || STATUS_CFG.todo;
  const pc = PRIORITY_CFG[task.priority] || PRIORITY_CFG.normal;

  return (
    <div onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px 10px 40px', borderBottom: '1px solid #F9FAFB', background: showActions ? '#FAFAFA' : 'white', transition: 'background 0.1s', opacity: task.status === 'cancelled' ? 0.6 : 1 }}>
      {/* Status toggle */}
      <button onClick={() => {
        const next: Record<string, string> = { todo: 'in_progress', in_progress: 'done', done: 'todo', cancelled: 'todo' };
        onUpdate(task.id, { status: next[task.status] || 'todo' });
      }} style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sc.color}`, background: task.status === 'done' ? sc.color : 'white', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: task.status === 'done' ? 'white' : sc.color, fontWeight: 700 }}
        title={`Cliquer: ${task.status === 'done' ? 'À faire' : task.status === 'todo' ? 'En cours' : 'Terminé'}`}>
        {task.status === 'done' ? '✓' : ''}
      </button>

      {/* Title + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: task.status === 'done' ? '#9CA3AF' : '#111827', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</div>
        {task.description && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>}
      </div>

      {/* Priority dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: pc.color, flexShrink: 0 }} title={`Priorité: ${pc.label}`} />

      {/* Progress bar */}
      <div style={{ width: 80, flexShrink: 0 }}>
        <div style={{ background: '#F3F4F6', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 2 }}>
          <div style={{ width: `${task.progress}%`, background: task.status === 'done' ? '#22C55E' : '#3B82F6', height: '100%', borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center' }}>{task.progress}%</div>
      </div>

      {/* Progress slider on hover */}
      {showActions && task.status !== 'done' && (
        <input type="range" min="0" max="100" value={task.progress} onChange={e => onUpdate(task.id, { progress: parseInt(e.target.value) })} onClick={e => e.stopPropagation()} style={{ width: 60, cursor: 'pointer', accentColor: '#3B82F6' }} />
      )}

      {/* Status badge */}
      <span style={{ background: sc.bg, color: sc.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>{sc.icon} {sc.label}</span>

      {/* Due date */}
      {task.due_date && (
        <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Calendar size={11} />
          {new Date(task.due_date + (task.due_date.endsWith('Z') ? '' : 'Z')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      )}

      {/* Assignee avatar */}
      {task.assignee ? (
        <div title={task.assignee.name} style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #047857)', color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{task.assignee.initials}</div>
      ) : (
        <div title="Non assigné" style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px dashed #D1D5DB', flexShrink: 0 }} />
      )}

      {/* Hover actions */}
      {showActions && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <select value={task.assignee?.id || ''} onChange={e => onUpdate(task.id, { assigned_to_id: e.target.value || null })} onClick={e => e.stopPropagation()} style={{ height: 26, border: '1px solid #E5E7EB', borderRadius: 6, padding: '0 6px', fontSize: 11, cursor: 'pointer', background: 'white' }}>
            <option value="">Assigner...</option>
            {accountants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={() => onDelete(task.id)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}><Trash2 size={12} /></button>
        </div>
      )}
    </div>
  );
}

function TaskTypeSection({ type, tasks, onUpdateTask, onDeleteTask, accountants }: {
  type: string; tasks: TaskRowProps['task'][]; onUpdateTask: TaskRowProps['onUpdate']; onDeleteTask: TaskRowProps['onDelete']; accountants: TaskRowProps['accountants'];
}) {
  const typeInfo = getTaskType(type);
  const done = tasks.filter(t => t.status === 'done').length;
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 24px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
        <span>{typeInfo.icon}</span>
        <span>{typeInfo.label}</span>
        <span style={{ background: '#F3F4F6', borderRadius: 10, padding: '0 6px' }}>{done}/{tasks.length}</span>
      </div>
      {tasks.map(task => <TaskRow key={task.id} task={task} onUpdate={onUpdateTask} onDelete={onDeleteTask} accountants={accountants} />)}
    </div>
  );
}

function MonthSection({ monthGroup, isLast, onUpdateTask, onDeleteTask, accountants }: {
  monthGroup: { month: number; month_name: string; tasks: TaskRowProps['task'][]; total: number; done: number; progress: number };
  isLast: boolean; onUpdateTask: TaskRowProps['onUpdate']; onDeleteTask: TaskRowProps['onDelete']; accountants: TaskRowProps['accountants'];
}) {
  const [isOpen, setIsOpen] = useState(true);
  // Group tasks by type within this month
  const byType: Record<string, TaskRowProps['task'][]> = {};
  monthGroup.tasks.forEach(t => { (byType[t.task_type] ??= []).push(t); });

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid #F3F4F6' }}>
      <div onClick={() => setIsOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', background: '#F8FAFC', cursor: 'pointer', borderBottom: isOpen ? '1px solid #F3F4F6' : 'none' }}>
        <span style={{ color: '#9CA3AF', fontSize: 12 }}>{isOpen ? '▼' : '▶'}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>{monthGroup.month_name}</span>
        <span style={{ background: '#E5E7EB', color: '#6B7280', borderRadius: 20, padding: '1px 8px', fontSize: 11 }}>{monthGroup.done}/{monthGroup.total}</span>
        <div style={{ flex: 1 }}>
          <div style={{ background: '#E5E7EB', borderRadius: 4, height: 5, overflow: 'hidden' }}>
            <div style={{ width: `${monthGroup.progress}%`, background: monthGroup.progress === 100 ? '#22C55E' : monthGroup.progress > 50 ? '#3B82F6' : '#F59E0B', height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: monthGroup.progress === 100 ? '#16A34A' : '#6B7280' }}>{monthGroup.progress}%</span>
      </div>
      {isOpen && Object.entries(byType).map(([type, tasks]) => (
        <TaskTypeSection key={type} type={type} tasks={tasks} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} accountants={accountants} />
      ))}
    </div>
  );
}

function YearGroup({ yearGroup, onUpdateTask, onDeleteTask, accountants }: {
  yearGroup: { year: number; months: { month: number; month_name: string; tasks: TaskRowProps['task'][]; total: number; done: number; progress: number }[]; total: number; done: number; progress: number };
  onUpdateTask: TaskRowProps['onUpdate']; onDeleteTask: TaskRowProps['onDelete']; accountants: TaskRowProps['accountants'];
}) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div style={{ marginBottom: 16 }}>
      <div onClick={() => setIsOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1E2A4A', borderRadius: isOpen ? '12px 12px 0 0' : 12, cursor: 'pointer', color: 'white' }}>
        <span style={{ fontSize: 14 }}>{isOpen ? '▼' : '▶'}</span>
        <Calendar size={16} />
        <span style={{ fontWeight: 700, fontSize: 16 }}>{yearGroup.year}</span>
        <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{yearGroup.done}/{yearGroup.total} tâches</span>
        <div style={{ flex: 1, marginLeft: 8 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${yearGroup.progress}%`, background: yearGroup.progress === 100 ? '#22C55E' : '#60A5FA', height: '100%', transition: 'width 0.5s ease', borderRadius: 4 }} />
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: yearGroup.progress === 100 ? '#22C55E' : 'white' }}>{yearGroup.progress}%</span>
      </div>
      {isOpen && (
        <div style={{ border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          {yearGroup.months.map((mg, i) => (
            <MonthSection key={mg.month} monthGroup={mg} isLast={i === yearGroup.months.length - 1} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} accountants={accountants} />
          ))}
        </div>
      )}
    </div>
  );
}
