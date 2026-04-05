import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft, FileText, Loader2, Download } from 'lucide-react';
import { getInvoice, getClient, updateInvoice, validateInvoice } from '../api';
import { getPresignedPreviewUrl, getPresignedDownloadUrl, extractDocumentData } from '../api/documents';
import type { ExtractionResult } from '../api/documents';
import { InvoiceForm } from '../features/invoices/InvoiceForm';
import { AccountingSection } from '../features/invoices/AccountingSection';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import type { Client, Invoice } from '../types';

// ─── Document preview ─────────────────────────────────────────────────────────

function DocumentPreview({ documentId }: { documentId: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    getPresignedPreviewUrl(documentId)
      .then(url => setPreviewUrl(url))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [documentId]);

  async function handleDownload() {
    try {
      const url = await getPresignedDownloadUrl(documentId);
      window.open(url, '_blank');
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <Loader2 size={24} className="text-blue-500 animate-spin mb-3" />
        <p className="text-[13px] text-gray-500">Chargement de l'aperçu…</p>
      </div>
    );
  }

  if (error || !previewUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-4">
          <FileText size={28} className="text-gray-300" />
        </div>
        <p className="text-[13px] font-medium text-gray-500">Aperçu non disponible</p>
        <button
          onClick={handleDownload}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium
            text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <Download size={13} />
          Télécharger le document
        </button>
      </div>
    );
  }

  return (
    <iframe
      src={previewUrl}
      className="w-full h-full rounded-lg border border-gray-200"
      title="Aperçu du document"
      style={{ border: 'none', borderRadius: 8 }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const { clientId, invoiceId } = useParams<{ clientId: string; invoiceId: string }>();
  const navigate = useNavigate();

  const [client,    setClient]    = useState<Client | null>(null);
  const [invoice,   setInvoice]   = useState<Invoice | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Extraction state
  const [extraction,      setExtraction]      = useState<ExtractionResult | null>(null);
  const [extracting,      setExtracting]      = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const extractionRan = useRef(false);

  const fetchData = useCallback(() => {
    if (!clientId || !invoiceId) {
      setError('Paramètres manquants.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    Promise.all([getClient(clientId), getInvoice(invoiceId)])
      .then(([c, inv]) => { setClient(c); setInvoice(inv); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId, invoiceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-extract on first load if form is empty
  useEffect(() => {
    if (!invoice || extractionRan.current || extracting) return;
    const isEmpty = !invoice.invoice_number && !invoice.supplier_name
      && !invoice.date && invoice.total_amount === 0 && invoice.vat_amount === 0;
    if (!isEmpty) return;

    extractionRan.current = true;
    runExtraction();
  }, [invoice]);

  async function runExtraction() {
    if (!invoice) return;
    setExtracting(true);
    setExtractionError(null);
    try {
      const result = await extractDocumentData(invoice.document_id);
      setExtraction(result);

      // Auto-save extracted fields
      if (result.confidence > 0 && invoiceId) {
        const payload: Record<string, unknown> = {};
        if (result.invoice_number) payload.invoice_number = result.invoice_number;
        if (result.supplier_name)  payload.supplier_name = result.supplier_name;
        if (result.date)           payload.date = result.date;
        if (result.total_amount)   payload.total_amount = result.total_amount;
        if (result.vat_amount)     payload.vat_amount = result.vat_amount;

        if (Object.keys(payload).length > 0) {
          try {
            const updated = await updateInvoice(invoiceId, payload as Parameters<typeof updateInvoice>[1]);
            setInvoice(updated);
          } catch { /* best effort */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction impossible";
      setExtractionError(msg);
    } finally {
      setExtracting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error && (!invoice || !client)) return (
    <div className="space-y-4">
      <ErrorBanner message={error} onRetry={fetchData} />
      <div className="text-center py-8">
        <Link to={`/clients/${clientId}`} className="text-[13px] text-blue-600 hover:underline">
          ← Retour au client
        </Link>
      </div>
    </div>
  );

  if (!invoice || !client) return (
    <div className="text-center py-24">
      <p className="text-[14px] font-semibold text-gray-600">Document introuvable.</p>
      <Link to={`/clients/${clientId}`} className="text-[13px] text-blue-600 hover:underline mt-2 inline-block">
        ← Retour au client
      </Link>
    </div>
  );

  async function handleSave(data: Parameters<typeof updateInvoice>[1]) {
    if (!invoiceId) return;
    setSaveError(null);
    try {
      const updated = await updateInvoice(invoiceId, data);
      setInvoice(updated);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Impossible de sauvegarder.');
    }
  }

  async function handleValidate() {
    if (!invoiceId) return;
    setSaveError(null);
    try {
      const updated = await validateInvoice(invoiceId);
      setInvoice(updated);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Impossible de valider.');
    }
  }

  const displayName = invoice.supplier_name || invoice.invoice_number || 'Nouvelle facture';

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-gray-400 mb-5">
        <button onClick={() => navigate('/clients')} className="hover:text-gray-600 transition-colors">
          Clients
        </button>
        <ChevronRight size={12} />
        <button onClick={() => navigate(`/clients/${clientId}`)} className="hover:text-gray-600 transition-colors">
          {client.name}
        </button>
        <ChevronRight size={12} />
        <span className="text-gray-700 font-medium font-mono">{invoice.invoice_number || 'Facture'}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center
            text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-gray-900">{displayName}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          {invoice.invoice_number && (
            <p className="text-[12px] text-gray-500 mt-0.5 font-mono">{invoice.invoice_number}</p>
          )}
        </div>
      </div>

      {saveError && <ErrorBanner message={saveError} />}

      {/* 2-column layout: preview + form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left — aperçu */}
        <div
          className="bg-white rounded-xl border border-gray-100 p-4"
          style={{ minHeight: '520px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Aperçu du document
          </p>
          <div style={{ height: '460px' }}>
            <DocumentPreview documentId={invoice.document_id} />
          </div>
        </div>

        {/* Right — formulaire */}
        <div
          className="bg-white rounded-xl border border-gray-100 p-5"
          style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
        >
          <InvoiceForm
            invoice={invoice}
            extraction={extraction}
            extracting={extracting}
            extractionError={extractionError}
            onSave={handleSave}
            onValidate={handleValidate}
            onReExtract={() => { extractionRan.current = false; runExtraction(); }}
          />
        </div>

      </div>

      {/* Accounting section — full width below */}
      <div className="mt-5">
        <AccountingSection
          invoiceId={invoice.id}
          secteurActivite={client.secteur_activite}
          regimeFiscal={client.regime_fiscal}
          totalAmount={invoice.total_amount}
          vatAmount={invoice.vat_amount}
          accountingValidated={invoice.accounting_validated}
          onSaved={() => fetchData()}
        />
      </div>
    </>
  );
}
