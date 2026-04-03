import { useEffect, useState, useCallback } from 'react';
import { Users } from 'lucide-react';
import { getClientUsers } from '../api/clients';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import type { ClientUser } from '../types';

export default function ClientsListPage() {
  const [clients,   setClients]   = useState<ClientUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchClients = useCallback(() => {
    setLoading(true);
    setError(null);
    getClientUsers()
      .then(setClients)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  return (
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
