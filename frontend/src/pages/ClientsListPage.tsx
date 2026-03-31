import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertCircle } from 'lucide-react';
import { getClients, createClient } from '../api';
import { ClientsTable } from '../features/clients/ClientsTable';
import { AddClientModal } from '../features/clients/AddClientModal';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import type { Client } from '../types';

export default function ClientsListPage() {
  const navigate = useNavigate();

  const [clients,   setClients]   = useState<Client[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // useCallback pour pouvoir passer fetchClients au bouton "Réessayer"
  const fetchClients = useCallback(() => {
    setLoading(true);
    setError(null);
    getClients()
      .then(setClients)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  async function handleCreate(name: string) {
    const created = await createClient(name); // erreurs remontées au modal
    setClients(prev => [...prev, created]);
  }

  const totalToReview = clients.reduce((s, c) => s + c.invoicesToReview, 0);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Gestion
          </p>
          <h1 className="text-[20px] font-bold text-gray-900">Clients</h1>
          {!loading && !error && (
            <p className="text-[13px] text-gray-500 mt-0.5">
              {clients.length} client{clients.length > 1 ? 's' : ''} actif{clients.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700
            text-white text-[13px] font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus size={15} />
          Ajouter un client
        </button>
      </div>

      {/* Erreur */}
      {error && <ErrorBanner message={error} onRetry={fetchClients} />}

      {/* Alerte factures en attente */}
      {!error && totalToReview > 0 && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-5">
          <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
          <p className="text-[13px] text-amber-700">
            <span className="font-semibold">
              {totalToReview} facture{totalToReview > 1 ? 's' : ''}
            </span>
            {' '}nécessite{totalToReview > 1 ? 'nt' : ''} une vérification.
          </p>
        </div>
      )}

      {/* Table card */}
      <div
        className="bg-white rounded-xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          // Erreur déjà affichée via ErrorBanner, on affiche juste une table vide stylée
          <div className="py-12 text-center">
            <p className="text-[13px] text-gray-400">Les données n'ont pas pu être chargées.</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[14px] font-semibold text-gray-600">Aucun client</p>
            <p className="text-[13px] text-gray-400 mt-1">Commencez par ajouter votre premier client.</p>
          </div>
        ) : (
          <ClientsTable
            clients={clients}
            onRowClick={c => navigate(`/clients/${c.id}`)}
          />
        )}
      </div>

      {showModal && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </>
  );
}
