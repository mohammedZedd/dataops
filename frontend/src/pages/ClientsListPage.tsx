import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Users, X, CheckCircle, User, Mail, Phone, Building2, Calendar, Ban } from 'lucide-react';
import { getClientUsers, revokeClientAccess } from '../api/clients';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import type { ClientUser } from '../types';

// ─── Confirmation modal (portal) ─────────────────────────────────────────────

interface ConfirmRevokeModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmRevokeModal({ onConfirm, onCancel }: ConfirmRevokeModalProps) {
  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
        onClick={onCancel}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 420, background: '#fff', borderRadius: 12,
        padding: '24px 32px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        zIndex: 10000,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            height: 48, width: 48, borderRadius: '50%',
            background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#EF4444', fontWeight: 700, fontSize: 22 }}>!</span>
          </div>
        </div>
        <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, color: '#111827', marginBottom: 8 }}>
          Révoquer l'accès
        </h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
          Êtes-vous sûr de vouloir révoquer l'accès de ce client ? Il ne pourra plus se connecter à la plateforme.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 42, fontSize: 14, fontWeight: 500,
              color: '#4B5563', background: '#fff',
              border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="hover:bg-red-600 transition-colors"
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
  );
}

// ─── Client detail drawer ─────────────────────────────────────────────────────

interface DetailDrawerProps {
  client: ClientUser;
  onClose: () => void;
  onRevoked: (id: string) => void;
}

function DetailDrawer({ client, onClose, onRevoked }: DetailDrawerProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [revoking,    setRevoking]    = useState(false);
  const [isActive,    setIsActive]    = useState(client.is_active);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRevoke() {
    setShowConfirm(false);
    setRevoking(true);
    setActionError(null);
    try {
      await revokeClientAccess(client.id);
      setIsActive(false);
      onRevoked(client.id);
    } catch {
      setActionError("Impossible de révoquer l'accès. Veuillez réessayer.");
    } finally {
      setRevoking(false);
    }
  }

  const initials = `${client.first_name.charAt(0)}${client.last_name.charAt(0)}`.toUpperCase();

  const infoRows = [
    { icon: <User size={15} color="#6B7280" />,     label: 'Nom complet',  value: `${client.first_name} ${client.last_name}` },
    { icon: <Mail size={15} color="#6B7280" />,     label: 'Email',        value: client.email },
    { icon: <Phone size={15} color="#6B7280" />,    label: 'Téléphone',    value: client.phone_number ?? '—' },
    { icon: <Building2 size={15} color="#6B7280" />,label: 'Entreprise',   value: client.client_company_name ?? '—' },
    { icon: <Calendar size={15} color="#6B7280" />, label: 'Inscription',  value: new Date(client.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
  ];

  return createPortal(
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 380,
        background: '#fff', zIndex: 9999,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Avatar */}
              <div style={{
                height: 40, width: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: '#fff', fontSize: 15, fontWeight: 700,
              }}>
                {initials}
              </div>
              {/* Name + status */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                    {client.first_name} {client.last_name}
                  </p>
                  {isActive ? (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0',
                    }}>Actif</span>
                  ) : (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      background: '#F9FAFB', color: '#9CA3AF', border: '1px solid #E5E7EB',
                    }}>Inactif</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>Détails du client</p>
              </div>
            </div>
            {/* Close */}
            <button
              onClick={onClose}
              style={{
                height: 32, width: 32, borderRadius: 8, border: 'none', flexShrink: 0,
                background: '#F9FAFB', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#6B7280',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Info rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {infoRows.map(({ icon, label, value }, idx) => (
            <div
              key={label}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px',
                borderBottom: idx < infoRows.length - 1 ? '1px solid #F9FAFB' : 'none',
              }}
            >
              <div style={{
                height: 34, width: 34, borderRadius: 8, background: '#F9FAFB',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {icon}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                  {label}
                </p>
                <p style={{ fontSize: 14, color: '#374151' }}>{value}</p>
              </div>
            </div>
          ))}

          {actionError && (
            <div style={{
              margin: '12px 20px', padding: '10px 14px', borderRadius: 8,
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontSize: 13, color: '#DC2626',
            }}>
              {actionError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #F3F4F6' }}>
          {isActive ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={revoking}
              onMouseEnter={(e) => { if (!revoking) (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
              style={{
                width: '100%', height: 44, fontSize: 14, fontWeight: 500,
                color: '#EF4444', background: '#fff',
                border: '1.5px solid #EF4444', borderRadius: 8, cursor: revoking ? 'not-allowed' : 'pointer',
                opacity: revoking ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
            >
              <Ban size={15} />
              {revoking ? 'Révocation…' : "Révoquer l'accès"}
            </button>
          ) : (
            <div style={{
              width: '100%', height: 44, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              background: '#F9FAFB', borderRadius: 8,
              fontSize: 14, fontWeight: 500, color: '#9CA3AF',
              border: '1px solid #E5E7EB',
            }}>
              Accès déjà révoqué
            </div>
          )}
        </div>
      </div>

      {showConfirm && (
        <ConfirmRevokeModal
          onConfirm={handleRevoke}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>,
    document.body
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientsListPage() {
  const [clients,      setClients]      = useState<ClientUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [selected,     setSelected]     = useState<ClientUser | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  const fetchClients = useCallback(() => {
    setLoading(true);
    setError(null);
    getClientUsers()
      .then(setClients)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  function handleRevoked(userId: string) {
    setClients((prev) => prev.map((c) => c.id === userId ? { ...c, is_active: false } : c));
    if (selected?.id === userId) setSelected((prev) => prev ? { ...prev, is_active: false } : null);
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  }

  return (
    <>
      {/* Toast */}
      <div className={`fixed top-16 right-4 z-[10001] flex items-center gap-2.5 bg-white border border-green-200
        rounded-xl shadow-lg px-4 py-3 transition-all duration-300
        ${successToast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}
      >
        <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-800">Accès révoqué avec succès</span>
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="pb-5 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
          {!loading && !error && (
            <p className="text-sm text-gray-500 mt-0.5">
              {clients.length} client{clients.length > 1 ? 's' : ''} inscrit{clients.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {error && <ErrorBanner message={error} onRetry={fetchClients} />}

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : clients.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Users size={18} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Aucun client inscrit</p>
              <p className="text-sm text-gray-400 mt-1">
                Les clients apparaissent ici après avoir accepté leur invitation.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Nom</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Téléphone</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Entreprise</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Inscription</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Statut</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-gray-50 transition-colors ${idx < clients.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {c.phone_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.client_company_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      {c.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-green-50 text-green-700 border border-green-200">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-gray-100 text-gray-500 border border-gray-200">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(c)}
                        className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200
                          rounded-lg hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Voir détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onRevoked={handleRevoked}
        />
      )}
    </>
  );
}
