import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, ChevronDown, ChevronUp, Calendar,
  User, Mail, Phone, Building2, Briefcase, FileText, ImageIcon,
  FileSpreadsheet, File as FileIcon, FolderOpen, Download,
  Pencil, ClipboardList, Loader2, Eye, Ban, RefreshCw, Mic,
} from 'lucide-react';
import { getClient, getClientUsers, updateClientUser, revokeClientAccess } from '../api/clients';
import { getClientDocuments, getPresignedDownloadUrl, createInvoiceFromDocument } from '../api/documents';
import type { AdminClientDoc } from '../api/documents';
import { SECTEURS_ACTIVITE, REGIMES_FISCAUX, FORMES_JURIDIQUES } from '../types';
import type { Client, ClientUser } from '../types';

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

const INVOICE_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  to_review: { bg: '#FEF3C7', color: '#92400E', label: 'À traiter' },
  validated: { bg: '#DCFCE7', color: '#16A34A', label: 'Validée' },
  rejected:  { bg: '#FEE2E2', color: '#DC2626', label: 'Rejetée' },
};

// ─── Page ────────────────────────────��───────────────────────────────────────

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const [client,      setClient]      = useState<Client | null>(null);
  const [clientUser,  setClientUser]  = useState<ClientUser | null>(null);
  const [docs,        setDocs]        = useState<AdminClientDoc[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Edit state
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

  // Revoke
  const [revoking,    setRevoking]    = useState(false);

  const fetchData = useCallback(async () => {
    if (!clientId) { setError('ID manquant.'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [c, docsList, users] = await Promise.all([
        getClient(clientId),
        getClientDocuments(clientId),
        getClientUsers(),
      ]);
      setClient(c);
      setDocs(docsList);
      const groups = groupByMonth(docsList);
      if (groups.length > 0) setExpanded(new Set([groups[0].key]));

      const user = users.find(u => u.client_id === clientId);
      setClientUser(user ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function enterEdit() {
    if (!clientUser) return;
    setEditFirst(clientUser.first_name);
    setEditLast(clientUser.last_name);
    setEditPhone(clientUser.phone_number ?? '');
    setEditCompany(clientUser.client_company_name ?? '');
    setEditSecteur(client?.secteur_activite ?? '');
    setEditRegime(client?.regime_fiscal ?? '');
    setEditForme(client?.forme_juridique ?? '');
    setSaveMsg(null);
    setEditMode(true);
  }

  async function handleSave() {
    if (!clientUser) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await updateClientUser(clientUser.id, {
        first_name: editFirst.trim(),
        last_name: editLast.trim(),
        phone_number: editPhone.trim() || undefined,
        company_name: editCompany.trim() || undefined,
        secteur_activite: editSecteur || undefined,
        regime_fiscal: editRegime || undefined,
        forme_juridique: editForme || undefined,
      });
      setClientUser(updated);
      if (client) {
        setClient({
          ...client,
          name: editCompany.trim() || client.name,
          secteur_activite: editSecteur || client.secteur_activite,
          regime_fiscal: editRegime || client.regime_fiscal,
          forme_juridique: editForme || client.forme_juridique,
        });
      }
      setEditMode(false);
      setSaveMsg('Informations mises à jour');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    if (!clientUser) return;
    setRevoking(true);
    try {
      await revokeClientAccess(clientUser.id);
      setClientUser({ ...clientUser, is_active: false });
    } catch { /* ignore */ }
    finally { setRevoking(false); }
  }

  async function handleReactivate() {
    if (!clientUser) return;
    setRevoking(true);
    try {
      await updateClientUser(clientUser.id, { } as any);
      // Reactivation handled via invitation flow — refetch
      await fetchData();
    } catch { /* ignore */ }
    finally { setRevoking(false); }
  }

  async function handleDownload(docId: string) {
    try {
      const url = await getPresignedDownloadUrl(docId);
      window.open(url, '_blank');
    } catch { /* ignore */ }
  }

  async function handleCreateInvoice(docId: string) {
    if (!clientId) return;
    setCreatingInv(docId);
    try {
      const invoice = await createInvoiceFromDocument(docId);
      navigate(`/clients/${clientId}/invoices/${invoice.id}`);
    } catch { setError('Impossible de créer la facture.'); }
    finally { setCreatingInv(null); }
  }

  function handleViewInvoice(invoiceId: string) {
    if (!clientId) return;
    navigate(`/clients/${clientId}/invoices/${invoiceId}`);
  }

  // ─── Loading / Error states ────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={24} className="text-blue-500 animate-spin" />
    </div>
  );

  if (error && !client) return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-[13px] text-red-700">{error}</div>
      <div className="text-center py-8">
        <Link to="/clients" className="text-[13px] text-blue-600 hover:underline">← Retour aux clients</Link>
      </div>
    </div>
  );

  if (!client) return (
    <div className="text-center py-24">
      <p className="text-[14px] font-semibold text-gray-600">Client introuvable.</p>
      <Link to="/clients" className="text-[13px] text-blue-600 hover:underline mt-2 inline-block">← Retour aux clients</Link>
    </div>
  );

  const initials = clientUser
    ? `${clientUser.first_name.charAt(0)}${clientUser.last_name.charAt(0)}`.toUpperCase()
    : client.name.charAt(0).toUpperCase();
  const displayName = clientUser ? `${clientUser.first_name} ${clientUser.last_name}` : client.name;
  const isActive = clientUser?.is_active ?? true;
  const groups = groupByMonth(docs);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-gray-400 mb-5">
        <button onClick={() => navigate('/clients')} className="hover:text-gray-600 transition-colors">Clients</button>
        <ChevronRight size={12} />
        <span className="text-gray-700 font-medium">{displayName}</span>
      </nav>

      <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 140px)' }}>

        {/* ═══ LEFT COLUMN — Client Info ═══ */}
        <div style={{
          width: 380, flexShrink: 0, background: '#fff',
          borderRight: '1px solid #E5E7EB',
          boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
          position: 'sticky', top: 0, height: 'fit-content',
          maxHeight: 'calc(100vh - 140px)', overflowY: 'auto',
        }}>
          <div style={{ padding: '24px 24px 20px' }}>
            {/* Back + Avatar + Name */}
            <button
              onClick={() => navigate('/clients')}
              className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-700 transition-colors mb-5"
            >
              <ArrowLeft size={14} /> Clients
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                height: 52, width: 52, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 18, fontWeight: 700,
              }}>
                {initials}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{displayName}</p>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                    background: isActive ? '#DCFCE7' : '#F3F4F6',
                    color: isActive ? '#16A34A' : '#6B7280',
                  }}>
                    {isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Détails du client</p>
              </div>
            </div>

            {/* Success message */}
            {saveMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 500,
                background: saveMsg.includes('Erreur') ? '#FEF2F2' : '#F0FDF4',
                color: saveMsg.includes('Erreur') ? '#DC2626' : '#16A34A',
                border: `1px solid ${saveMsg.includes('Erreur') ? '#FECACA' : '#BBF7D0'}`,
              }}>
                {saveMsg}
              </div>
            )}

            {/* Info fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Name */}
              {clientUser && (
                <InfoRow icon={<User size={15} color="#3B82F6" />} label="Nom complet">
                  {editMode ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={editFirst} onChange={e => setEditFirst(e.target.value)} placeholder="Prénom" style={INPUT_STYLE} />
                      <input value={editLast} onChange={e => setEditLast(e.target.value)} placeholder="Nom" style={INPUT_STYLE} />
                    </div>
                  ) : (
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{displayName}</p>
                  )}
                </InfoRow>
              )}

              {/* Email */}
              {clientUser && (
                <InfoRow icon={<Mail size={15} color="#3B82F6" />} label="Email">
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{clientUser.email}</p>
                </InfoRow>
              )}

              {/* Phone */}
              {clientUser && (
                <InfoRow icon={<Phone size={15} color="#3B82F6" />} label="Téléphone">
                  {editMode ? (
                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+212 6 00 00 00 00" style={INPUT_STYLE} />
                  ) : (
                    <p style={{ fontSize: 14, fontWeight: 500, color: clientUser.phone_number ? '#111827' : '#9CA3AF' }}>
                      {clientUser.phone_number ?? '—'}
                    </p>
                  )}
                </InfoRow>
              )}

              {/* Company */}
              <InfoRow icon={<Building2 size={15} color="#3B82F6" />} label="Entreprise">
                {editMode ? (
                  <input value={editCompany} onChange={e => setEditCompany(e.target.value)} placeholder="Nom entreprise" style={INPUT_STYLE} />
                ) : (
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{client.name}</p>
                )}
              </InfoRow>

              {/* Secteur */}
              <InfoRow icon={<Briefcase size={15} color="#3B82F6" />} label="Secteur d'activité">
                {editMode ? (
                  <select value={editSecteur} onChange={e => setEditSecteur(e.target.value)} style={{ ...INPUT_STYLE, color: editSecteur ? '#111827' : '#9CA3AF' }}>
                    <option value="">— Non renseigné —</option>
                    {SECTEURS_ACTIVITE.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <p style={{ fontSize: 14, fontWeight: 500, color: client.secteur_activite ? '#111827' : '#9CA3AF' }}>
                    {client.secteur_activite ?? '—'}
                  </p>
                )}
              </InfoRow>

              {/* Regime */}
              <InfoRow icon={<FileText size={15} color="#3B82F6" />} label="Régime fiscal">
                {editMode ? (
                  <select value={editRegime} onChange={e => setEditRegime(e.target.value)} style={{ ...INPUT_STYLE, color: editRegime ? '#111827' : '#9CA3AF' }}>
                    <option value="">— Non renseigné —</option>
                    {REGIMES_FISCAUX.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <p style={{ fontSize: 14, fontWeight: 500, color: client.regime_fiscal ? '#111827' : '#9CA3AF' }}>
                    {client.regime_fiscal ?? '—'}
                  </p>
                )}
              </InfoRow>

              {/* Forme juridique */}
              <InfoRow icon={<Building2 size={15} color="#3B82F6" />} label="Forme juridique">
                {editMode ? (
                  <select value={editForme} onChange={e => setEditForme(e.target.value)} style={{ ...INPUT_STYLE, color: editForme ? '#111827' : '#9CA3AF' }}>
                    <option value="">— Non renseigné —</option>
                    {FORMES_JURIDIQUES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : (
                  <p style={{ fontSize: 14, fontWeight: 500, color: client.forme_juridique ? '#111827' : '#9CA3AF' }}>
                    {client.forme_juridique ?? '—'}
                  </p>
                )}
              </InfoRow>

              {/* Inscription */}
              <InfoRow icon={<Calendar size={15} color="#6B7280" />} label="Inscription">
                <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                  {new Date(client.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </InfoRow>
            </div>

            {/* Fiscal IDs section */}
            {(client.ice || client.if_number || client.rc || client.tp || client.cnss || editMode) && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, paddingLeft: 4 }}>
                  Identifiants fiscaux
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(['ice', 'if_number', 'rc', 'tp', 'cnss'] as const).map(field => {
                    const labels: Record<string, string> = { ice: 'ICE', if_number: 'IF', rc: 'RC', tp: 'TP', cnss: 'CNSS' };
                    const val = (client as Record<string, unknown>)[field] as string | null | undefined;
                    if (!editMode && !val) return null;
                    return (
                      <div key={field} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', minWidth: 36 }}>{labels[field]}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: val ? '#111827' : '#9CA3AF', fontFamily: 'monospace' }}>
                          {val ?? 'Non renseigné'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Edit/Save buttons */}
            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              {editMode ? (
                <>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                    Annuler
                  </button>
                </>
              ) : clientUser && (
                <button onClick={enterEdit}
                  style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #3B82F6', background: '#fff', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pencil size={13} /> Modifier
                </button>
              )}
            </div>

            {/* Danger zone */}
            {clientUser && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #E5E7EB' }}>
                {isActive ? (
                  <button onClick={handleRevoke} disabled={revoking}
                    style={{ width: '100%', padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #FECACA', background: '#fff', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: revoking ? 0.6 : 1 }}>
                    <Ban size={14} /> {revoking ? 'Révocation…' : "Révoquer l'accès"}
                  </button>
                ) : (
                  <button onClick={handleReactivate} disabled={revoking}
                    style={{ width: '100%', padding: '10px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #BBF7D0', background: '#fff', color: '#16A34A', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: revoking ? 0.6 : 1 }}>
                    <RefreshCw size={14} /> {revoking ? 'Réactivation…' : "Réactiver l'accès"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT COLUMN — Documents ═══ */}
        <div style={{ flex: 1, background: '#F8FAFC', padding: 24, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Documents de {client.name}</h2>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#EFF6FF', color: '#3B82F6' }}>
              {docs.length} document{docs.length !== 1 ? 's' : ''} au total
            </span>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Documents by month */}
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
                  {/* Month header */}
                  <button
                    onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 20px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <Calendar size={15} color="#6B7280" />
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1F2937' }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 12, background: '#F3F4F6', color: '#6B7280' }}>
                      {groupDocs.length} doc{groupDocs.length !== 1 ? 's' : ''}
                    </span>
                    {expanded.has(key) ? <ChevronUp size={15} color="#6B7280" /> : <ChevronDown size={15} color="#6B7280" />}
                  </button>

                  {/* Document rows */}
                  {expanded.has(key) && groupDocs.map((doc) => (
                    <div key={doc.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 12px 40px',
                      borderTop: '1px solid #F3F4F6', background: '#fff', transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                    >
                      <div style={{ height: 36, width: 36, borderRadius: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {fileIcon(doc.file_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</p>
                        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                          {doc.doc_type === 'audio' && doc.description
                            ? doc.description
                            : doc.doc_type === 'audio'
                            ? 'Note vocale'
                            : formatBytes(doc.file_size)}
                        </p>
                      </div>

                      {/* Audio badge OR Invoice status badge */}
                      {doc.doc_type === 'audio' ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                          Audio
                        </span>
                      ) : doc.invoice_id && doc.invoice_status ? (
                        <button
                          onClick={() => handleViewInvoice(doc.invoice_id!)}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: INVOICE_STATUS_STYLES[doc.invoice_status]?.bg ?? '#F3F4F6',
                            color: INVOICE_STATUS_STYLES[doc.invoice_status]?.color ?? '#6B7280',
                          }}
                        >
                          {INVOICE_STATUS_STYLES[doc.invoice_status]?.label ?? doc.invoice_status}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#D1D5DB', padding: '3px 10px' }}>Aucune facture</span>
                      )}

                      {/* Date */}
                      <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>

                      {/* Create invoice — hidden for audio */}
                      {!doc.invoice_id && doc.doc_type !== 'audio' && (
                        <button onClick={() => handleCreateInvoice(doc.id)} disabled={creatingInv === doc.id}
                          title="Créer une facture" style={{
                            height: 32, width: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { const b = e.currentTarget; b.style.background = '#EFF6FF'; b.style.color = '#3B82F6'; }}
                          onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'transparent'; b.style.color = '#9CA3AF'; }}
                        >
                          {creatingInv === doc.id ? <Loader2 size={15} className="animate-spin" /> : <ClipboardList size={15} />}
                        </button>
                      )}

                      {/* Download */}
                      <button onClick={() => handleDownload(doc.id)} title="Télécharger" style={{
                        height: 32, width: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => { const b = e.currentTarget; b.style.background = '#EFF6FF'; b.style.color = '#3B82F6'; }}
                        onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'transparent'; b.style.color = '#9CA3AF'; }}
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Small helper component ──────────────────────────────────────────────────

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px',
      background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
    }}>
      <div style={{ height: 32, width: 32, minWidth: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</p>
        {children}
      </div>
    </div>
  );
}
