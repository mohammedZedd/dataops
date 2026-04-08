import { useEffect, useState, useMemo, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Users, UserPlus, Filter, CheckCircle, RefreshCw, Trash2, Pencil, X } from 'lucide-react';
import { getInvitations, resendInvitation, revokeInvitation, updateInvitation, type InvitationUpdatePayload } from '../api/invitations';
import { getClients } from '../api/clients';
import { useAuth } from '../context/AuthContext';
import type { Client, Invitation } from '../types';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import InviteAccountantModal from '../features/invitations/InviteAccountantModal';
import InviteClientModal from '../features/invitations/InviteClientModal';

function isExpired(inv: Invitation): boolean {
  return new Date(inv.expires_at) < new Date();
}

function StatusBadge({ inv }: { inv: Invitation }) {
  if (inv.status === 'accepted') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap
        bg-green-50 text-green-700 border border-green-200">
        Acceptée
      </span>
    );
  }
  if (inv.status === 'cancelled') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap
        bg-gray-100 text-gray-500 border border-gray-200">
        Annulée
      </span>
    );
  }
  if (inv.status === 'expired' || isExpired(inv)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap
        bg-red-50 text-red-700 border border-red-200">
        Expirée
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap
      bg-amber-50 text-amber-700 border border-amber-200">
      En attente
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'accountant') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap
        bg-blue-50 text-blue-700 border border-blue-200">
        Comptable
      </span>
    );
  }
  if (role === 'client') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap
        bg-purple-50 text-purple-700 border border-purple-200">
        Client
      </span>
    );
  }
  return <span className="text-sm text-gray-500">{role}</span>;
}

type FilterCol = 'email' | 'name' | 'role' | 'status' | null;

interface Filters {
  email: string;
  name: string;
  role: string;
  status: string;
}

const EMPTY_FILTERS: Filters = { email: '', name: '', role: '', status: '' };

