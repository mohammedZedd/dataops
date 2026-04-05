import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, ChevronDown, ChevronUp, Calendar,
  User, Mail, Phone, Building2, Briefcase, FileText, ImageIcon,
  FileSpreadsheet, File as FileIcon, FolderOpen, Download,
  Pencil, ClipboardList, Loader2, Eye, Ban, RefreshCw, Mic, X,
} from 'lucide-react';
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
        {(['details', 'documents'] as const).map((tab, i) => (
          <div key={tab} style={{ display: 'contents' }}>
          {i > 0 && <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 4px', flexShrink: 0 }} />}
          <button onClick={() => switchTab(tab)} style={{
            padding: '14px 20px', fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? '#3B82F6' : '#6B7280',
            borderBottom: activeTab === tab ? '2px solid #3B82F6' : '2px solid transparent',
            marginBottom: -2, background: 'none', border: 'none', borderBottomStyle: 'solid',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s',
          }}>
            {tab === 'details' ? <User size={16} /> : <FileText size={16} />}
            {tab === 'details' ? 'Détails du client' : 'Documents'}
            {tab === 'documents' && (
              <span style={{ fontSize: 12, padding: '1px 8px', borderRadius: 20, background: '#EFF6FF', color: '#3B82F6', fontWeight: 600, marginLeft: 2 }}>
                {docs.length}
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

          {docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ height: 56, width: 56, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <FolderOpen size={26} color="#9CA3AF" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Aucun document</p>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Ce client n'a pas encore envoyé de documents.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groups.map(({ key, label, docs: groupDocs }) => (
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
                    const rowBg = docIsNew ? '#F0F9FF' : '#fff';
                    return (
                    <div key={doc.id} id={`doc-${doc.id}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 12px 40px', borderTop: '1px solid #F3F4F6', background: rowBg, borderLeft: docIsNew ? '3px solid #3B82F6' : '3px solid transparent', transition: 'background 0.1s' }}
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
          )}
        </div>
      )}

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
