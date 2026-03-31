import { useEffect, useState } from 'react';
import { Mail, Users, UserPlus } from 'lucide-react';
import { getInvitations } from '../api/invitations';
import { getClients } from '../api/clients';
import { useAuth } from '../context/AuthContext';
import type { Client, Invitation } from '../types';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import InviteAccountantModal from '../features/invitations/InviteAccountantModal';
import InviteClientModal from '../features/invitations/InviteClientModal';

const STATUS_LABELS: Record<string, string> = {
  pending:   'En attente',
  accepted:  'Acceptée',
  expired:   'Expirée',
  cancelled: 'Annulée',
};

const ROLE_LABELS: Record<string, string> = {
  accountant: 'Comptable',
  client:     'Client',
  admin:      'Admin',
};

export default function InvitationsPage() {
  const { user } = useAuth();

  const [invitations,  setInvitations]  = useState<Invitation[]>([]);
  const [clients,      setClients]      = useState<Client[]>([]);
  const [listError,    setListError]    = useState<string | null>(null);
  const [clientsError, setClientsError] = useState<string | null>(null);

  const [showAccountantModal, setShowAccountantModal] = useState(false);
  const [showClientModal,     setShowClientModal]     = useState(false);

  const isAdmin    = user?.role === 'admin';
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

  function handleCreated(invitation: Invitation) {
    setInvitations((prev) => [invitation, ...prev]);
  }

  if (!isAdmin) {
    return (
      <div
        className="bg-white rounded-xl border border-gray-100 p-6"
        style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
      >
        <p className="text-[14px] font-semibold text-gray-700">Accès réservé aux administrateurs.</p>
        <p className="text-[13px] text-gray-500 mt-1">
          Seuls les admins peuvent inviter des comptables.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
          Équipe
        </p>
        <h1 className="text-[20px] font-bold text-gray-900">Invitations</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Invitez des comptables ou des clients à rejoindre votre espace.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

        {/* Card comptable */}
        <div
          className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4
            hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group"
          style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
          onClick={() => setShowAccountantModal(true)}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center
              group-hover:bg-blue-100 transition-colors">
              <Mail size={17} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-800">Comptable</p>
              <p className="text-[12px] text-gray-400">Accès complet au cabinet</p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium
              text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors w-fit"
            onClick={(e) => { e.stopPropagation(); setShowAccountantModal(true); }}
          >
            <UserPlus size={13} />
            Inviter un comptable
          </button>
        </div>

        {/* Card client */}
        <div
          className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4
            hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer group"
          style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
          onClick={() => setShowClientModal(true)}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center
              group-hover:bg-emerald-100 transition-colors">
              <Users size={17} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-800">Client</p>
              <p className="text-[12px] text-gray-400">Accès limité à son espace</p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium
              text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors w-fit"
            onClick={(e) => { e.stopPropagation(); setShowClientModal(true); }}
          >
            <UserPlus size={13} />
            Inviter un client
          </button>
        </div>

      </div>

      {/* Invitations list */}
      <div
        className="bg-white rounded-xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
      >
        {listError && <ErrorBanner message={listError} />}

        {invitations.length === 0 && !listError ? (
          <div className="py-14 text-center">
            <p className="text-[14px] font-semibold text-gray-600">Aucune invitation</p>
            <p className="text-[13px] text-gray-400 mt-1">
              Commencez par inviter un comptable ou un client.
            </p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-3">Email</th>
                <th className="text-left font-medium px-4 py-3">Nom</th>
                <th className="text-left font-medium px-4 py-3">Rôle</th>
                <th className="text-left font-medium px-4 py-3">Client lié</th>
                <th className="text-left font-medium px-4 py-3">Statut</th>
                <th className="text-left font-medium px-4 py-3">Expiration</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-800">{inv.email}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {inv.first_name} {inv.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {ROLE_LABELS[inv.role] ?? inv.role}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {inv.client_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]
                      bg-gray-100 text-gray-600">
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
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
  );
}
