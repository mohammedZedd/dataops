import { useEffect, useState, useMemo, useRef, type KeyboardEvent } from 'react';
import { Mail, Users, UserPlus, Filter, CheckCircle } from 'lucide-react';
import { getInvitations, resendInvitation } from '../api/invitations';
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
      <span className="text-sm font-medium text-gray-800">Invitation renvoyée</span>
    </div>

    <div className="space-y-6">

      {/* Header */}
      <div className="pb-5 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Invitations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Invitez des comptables ou des clients à rejoindre votre espace.
        </p>
      </div>


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
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

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
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">

              {/* Header labels row */}
              <tr>
                <th className={thClass('email', !!filters.email)} onClick={() => openCol('email')}>
                  <span className="flex items-center gap-1.5">
                    Email
                    <Filter size={11} className={filters.email ? 'text-blue-500' : 'text-gray-300'} />
                  </span>
                </th>
                <th className={thClass('name', !!filters.name)} onClick={() => openCol('name')}>
                  <span className="flex items-center gap-1.5">
                    Nom
                    <Filter size={11} className={filters.name ? 'text-blue-500' : 'text-gray-300'} />
                  </span>
                </th>
                <th className={thClass('role', !!filters.role)} onClick={() => openCol('role')}>
                  <span className="flex items-center gap-1.5">
                    Rôle
                    <Filter size={11} className={filters.role ? 'text-blue-500' : 'text-gray-300'} />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Client lié
                </th>
                <th className={thClass('status', !!filters.status)} onClick={() => openCol('status')}>
                  <span className="flex items-center gap-1.5">
                    Statut
                    <Filter size={11} className={filters.status ? 'text-blue-500' : 'text-gray-300'} />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Expiration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Actions
                </th>
              </tr>

              {/* Inline filter row — only rendered when a col is active */}
              {activeCol && (
                <tr className="border-t border-blue-100 bg-blue-50/40">
                  {/* email */}
                  <td className="px-2 py-1.5">
                    {activeCol === 'email' ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputDraft}
                        onChange={(e) => setInputDraft(e.target.value)}
                        onKeyDown={(e) => handleTextKeyDown(e, 'email')}
                        onBlur={() => commitText('email')}
                        placeholder="Filtrer… (Entrée)"
                        className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    ) : null}
                  </td>
                  {/* name */}
                  <td className="px-2 py-1.5">
                    {activeCol === 'name' ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputDraft}
                        onChange={(e) => setInputDraft(e.target.value)}
                        onKeyDown={(e) => handleTextKeyDown(e, 'name')}
                        onBlur={() => commitText('name')}
                        placeholder="Filtrer… (Entrée)"
                        className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none"
                      />
                    ) : null}
                  </td>
                  {/* role */}
                  <td className="px-2 py-1.5">
                    {activeCol === 'role' ? (
                      <select
                        autoFocus
                        value={filters.role}
                        onChange={(e) => handleSelectChange('role', e.target.value)}
                        className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none bg-white"
                      >
                        <option value="">Tous les rôles</option>
                        <option value="accountant">Comptable</option>
                        <option value="client">Client</option>
                      </select>
                    ) : null}
                  </td>
                  {/* client lié — not filterable */}
                  <td />
                  {/* status */}
                  <td className="px-2 py-1.5">
                    {activeCol === 'status' ? (
                      <select
                        autoFocus
                        value={filters.status}
                        onChange={(e) => handleSelectChange('status', e.target.value)}
                        className="w-full border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none bg-white"
                      >
                        <option value="">Tous les statuts</option>
                        <option value="pending">En attente</option>
                        <option value="accepted">Acceptée</option>
                        <option value="expired">Expirée</option>
                      </select>
                    ) : null}
                  </td>
                  <td /><td />
                </tr>
              )}

            </thead>
            <tbody>
              {filtered.map((inv, idx) => {
                const expired   = inv.status === 'expired' || isExpired(inv);
                const canResend = inv.status === 'pending' || expired;
                const loading   = actioningId === inv.id;
                const isLast    = idx === filtered.length - 1;
                return (
                  <tr
                    key={inv.id}
                    className={`hover:bg-gray-50 transition-colors ${isLast ? '' : 'border-b border-gray-100'}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {inv.first_name} {inv.last_name}
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={inv.role} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{inv.client_name ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge inv={inv} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      {canResend && (
                        <button
                          onClick={() => handleResend(inv.id)}
                          disabled={loading}
                          className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200
                            rounded-lg hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50
                            transition-colors disabled:opacity-50"
                        >
                          {loading ? '…' : 'Renvoyer'}
                        </button>
                      )}
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
    </div>
    </>
  );
}
