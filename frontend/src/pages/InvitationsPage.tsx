import { useEffect, useState, useMemo, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Users, UserPlus, Filter, CheckCircle, RefreshCw, Trash2 } from 'lucide-react';
import { getInvitations, resendInvitation, revokeInvitation } from '../api/invitations';
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
                      {inv.client_name ? <span style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>{inv.client_name}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}><StatusBadge inv={inv} /></td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: expSoon ? '#EF4444' : '#6B7280', whiteSpace: 'nowrap' }}>
                      {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                      {expSoon && <span style={{ marginLeft: 4, fontSize: 10 }}>Bientôt</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
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
