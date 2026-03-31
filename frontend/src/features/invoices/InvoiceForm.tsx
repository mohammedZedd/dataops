import { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '../../types';

interface Props {
  invoice: Invoice;
  onSave: (data: Partial<Omit<Invoice, 'id' | 'clientId' | 'documentId'>>) => Promise<void>;
  onValidate: () => Promise<void>;
}

const INPUT_CLS =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export function InvoiceForm({ invoice, onSave, onValidate }: Props) {
  const [form, setForm] = useState({
    invoiceNumber: invoice.invoiceNumber,
    date:          invoice.date,
    supplierName:  invoice.supplierName,
    totalAmount:   String(invoice.totalAmount),
    vatAmount:     String(invoice.vatAmount),
    status:        invoice.status as InvoiceStatus,
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  function change(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await onSave({
      invoiceNumber: form.invoiceNumber,
      date:          form.date,
      supplierName:  form.supplierName,
      totalAmount:   parseFloat(form.totalAmount) || 0,
      vatAmount:     parseFloat(form.vatAmount)   || 0,
      status:        form.status,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleValidate() {
    setSaving(true);
    await onValidate();
    setForm(prev => ({ ...prev, status: 'validated' }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const isValidated = form.status === 'validated';

  return (
    <div className="flex flex-col h-full">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-4">
        Données extraites
      </p>

      <div className="flex-1 space-y-4">
        <Field label="N° de facture">
          <input type="text" value={form.invoiceNumber} onChange={e => change('invoiceNumber', e.target.value)} className={INPUT_CLS} />
        </Field>

        <Field label="Date">
          <input type="date" value={form.date} onChange={e => change('date', e.target.value)} className={INPUT_CLS} />
        </Field>

        <Field label="Fournisseur">
          <input type="text" value={form.supplierName} onChange={e => change('supplierName', e.target.value)} className={INPUT_CLS} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant TTC (€)">
            <input type="number" step="0.01" value={form.totalAmount} onChange={e => change('totalAmount', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="TVA (€)">
            <input type="number" step="0.01" value={form.vatAmount} onChange={e => change('vatAmount', e.target.value)} className={INPUT_CLS} />
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
            ✓ Modifications enregistrées
          </p>
        )}
      </div>
    </div>
  );
}
