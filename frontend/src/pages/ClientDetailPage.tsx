import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, Upload, ArrowLeft } from 'lucide-react';
import { getClient, getInvoicesByClient } from '../api';
import { InvoicesTable } from '../features/invoices/InvoicesTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import type { Client, Invoice } from '../types';

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const [client,   setClient]   = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!clientId) {
      setError('Identifiant client manquant.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    Promise.all([getClient(clientId), getInvoicesByClient(clientId)])
      .then(([c, inv]) => { setClient(c); setInvoices(inv); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Erreur bloquante (client non chargé) — on affiche sans le layout complet
  if (error && !client) return (
    <div className="space-y-4">
      <ErrorBanner message={error} onRetry={fetchData} />
      <div className="text-center py-8">
        <Link to="/clients" className="text-[13px] text-blue-600 hover:underline">
          ← Retour aux clients
        </Link>
      </div>
    </div>
  );

  if (!client) return (
    <div className="text-center py-24">
      <p className="text-[14px] font-semibold text-gray-600">Client introuvable.</p>
      <Link to="/clients" className="text-[13px] text-blue-600 hover:underline mt-2 inline-block">
        ← Retour aux clients
      </Link>
    </div>
  );

  const toReview = invoices.filter(i => i.status === 'to_review').length;

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-gray-400 mb-5">
        <button onClick={() => navigate('/clients')} className="hover:text-gray-600 transition-colors">
          Clients
        </button>
        <ChevronRight size={12} />
        <span className="text-gray-700 font-medium">{client.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/clients')}
            className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center
              text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="text-[20px] font-bold text-gray-900">{client.name}</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">
              {invoices.length} document{invoices.length > 1 ? 's' : ''}
              {toReview > 0 && (
                <span className="ml-2 text-amber-600 font-medium">· {toReview} à vérifier</span>
              )}
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700
          text-white text-[13px] font-medium rounded-lg transition-colors shadow-sm">
          <Upload size={14} />
          Uploader un document
        </button>
      </div>

      {/* Erreur non-bloquante (factures non chargées mais client OK) */}
      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {/* Table */}
      <div
        className="bg-white rounded-xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
      >
        {invoices.length === 0 && !error ? (
          <EmptyState
            title="Aucune facture"
            description="Uploadez le premier document de ce client pour commencer."
          />
        ) : !error ? (
          <InvoicesTable
            invoices={invoices}
            onRowClick={inv => navigate(`/clients/${clientId}/invoices/${inv.id}`)}
          />
        ) : null}
      </div>
    </>
  );
}