export default function InvitationsPage() {
  const { user } = useAuth();

  const [invitations,  setInvitations]  = useState<Invitation[]>([]);
  const [clients,      setClients]      = useState<Client[]>([]);
  const [listError,    setListError]    = useState<string | null>(null);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null);
  const [actioningId,  setActioningId]  = useState<string | null>(null);

  const [showAccountantModal, setShowAccountantModal] = useState(false);
  const [showClientModal,     setShowClientModal]     = useState(false);
  const [confirmDeleteId,     setConfirmDeleteId]     = useState<string | null>(null);
  const [editingInvitation,   setEditingInvitation]   = useState<Invitation | null>(null);

  // Inline filters
  const [activeCol,  setActiveCol]  = useState<FilterCol>(null);
  const [filters,    setFilters]    = useState<Filters>(EMPTY_FILTERS);
  const [inputDraft, setInputDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const hasFilter = Object.values(filters).some(Boolean);

  const isAdmin     = user?.role === 'admin';
  const companyName = user?.company_name ?? null;

  useEffect(() => {
    if (!isAdmin) return;
    setListError(null);
    getInvitations()
      .then(setInvitations)
      .catch(() => setListError('Impossible de charger les invitations.'));
    setClientsError(null);
    getClients()
      .then(setClients)
      .catch(() => setClientsError('Impossible de charger les clients.'));
  }, [isAdmin]);

  // Auto-focus text input when column opens
  useEffect(() => {
    if ((activeCol === 'email' || activeCol === 'name') && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeCol]);

  function handleCreated(invitation: Invitation) {
    setInvitations((prev) => [invitation, ...prev]);
  }

  async function handleDelete(id: string) {
    setActioningId(id);
    setConfirmDeleteId(null);
    try {
      await revokeInvitation(id);
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      setSuccessMsg('Invitation supprimée.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setListError('Impossible de supprimer l\'invitation.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleResend(id: string) {
    setActioningId(id);
    try {
      await resendInvitation(id);
      setSuccessMsg('Invitation renvoyée.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setListError('Impossible de renvoyer l\'invitation.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleUpdate(id: string, payload: InvitationUpdatePayload, resend: boolean) {
    setActioningId(id);
    setListError(null);
    try {
      const originalEmail = editingInvitation?.email;
      console.debug('[InvitationsPage] PATCH /invitations/' + id, { payload, resend });
      const updated = await updateInvitation(id, payload, resend);
      setInvitations(prev => prev.map(i => (i.id === id ? updated : i)));
      setEditingInvitation(null);
      const emailChanged = payload.email && payload.email !== originalEmail;
      if (resend || emailChanged) {
        setSuccessMsg(`Invitation modifiée et renvoyée à ${updated.email}`);
      } else {
        setSuccessMsg('Invitation modifiée avec succès');
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      console.error('[InvitationsPage] updateInvitation failed:', err);
      setListError(extractErrorMessage(err));
    } finally {
      setActioningId(null);
    }
  }

  // Extracts a human-readable error from an axios error, handling:
  //   - Network errors (no response)
  //   - 4xx/5xx with `detail: string`
  //   - 422 with `detail: [{ loc, msg, type }, ...]` (FastAPI validation errors)
  function extractErrorMessage(err: unknown): string {
    const e = err as {
      message?: string;
      response?: { status?: number; data?: { detail?: string | Array<{ loc?: unknown[]; msg?: string }> } };
    };
    if (!e.response) {
      return `Erreur réseau: ${e.message ?? 'serveur injoignable'}`;
    }
    const status = e.response.status;
    const detail = e.response.data?.detail;
    if (typeof detail === 'string') return `${status} — ${detail}`;
    if (Array.isArray(detail)) {
      const msgs = detail.map(d => {
        const field = Array.isArray(d.loc) ? d.loc.slice(1).join('.') : '';
        return field ? `${field}: ${d.msg}` : (d.msg ?? '');
      }).filter(Boolean).join(' · ');
      return `${status} — ${msgs || 'Validation échouée'}`;
    }
    return `Erreur ${status} — Impossible de modifier l'invitation.`;
  }

  function openCol(col: FilterCol) {
    if (activeCol === col) {
      // Second click on same col → close
      setActiveCol(null);
      setInputDraft('');
      return;
    }
    setActiveCol(col);
    setInputDraft(col === 'email' ? filters.email : col === 'name' ? filters.name : '');
  }

  function commitText(col: 'email' | 'name') {
    setFilters((f) => ({ ...f, [col]: inputDraft.trim() }));
    setActiveCol(null);
    setInputDraft('');
  }

  function handleTextKeyDown(e: KeyboardEvent<HTMLInputElement>, col: 'email' | 'name') {
    if (e.key === 'Enter') commitText(col);
    if (e.key === 'Escape') { setActiveCol(null); setInputDraft(''); }
  }

  function handleSelectChange(col: 'role' | 'status', value: string) {
    // Toggle: selecting same value resets
    setFilters((f) => ({ ...f, [col]: f[col] === value ? '' : value }));
    setActiveCol(null);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setActiveCol(null);
    setInputDraft('');
  }

  const filtered = useMemo(() => {
    return invitations.filter((inv) => {
      if (filters.email && !inv.email.toLowerCase().includes(filters.email.toLowerCase())) return false;
      if (filters.name) {
        const full = `${inv.first_name} ${inv.last_name}`.toLowerCase();
        if (!full.includes(filters.name.toLowerCase())) return false;
      }
      if (filters.role && inv.role !== filters.role) return false;
      if (filters.status) {
        const expired = inv.status === 'expired' || isExpired(inv);
        const effective = expired ? 'expired' : inv.status;
        if (effective !== filters.status) return false;
      }
      return true;
    });
  }, [invitations, filters]);

  // Helper: th class
  function thClass(col: FilterCol, hasValue: boolean) {
    return [
      'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap',
      'cursor-pointer select-none hover:bg-gray-100 transition-colors',
      hasValue ? 'text-blue-600' : 'text-gray-500',
    ].join(' ');
  }

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm font-semibold text-gray-700">Accès réservé aux administrateurs.</p>
        <p className="text-sm text-gray-500 mt-1">Seuls les admins peuvent inviter des comptables.</p>
      </div>
    );
  }

  return (
    <>
    {/* Toast */}
    <div
      className={`fixed top-16 right-4 z-50 flex items-center gap-2.5 bg-white border border-green-200
        rounded-xl shadow-lg px-4 py-3 transition-all duration-300
        ${successMsg ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}
    >
      <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
      <span className="text-sm font-medium text-gray-800">{successMsg}</span>
    </div>

    <div className="space-y-6">

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4
            hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group"
          onClick={() => setShowAccountantModal(true)}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center
              group-hover:bg-blue-100 transition-colors flex-shrink-0">
              <Mail size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Comptable</p>
              <p className="text-xs text-gray-500">Accès complet au cabinet</p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50
              hover:border-blue-300 transition-colors w-fit"
            onClick={(e) => { e.stopPropagation(); setShowAccountantModal(true); }}
          >
            <UserPlus size={12} />
            Inviter un comptable
          </button>
        </div>

        <div
          className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4
            hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group"
          onClick={() => setShowClientModal(true)}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center
              group-hover:bg-emerald-100 transition-colors flex-shrink-0">
              <Users size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Client</p>
              <p className="text-xs text-gray-500">Accès limité à son espace</p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50
              hover:border-emerald-300 transition-colors w-fit"
            onClick={(e) => { e.stopPropagation(); setShowClientModal(true); }}
          >
            <UserPlus size={12} />
            Inviter un client
          </button>
        </div>
      </div>

      {/* Invitations table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

        {listError && <ErrorBanner message={listError} />}

        {/* Reset bar */}
        {hasFilter && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
            <p className="text-xs text-blue-700">Filtres actifs</p>
            <button
              onClick={resetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
            >
              Tout réinitialiser
            </button>
          </div>
        )}

        {invitations.length === 0 && !listError ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-600">Aucune invitation</p>
            <p className="text-sm text-gray-400 mt-1">Commencez par inviter un comptable ou un client.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-gray-600">Aucune invitation trouvée</p>
            <p className="text-sm text-gray-400 mt-1">Essayez de modifier ou réinitialiser les filtres.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1E2A4A' }}>
                {['EMAIL', 'NOM', 'RÔLE', 'CLIENT LIÉ', 'STATUT', 'EXPIRATION', 'ACTIONS'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', color: '#fff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>

            </thead>
            <tbody>
              {filtered.map((inv) => {
                const expired   = inv.status === 'expired' || isExpired(inv);
                const effective = expired ? 'expired' : inv.status;
                const canResend = inv.status === 'pending' || expired;
                const loading   = actioningId === inv.id;
                const accentColor = effective === 'pending' ? '#F59E0B' : effective === 'accepted' ? '#16A34A' : effective === 'cancelled' ? '#EF4444' : '#9CA3AF';
                const initials = `${inv.first_name.charAt(0)}${inv.last_name.charAt(0)}`.toUpperCase();
                const expSoon = new Date(inv.expires_at).getTime() - Date.now() > 0 && new Date(inv.expires_at).getTime() - Date.now() < 86400000;
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #F3F4F6', boxShadow: `inset 4px 0 0 0 ${accentColor}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#fff'; }}>
                    <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#111827' }} title={inv.email}>{inv.email}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
                        <span style={{ fontSize: 14, color: '#374151' }}>{inv.first_name} {inv.last_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}><RoleBadge role={inv.role} /></td>
                    <td style={{ padding: '14px 16px', fontSize: 14, color: '#374151' }}>
                      {inv.client_name ? <span style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 6, padding: '2px 8px', fontSize: 12, whiteSpace: 'nowrap', display: 'inline-block' }}>{inv.client_name}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}><StatusBadge inv={inv} /></td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: expSoon ? '#EF4444' : '#6B7280', whiteSpace: 'nowrap' }}>
                      {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                      {expSoon && <span style={{ marginLeft: 4, fontSize: 10 }}>Bientôt</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {effective !== 'accepted' && (
                          <button onClick={() => setEditingInvitation(inv)} disabled={loading} title="Modifier"
                            style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', opacity: loading ? 0.5 : 1 }}
                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#EFF6FF'; b.style.borderColor = '#BFDBFE'; }}
                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#fff'; b.style.borderColor = '#E5E7EB'; }}>
                            <Pencil size={14} color="#6B7280" />
                          </button>
                        )}
                        {canResend && (
                          <button onClick={() => handleResend(inv.id)} disabled={loading} title="Renvoyer"
                            style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', opacity: loading ? 0.5 : 1 }}
                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#EFF6FF'; b.style.borderColor = '#BFDBFE'; }}
                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#fff'; b.style.borderColor = '#E5E7EB'; }}>
                            <RefreshCw size={14} color="#3B82F6" />
                          </button>
                        )}
                        {inv.status === 'pending' && (
                          <button onClick={() => setConfirmDeleteId(inv.id)} disabled={loading} title="Supprimer"
                            style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', opacity: loading ? 0.5 : 1 }}
                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#FEF2F2'; b.style.borderColor = '#FECACA'; }}
                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#fff'; b.style.borderColor = '#E5E7EB'; }}>
                            <Trash2 size={14} color="#EF4444" />
                          </button>
                        )}
                        {effective === 'accepted' && <span style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', lineHeight: '32px' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showAccountantModal && (
        <InviteAccountantModal
          companyName={companyName}
          onClose={() => setShowAccountantModal(false)}
          onCreated={handleCreated}
        />
      )}
      {showClientModal && (
        <InviteClientModal
          onClose={() => setShowClientModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit invitation modal */}
      {editingInvitation && createPortal(
        <EditInvitationModal
          invitation={editingInvitation}
          clients={clients}
          saving={actioningId === editingInvitation.id}
          onClose={() => setEditingInvitation(null)}
          onSave={(payload, resend) => handleUpdate(editingInvitation.id, payload, resend)}
        />,
        document.body
      )}

      {/* Confirmation delete modal — rendered via portal to escape stacking contexts */}
      {confirmDeleteId && createPortal(
        <>
          {/* Overlay */}
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
            onClick={() => setConfirmDeleteId(null)}
          />
          {/* Modal card */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 420, background: '#fff', borderRadius: 12,
            padding: '24px 32px 32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            zIndex: 10000,
          }}>
            {/* Warning icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{
                height: 48, width: 48, borderRadius: '50%',
                background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#EF4444', fontWeight: 700, fontSize: 22 }}>!</span>
              </div>
            </div>

            {/* Title & subtitle */}
            <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>
              Supprimer l'invitation
            </h2>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
              Êtes-vous sûr de vouloir supprimer cette invitation ? Cette action est irréversible.
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{
                  flex: 1, height: 42, fontSize: 14, fontWeight: 500,
                  color: '#4B5563', background: '#fff',
                  border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                style={{
                  flex: 1, height: 42, fontSize: 14, fontWeight: 500,
                  color: '#fff', background: '#EF4444',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
    </>
  );
}

// ─── Edit invitation modal ──────────────────────────────────────────────────

interface EditInvitationModalProps {
  invitation: Invitation;
  clients: Client[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: InvitationUpdatePayload, resend: boolean) => void;
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function EditInvitationModal({ invitation, clients, saving, onClose, onSave }: EditInvitationModalProps) {
  const expired = invitation.status === 'expired' || new Date(invitation.expires_at) < new Date();
  const isAccepted = invitation.status === 'accepted';

  const [email, setEmail] = useState(invitation.email);
  const [firstName, setFirstName] = useState(invitation.first_name);
  const [lastName, setLastName] = useState(invitation.last_name);
  const [role, setRole] = useState<'accountant' | 'client'>(invitation.role as 'accountant' | 'client');
  const [clientId, setClientId] = useState<string>(invitation.client_id || '');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [expiresAt, setExpiresAt] = useState(toDateInput(invitation.expires_at));

  // When switching role from client → accountant, clear client linkage
  useEffect(() => {
    if (role === 'accountant') setClientId('');
  }, [role]);

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );
  const selectedClient = clients.find(c => c.id === clientId);

  function buildPayload(): InvitationUpdatePayload {
    // Always send all editable fields (the backend treats absent fields as "no change",
    // but we want the request to actually fire and update the row regardless of stale
    // change-detection). Sending the same value back is a safe no-op.
    const payload: InvitationUpdatePayload = {
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      client_id: role === 'client' ? (clientId || null) : null,
    };

    // Safely compute the new expiry. If parsing fails, omit the field rather than crash.
    if (expiresAt) {
      const parsed = new Date(`${expiresAt}T23:59:59`);
      if (!isNaN(parsed.getTime())) {
        payload.expires_at = parsed.toISOString();
      }
    }
    return payload;
  }

  function handleSave(resend: boolean) {
    try {
      // Basic client-side validation
      if (!email.trim()) { alert("L'email est requis."); return; }
      if (!firstName.trim() || !lastName.trim()) { alert("Le nom et le prénom sont requis."); return; }

      const payload = buildPayload();

      // Confirm if email is changing
      if (payload.email && payload.email !== invitation.email) {
        if (!confirm(`L'invitation sera renvoyée au nouvel email (${payload.email}). Confirmer ?`)) return;
      }

      onSave(payload, resend);
    } catch (err) {
      console.error('[EditInvitationModal] handleSave failed:', err);
      alert("Impossible de préparer la requête. Vérifiez les champs.");
    }
  }

  const statusBadge = (() => {
    if (isAccepted) return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Acceptée' };
    if (expired) return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Expirée' };
    return { bg: '#FFFBEB', color: '#C2410C', border: '#FDE68A', label: 'En attente' };
  })();

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 560, maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 14,
        boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
        zIndex: 10000,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>Modifier l'invitation</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>Mettre à jour les informations de l'invitation</p>
          </div>
          <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Read-only metadata */}
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid #F3F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600 }}>Statut actuel</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                background: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}`,
              }}>
                {statusBadge.label}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280' }}>
              <span>Date d'envoi initiale</span>
              <span style={{ color: '#374151', fontWeight: 500 }}>{new Date(invitation.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={lblStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isAccepted}
              style={{ ...inputStyle, opacity: isAccepted ? 0.6 : 1, cursor: isAccepted ? 'not-allowed' : 'text' }}
            />
            {isAccepted && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>L'email ne peut pas être modifié sur une invitation acceptée.</p>}
          </div>

          {/* Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lblStyle}>Prénom</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={lblStyle}>Nom</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Role */}
          <div style={{ marginBottom: 14 }}>
            <label style={lblStyle}>Rôle</label>
            <select value={role} onChange={e => setRole(e.target.value as 'accountant' | 'client')} style={inputStyle}>
              <option value="accountant">Comptable</option>
              <option value="client">Client</option>
            </select>
          </div>

          {/* Client picker (only if role = client) */}
          {role === 'client' && (
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={lblStyle}>Client lié</label>
              <input
                value={showClientList ? clientSearch : (selectedClient?.name || '')}
                onChange={e => { setClientSearch(e.target.value); setShowClientList(true); }}
                onFocus={() => { setShowClientList(true); setClientSearch(''); }}
                placeholder="Rechercher un client..."
                style={inputStyle}
              />
              {showClientList && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                  <div onClick={() => { setClientId(''); setShowClientList(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#9CA3AF', borderBottom: '1px solid #F3F4F6' }}>— Aucun client</div>
                  {filteredClients.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>Aucun client trouvé</div>
                  ) : filteredClients.map(c => (
                    <div key={c.id} onClick={() => { setClientId(c.id); setShowClientList(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#374151', background: clientId === c.id ? '#EFF6FF' : '#fff' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = clientId === c.id ? '#EFF6FF' : '#fff')}>
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Expiry date */}
          <div style={{ marginBottom: 20 }}>
            <label style={lblStyle}>Date d'expiration</label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={inputStyle} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={onClose} disabled={saving}
              style={{ padding: '9px 18px', background: '#fff', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>
              Annuler
            </button>
            {expired && (
              <button onClick={() => handleSave(true)} disabled={saving}
                style={{ padding: '9px 18px', background: '#fff', border: '1px solid #BFDBFE', color: '#3B82F6', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Enregistrer et renvoyer
              </button>
            )}
            <button onClick={() => handleSave(false)} disabled={saving}
              style={{ padding: '9px 20px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Modal styles ────────────────────────────────────────────────────────────
const lblStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', height: 38, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' };
