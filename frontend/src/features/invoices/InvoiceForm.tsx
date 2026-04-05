import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import type { Invoice, InvoiceStatus, InvoiceDirection } from '../../types';
import type { ExtractionResult } from '../../api/documents';

interface Props {
  invoice: Invoice;
  extraction: ExtractionResult | null;
  extracting: boolean;
  extractionError?: string | null;
  onSave: (data: Partial<Pick<Invoice, 'invoice_number' | 'date' | 'supplier_name' | 'total_amount' | 'vat_amount' | 'status' | 'direction'>>) => Promise<void>;
  onValidate: () => Promise<void>;
  onReExtract?: () => void;
}

const INPUT_CLS =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white';

const EXTRACTED_BORDER = { borderLeft: '3px solid #3B82F6' };

function Field({ label, extracted, children }: { label: string; extracted?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
        {label}
      </label>
      <div style={extracted ? EXTRACTED_BORDER : undefined} className={extracted ? 'rounded-lg' : ''}>
        {children}
      </div>
    </div>
  );
}

export function InvoiceForm({ invoice, extraction, extracting, extractionError, onSave, onValidate, onReExtract }: Props) {
  const [form, setForm] = useState({
    invoiceNumber: invoice.invoice_number,
    date:          invoice.date,
    supplierName:  invoice.supplier_name,
    totalAmount:   String(invoice.total_amount),
    vatAmount:     String(invoice.vat_amount),
    status:        invoice.status as InvoiceStatus,
    direction:     (invoice.direction || 'achat') as InvoiceDirection,
  });
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<Set<string>>(new Set());

  // Sync form when invoice prop changes
  useEffect(() => {
    setForm({
      invoiceNumber: invoice.invoice_number,
      date:          invoice.date,
      supplierName:  invoice.supplier_name,
      totalAmount:   String(invoice.total_amount),
      vatAmount:     String(invoice.vat_amount),
      status:        invoice.status as InvoiceStatus,
      direction:     (invoice.direction || 'achat') as InvoiceDirection,
    });
  }, [invoice]);

  // Apply extraction data when it arrives
  useEffect(() => {
    if (!extraction || extraction.confidence === 0) return;
    const isFormEmpty = !invoice.invoice_number && !invoice.supplier_name && !invoice.date
      && invoice.total_amount === 0 && invoice.vat_amount === 0;
    if (!isFormEmpty) return;

    const filled = new Set<string>();
    setForm(prev => {
      const next = { ...prev };
      if (extraction.invoice_number) { next.invoiceNumber = extraction.invoice_number; filled.add('invoiceNumber'); }
      if (extraction.supplier_name)  { next.supplierName  = extraction.supplier_name;  filled.add('supplierName'); }
      if (extraction.date)           { next.date          = extraction.date;           filled.add('date'); }
      if (extraction.total_amount)   { next.totalAmount   = String(extraction.total_amount); filled.add('totalAmount'); }
      if (extraction.vat_amount)     { next.vatAmount     = String(extraction.vat_amount);   filled.add('vatAmount'); }
      return next;
    });
    setExtractedFields(filled);
  }, [extraction, invoice]);

  function change(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setExtractedFields(prev => { const next = new Set(prev); next.delete(field); return next; });
    setSaved(false);
  }

  const ttc = parseFloat(form.totalAmount) || 0;
  const tva = parseFloat(form.vatAmount)   || 0;
  const ht  = Math.max(0, ttc - tva);

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        invoice_number: form.invoiceNumber,
        date:           form.date,
        supplier_name:  form.supplierName,
        total_amount:   parseFloat(form.totalAmount) || 0,
        vat_amount:     parseFloat(form.vatAmount)   || 0,
        status:         form.status,
        direction:      form.direction,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    setSaving(true);
    setFormError(null);
    try {
      await onValidate();
      setForm(prev => ({ ...prev, status: 'validated' }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la validation.');
    } finally {
      setSaving(false);
    }
  }

  const isValidated = form.status === 'validated';
  const isEx = (field: string) => extractedFields.has(field);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Données de la facture
        </p>
        {onReExtract && (
          <button
            onClick={onReExtract}
            disabled={extracting}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
          >
            {extracting ? 'Extraction…' : 'Relancer l\'extraction'}
          </button>
        )}
      </div>

      {/* Extraction status banners */}
      {extracting && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
          <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-blue-700">Extraction des données en cours…</p>
        </div>
      )}

      {!extracting && extractionError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] text-red-700">{extractionError}</p>
            <p className="text-[11px] text-red-500 mt-1">Veuillez remplir les champs manuellement.</p>
          </div>
        </div>
      )}

      {!extracting && !extractionError && extraction && extraction.confidence > 0 && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 mb-4 border ${
          extraction.confidence > 0.8
            ? 'bg-emerald-50 border-emerald-200'
            : extraction.confidence >= 0.5
            ? 'bg-amber-50 border-amber-200'
            : 'bg-orange-50 border-orange-200'
        }`}>
          {extraction.confidence > 0.8
            ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            : <AlertTriangle size={13} className={`flex-shrink-0 mt-0.5 ${extraction.confidence >= 0.5 ? 'text-amber-500' : 'text-orange-500'}`} />
          }
          <p className={`text-[12px] ${
            extraction.confidence > 0.8 ? 'text-emerald-700'
              : extraction.confidence >= 0.5 ? 'text-amber-700'
              : 'text-orange-700'
          }`}>
            {extraction.confidence > 0.8
              ? 'Données extraites automatiquement — veuillez vérifier'
              : extraction.confidence >= 0.5
              ? 'Extraction partielle — certains champs à compléter manuellement'
              : 'Extraction difficile — veuillez remplir manuellement'}
          </p>
        </div>
      )}

      {/* Moroccan legal identifiers (if extracted) */}
      {extraction && (extraction.ice || extraction.if_fiscal || extraction.rc) && (
        <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">
          <Info size={13} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-gray-600 space-y-0.5">
            {extraction.ice && <p><span className="font-semibold">ICE:</span> {extraction.ice}</p>}
            {extraction.if_fiscal && <p><span className="font-semibold">IF:</span> {extraction.if_fiscal}</p>}
            {extraction.rc && <p><span className="font-semibold">RC:</span> {extraction.rc}</p>}
            {extraction.tp && <p><span className="font-semibold">TP:</span> {extraction.tp}</p>}
            {extraction.cnss && <p><span className="font-semibold">CNSS:</span> {extraction.cnss}</p>}
          </div>
        </div>
      )}

      {/* Currency warning */}
      {!extracting && extraction && extraction.currency === 'EUR' && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
          <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-[12px] text-blue-700">
            <p>Devise détectée : <span className="font-semibold">EUR</span> — Les montants sont en euros.</p>
            <p className="text-[11px] text-blue-500 mt-0.5">Convertissez en MAD si nécessaire (1 EUR ≈ 10.8 MAD, taux indicatif).</p>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4">
        {/* Direction toggle */}
        <Field label="Direction">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => change('direction', 'achat')}
              className="flex-1 py-2 text-[13px] font-semibold rounded-lg transition-colors"
              style={{
                background: form.direction === 'achat' ? '#FEE2E2' : '#F3F4F6',
                color:      form.direction === 'achat' ? '#991B1B' : '#9CA3AF',
                border: form.direction === 'achat' ? '1px solid #FECACA' : '1px solid #E5E7EB',
              }}
            >
              ACHAT
            </button>
            <button
              type="button"
              onClick={() => change('direction', 'vente')}
              className="flex-1 py-2 text-[13px] font-semibold rounded-lg transition-colors"
              style={{
                background: form.direction === 'vente' ? '#D1FAE5' : '#F3F4F6',
                color:      form.direction === 'vente' ? '#065F46' : '#9CA3AF',
                border: form.direction === 'vente' ? '1px solid #A7F3D0' : '1px solid #E5E7EB',
              }}
            >
              VENTE
            </button>
          </div>
        </Field>

        <Field label="N° de facture" extracted={isEx('invoiceNumber')}>
          <input type="text" value={form.invoiceNumber} onChange={e => change('invoiceNumber', e.target.value)} className={INPUT_CLS} placeholder="FAC-2026-001" />
        </Field>

        <Field label="Date" extracted={isEx('date')}>
          <input type="date" value={form.date} onChange={e => change('date', e.target.value)} className={INPUT_CLS} />
        </Field>

        <Field label="Fournisseur" extracted={isEx('supplierName')}>
          <input type="text" value={form.supplierName} onChange={e => change('supplierName', e.target.value)} className={INPUT_CLS} placeholder="Nom du fournisseur" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Montant TTC" extracted={isEx('totalAmount')}>
            <div className="relative">
              <input type="number" step="0.01" value={form.totalAmount} onChange={e => change('totalAmount', e.target.value)} className={INPUT_CLS} style={{ paddingRight: 44 }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400">MAD</span>
            </div>
          </Field>
          <Field label="TVA" extracted={isEx('vatAmount')}>
            <div className="relative">
              <input type="number" step="0.01" value={form.vatAmount} onChange={e => change('vatAmount', e.target.value)} className={INPUT_CLS} style={{ paddingRight: 44 }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400">MAD</span>
            </div>
          </Field>
          <Field label="Montant HT">
            <div className="relative">
              <input type="number" value={ht.toFixed(2)} readOnly className={INPUT_CLS + ' bg-gray-50 text-gray-500'} style={{ paddingRight: 44 }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400">MAD</span>
            </div>
          </Field>
        </div>

        <Field label="Statut">
          <select value={form.status} onChange={e => change('status', e.target.value)} className={INPUT_CLS}>
            <option value="to_review">À vérifier</option>
            <option value="validated">Validée</option>
            <option value="rejected">Rejetée</option>
          </select>
        </Field>
      </div>

      {/* Actions */}
      <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
        {form.status === 'to_review' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700">
              Vérifiez les données extraites avant de valider.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-[13px] font-medium text-gray-700 bg-gray-100
              hover:bg-gray-200 disabled:opacity-60 rounded-lg transition-colors"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            onClick={handleValidate}
            disabled={saving || isValidated}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2
              text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700
              disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <CheckCircle2 size={14} />
            {isValidated ? 'Validée' : 'Valider'}
          </button>
        </div>

        {saved && (
          <p className="text-center text-[12px] text-emerald-600 font-medium">
            Modifications enregistrées
          </p>
        )}

        {formError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-700">{formError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
