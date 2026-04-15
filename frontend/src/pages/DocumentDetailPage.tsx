import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft, FileText, Loader2, Download, Mic, Maximize2, X } from 'lucide-react';
import { getInvoice, getClient, updateInvoice, validateInvoice } from '../api';
import { getPresignedPreviewUrl, getPresignedDownloadUrl, extractDocumentData } from '../api/documents';
import type { ExtractionResult } from '../api/documents';
import apiClient from '../api/axios';
import { InvoiceForm } from '../features/invoices/InvoiceForm';
import { AccountingSection } from '../features/invoices/AccountingSection';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import type { Client, Invoice } from '../types';

// ─── Document preview ─────────────────────────────────────────────────────────

function DocumentPreview({ documentId, fileName }: { documentId: string; fileName?: string }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

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

  const displayName = fileName || 'Document';

  if (loading) {
    return (
      <div className="flex flex-col h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 flex-shrink-0">
          <span className="text-[13px] text-gray-400">Chargement…</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
          <Loader2 size={24} className="text-blue-500 animate-spin mb-3" />
          <p className="text-[13px] text-gray-500">Chargement de l'aperçu…</p>
        </div>
      </div>
    );
  }

  if (error || !previewUrl) {
    return (
      <div className="flex flex-col h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 flex-shrink-0">
          <span className="text-[13px] text-gray-300 font-medium truncate">{displayName}</span>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
          >
            <Download size={13} /> <span className="hidden sm:inline">Télécharger</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
          <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-4">
            <FileText size={28} className="text-gray-300" />
          </div>
          <p className="text-[13px] font-medium text-gray-500">Aperçu non disponible</p>
          <button
            onClick={handleDownload}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium
              text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Download size={13} /> Télécharger le document
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Viewer with toolbar */}
      <div className="flex flex-col h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        {/* Dark toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 flex-shrink-0">
          <span className="text-[13px] text-gray-300 font-medium truncate max-w-[50%]">
            {displayName}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title="Télécharger"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Télécharger</span>
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title="Plein écran"
            >
              <Maximize2 size={13} />
              <span className="hidden sm:inline">Plein écran</span>
            </button>
          </div>
        </div>
        {/* iframe */}
        <div className="flex-1 bg-gray-100 overflow-hidden">
          <iframe
            src={previewUrl}
            className="w-full h-full"
            title="Aperçu du document"
            style={{ border: 'none' }}
          />
        </div>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-6 py-4 bg-gray-900 flex-shrink-0">
            <span className="text-white text-[15px] font-medium truncate max-w-[60%]">{displayName}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-[13px] text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Download size={14} /> Télécharger
              </button>
              <button
                onClick={() => setFullscreen(false)}
                className="flex items-center gap-2 px-4 py-2 text-[13px] text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={14} /> Fermer
              </button>
            </div>
          </div>
          <div className="flex-1 bg-gray-100">
            <iframe
              src={previewUrl}
              className="w-full h-full"
              title="Document plein écran"
              style={{ border: 'none' }}
            />
          </div>
        </div>
      )}
    </>
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

  // Audio document state
  const [isAudio,    setIsAudio]    = useState(false);
  const [docMeta,    setDocMeta]    = useState<{ file_name: string; file_size: number | null; description: string | null } | null>(null);
  const [audioUrl,   setAudioUrl]   = useState<string | null>(null);

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
      .then(async ([c, inv]) => {
        setClient(c);
        setInvoice(inv);
        // Fetch document metadata to detect audio
        try {
          const { data: doc } = await apiClient.get(`/documents/${inv.document_id}`);
          if (doc.doc_type === 'audio') {
            setIsAudio(true);
            setDocMeta({ file_name: doc.file_name, file_size: doc.file_size, description: doc.description });
            const url = await getPresignedDownloadUrl(inv.document_id);
            setAudioUrl(url);
          }
        } catch { /* ignore — not critical */ }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId, invoiceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-extract on first load if form is empty (skip for audio)
  useEffect(() => {
    if (!invoice || extractionRan.current || extracting || isAudio) return;
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

  // ─── Audio document viewer ─────────────────────────────────────────────────
  if (isAudio) {
    const fileName = docMeta?.file_name ?? 'Note vocale';
    const fileSize = docMeta?.file_size;
    const description = docMeta?.description;

    async function handleAudioDownload() {
      try {
        const url = await getPresignedDownloadUrl(invoice!.document_id);
        window.open(url, '_blank');
      } catch { /* ignore */ }
    }

    return (
      <>
        <nav className="flex items-center gap-1.5 text-[12px] text-gray-400 mb-5">
          <button onClick={() => navigate('/clients')} className="hover:text-gray-600 transition-colors">Clients</button>
          <ChevronRight size={12} />
          <button onClick={() => navigate(`/clients/${clientId}`)} className="hover:text-gray-600 transition-colors">{client.name}</button>
          <ChevronRight size={12} />
          <span className="text-gray-700 font-medium">Note vocale</span>
        </nav>

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft size={15} />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900">Note vocale</h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
            style={{ background: '#F5F3FF', color: '#7C3AED' }}>
            <Mic size={13} /> Audio
          </span>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-8 max-w-xl"
          style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>

          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{ background: '#F5F3FF' }}>
              <Mic size={24} className="text-violet-500" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-gray-900">{fileName}</p>
              <p className="text-[13px] text-gray-500 mt-0.5">
                {fileSize ? `${(fileSize / 1024).toFixed(1)} Ko` : '—'}
                {' · '}
                {new Date(invoice.date || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {description && (
            <div className="rounded-lg p-4 mb-6"
              style={{ background: '#F9FAFB', borderLeft: '3px solid #7C3AED' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Description</p>
              <p className="text-[14px] text-gray-700">{description}</p>
            </div>
          )}

          {audioUrl ? (
            <audio controls className="w-full mb-6" src={audioUrl}>
              Votre navigateur ne supporte pas la lecture audio.
            </audio>
          ) : (
            <div className="flex items-center justify-center py-8 mb-6">
              <Loader2 size={20} className="text-violet-500 animate-spin" />
            </div>
          )}

          <div className="flex gap-3 pt-5 border-t border-gray-100">
            <button onClick={handleAudioDownload}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg transition-colors">
              <Download size={14} /> Télécharger
            </button>
            <button onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <ArrowLeft size={14} /> Retour
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── Normal invoice view ───────────────────────────────────────────────────

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

      {/* 2-column layout: preview (2/3) + form (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Left — aperçu (2/3) */}
        <div
          className="lg:col-span-2"
          style={{ height: 'calc(100vh - 260px)', minHeight: 560 }}
        >
          <DocumentPreview
            documentId={invoice.document_id}
            fileName={invoice.invoice_number || invoice.supplier_name || undefined}
          />
        </div>

        {/* Right — formulaire (1/3) */}
        <div
          className="bg-white rounded-xl border border-gray-100 p-5 lg:sticky lg:top-6 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 260px)', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
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
