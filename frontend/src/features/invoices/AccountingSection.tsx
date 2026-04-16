import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, Check, X, Plus, ChevronUp, Info,
  BookOpen, Loader2, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { getSuggestedAccounts, saveInvoiceAccounts, exportInvoiceExcel } from '../../api/invoices';
import type { AccountEntry, AccountSuggestion, InvoiceDirection, SuggestedAccountsResponse, RetenueSource } from '../../types';

interface Props {
  invoiceId: string;
  secteurActivite?: string | null;
  regimeFiscal?: string | null;
  totalAmount: number;
  vatAmount: number;
  accountingValidated?: boolean;
  onSaved?: () => void;
}

type RowState = 'pending' | 'validated' | 'rejected';

interface AccountRow extends AccountSuggestion {
  state: RowState;
  editedAmount: string;
}

const TYPE_LABELS: Record<string, string> = {
  charge:  'Charge',
  produit: 'Produit',
  tva:     'TVA',
  tiers:   'Tiers',
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  charge:  { bg: '#FEF3C7', text: '#92400E' },
  produit: { bg: '#D1FAE5', text: '#065F46' },
  tva:     { bg: '#DBEAFE', text: '#1E40AF' },
  tiers:   { bg: '#F3F4F6', text: '#374151' },
};

const SENS_LABELS: Record<string, { label: string; color: string }> = {
  debit:  { label: 'Débit',  color: '#2563EB' },
  credit: { label: 'Crédit', color: '#059669' },
};

function formatAmount(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

export function AccountingSection({ invoiceId, secteurActivite, regimeFiscal, totalAmount, vatAmount, accountingValidated: initialValidated, onSaved }: Props) {
  const [data,      setData]      = useState<SuggestedAccountsResponse | null>(null);
  const [rows,      setRows]      = useState<AccountRow[]>([]);
  const [direction, setDirection] = useState<InvoiceDirection>('achat');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(initialValidated ?? false);
  const [exporting,  setExporting]  = useState(false);
  const [exportErr,  setExportErr]  = useState<string | null>(null);

  // Custom account add form
  const [showAdd,    setShowAdd]    = useState(false);
  const [addCode,    setAddCode]    = useState('');
  const [addLibelle, setAddLibelle] = useState('');
  const [addMontant, setAddMontant] = useState('');
  const [addType,    setAddType]    = useState('charge');
  const [addSens,    setAddSens]    = useState('debit');

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSuggestedAccounts(invoiceId);
      setData(result);
      setDirection(result.direction);
      setRows(
        result.suggested_accounts.map(acc => ({
          ...acc,
          state: acc.is_primary ? 'validated' : 'pending',
          editedAmount: String(acc.montant ?? ''),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  function updateAmount(index: number, value: string) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, editedAmount: value } : r));
  }

  function addCustomAccount() {
    if (!addCode.trim() || !addLibelle.trim()) return;
    const montant = parseFloat(addMontant) || 0;
    const newRow: AccountRow = {
      code: addCode.trim(),
      libelle: addLibelle.trim(),
      type: addType as AccountSuggestion['type'],
      sens: addSens as AccountSuggestion['sens'],
      montant,
      is_primary: false,
      obligatoire: false,
      state: 'validated',
      editedAmount: addMontant,
    };
    setRows(prev => [...prev, newRow]);
    setAddCode(''); setAddLibelle(''); setAddMontant(''); setAddType('charge'); setAddSens('debit');
    setShowAdd(false);
  }

  async function handleSave() {
    const accounts: AccountEntry[] = rows
      .filter(r => r.state === 'validated')
      .map(r => ({
        code: r.code,
        libelle: r.libelle,
        type: r.type,
        sens: r.sens,
        montant: parseFloat(r.editedAmount) || r.montant || 0,
        validated: true,
      }));

    if (accounts.length === 0) {
      setError('Aucun compte validé. Cliquez sur ✓ pour valider des comptes avant de sauvegarder.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveInvoiceAccounts(invoiceId, accounts, direction);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    setExportErr(null);
    try {
      await exportInvoiceExcel(invoiceId);
    } catch (err) {
      setExportErr(err instanceof Error ? err.message : 'Erreur export Excel.');
    } finally {
      setExporting(false);
    }
  }

  // ─── Balance check ────────────────────────────────────────────────────────
  const validatedRows = rows.filter(r => r.state === 'validated');
  const totalDebit  = validatedRows.filter(r => r.sens === 'debit').reduce((s, r) => s + (parseFloat(r.editedAmount) || r.montant || 0), 0);
  const totalCredit = validatedRows.filter(r => r.sens === 'credit').reduce((s, r) => s + (parseFloat(r.editedAmount) || r.montant || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // ─── No secteur warning ───────────────────────────────────────────────────
  if (!secteurActivite) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5"
        style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={15} className="text-gray-400" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Imputation comptable
          </p>
        </div>
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-amber-800">
              Secteur d'activité non renseigné
            </p>
            <p className="text-[12px] text-amber-700 mt-0.5">
              Les suggestions comptables ne sont pas disponibles. Veuillez mettre à jour le profil du client.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const INPUT_CLS =
    'border border-gray-200 rounded px-2 py-1 text-[12px] text-gray-800 ' +
    'focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white';

  const isAutoEntrepreneur = regimeFiscal === 'Auto-entrepreneur';
  const isExonere = data?.tva_rate === 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5"
      style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-gray-400" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Imputation comptable
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Direction toggle */}
            <button
              onClick={() => setDirection(d => d === 'achat' ? 'vente' : 'achat')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
              style={{
                background: direction === 'achat' ? '#FEE2E2' : '#D1FAE5',
                color:      direction === 'achat' ? '#991B1B' : '#065F46',
              }}
              title="Cliquer pour changer la direction"
            >
              {direction === 'achat' ? 'ACHAT' : 'VENTE'}
            </button>
            {/* Journal badge */}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
              {data.journal}
            </span>
            {/* TVA badge */}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
              TVA {data.tva_rate}%
            </span>
            {/* Secteur badge */}
            {data.secteur && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                {data.secteur}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info banners */}
      {data?.retenue_source?.applicable && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700">
            Retenue à la source {data.retenue_source.taux}% applicable — {data.retenue_source.note}
          </p>
        </div>
      )}

      {isAutoEntrepreneur && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
          <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-blue-700">
            Client auto-entrepreneur — vérifier assujettissement TVA (CA &lt; seuils légaux)
          </p>
        </div>
      )}

      {isExonere && !isAutoEntrepreneur && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
          <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-blue-700">
            Secteur exonéré de TVA — pas de TVA à facturer
          </p>
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="text-blue-500 animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-red-700">{error}</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          {/* Accounts table */}
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['SENS', 'COMPTE', 'LIBELLÉ', 'TYPE', 'MONTANT', 'ACTION'].map(col => (
                    <th key={col} style={{
                      padding: '8px 10px', textAlign: 'left',
                      fontSize: 10, fontWeight: 600, color: '#6B7280',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: '1px solid #E5E7EB',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const colors = TYPE_COLORS[row.type] ?? TYPE_COLORS.tiers;
                  const sensInfo = SENS_LABELS[row.sens] ?? SENS_LABELS.debit;
                  const isValidated = row.state === 'validated';
                  const isRejected  = row.state === 'rejected';
                  return (
                    <tr
                      key={`${row.code}-${idx}`}
                      style={{
                        borderBottom: idx < rows.length - 1 ? '1px solid #F3F4F6' : 'none',
                        background: isRejected ? '#FAFAFA' : '#fff',
                        opacity: isRejected ? 0.45 : 1,
                      }}
                    >
                      {/* SENS */}
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: row.sens === 'debit' ? '#DBEAFE' : '#D1FAE5',
                          color: sensInfo.color,
                          letterSpacing: '0.03em',
                        }}>
                          {sensInfo.label}
                        </span>
                      </td>
                      {/* COMPTE */}
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#111827' }}>
                        {row.code}
                      </td>
                      {/* LIBELLÉ */}
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151', maxWidth: 220 }}>
                        {row.libelle}
                        {row.obligatoire && (
                          <span style={{ fontSize: 9, color: '#DC2626', marginLeft: 4, fontWeight: 600 }}>*</span>
                        )}
                      </td>
                      {/* TYPE */}
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                          background: colors.bg, color: colors.text,
                        }}>
                          {TYPE_LABELS[row.type] ?? row.type}
                        </span>
                      </td>
                      {/* MONTANT */}
                      <td style={{ padding: '8px 10px' }}>
                        {isValidated ? (
                          <input
                            type="number"
                            step="0.01"
                            value={row.editedAmount}
                            onChange={e => updateAmount(idx, e.target.value)}
                            className={INPUT_CLS}
                            style={{ width: 110 }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                            {formatAmount(row.montant)}
                          </span>
                        )}
                      </td>
                      {/* ACTION */}
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => setRows(prev => prev.map((r, i) => i === idx ? { ...r, state: 'validated' } : r))}
                            title="Valider"
                            style={{
                              height: 26, width: 26, borderRadius: 6, border: 'none',
                              background: isValidated ? '#DCFCE7' : '#F3F4F6',
                              color: isValidated ? '#16A34A' : '#9CA3AF',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setRows(prev => prev.map((r, i) => i === idx ? { ...r, state: 'rejected' } : r))}
                            title="Rejeter"
                            style={{
                              height: 26, width: 26, borderRadius: 6, border: 'none',
                              background: isRejected ? '#FEE2E2' : '#F3F4F6',
                              color: isRejected ? '#DC2626' : '#9CA3AF',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Balance check */}
          <div className="mt-3 flex items-center gap-2">
            {isBalanced ? (
              <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 font-medium">
                <CheckCircle2 size={13} />
                Écriture équilibrée
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[12px] text-red-600 font-medium">
                <X size={13} />
                Déséquilibre : {formatAmount(Math.abs(totalDebit - totalCredit))}
              </div>
            )}
            <span className="text-[11px] text-gray-400 ml-2">
              Débit: {formatAmount(totalDebit)} | Crédit: {formatAmount(totalCredit)}
            </span>
          </div>

          {/* Add custom account */}
          <div className="mt-3">
            <button
              onClick={() => setShowAdd(v => !v)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {showAdd ? <ChevronUp size={13} /> : <Plus size={13} />}
              {showAdd ? 'Annuler' : 'Ajouter un compte'}
            </button>

            {showAdd && (
              <div className="mt-2 flex flex-wrap items-end gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1 uppercase">Code</p>
                  <input
                    value={addCode}
                    onChange={e => setAddCode(e.target.value)}
                    placeholder="6141"
                    className={INPUT_CLS}
                    style={{ width: 72 }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1 uppercase">Libellé</p>
                  <input
                    value={addLibelle}
                    onChange={e => setAddLibelle(e.target.value)}
                    placeholder="Libellé du compte"
                    className={INPUT_CLS}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1 uppercase">Type</p>
                  <select value={addType} onChange={e => setAddType(e.target.value)} className={INPUT_CLS}>
                    <option value="charge">Charge</option>
                    <option value="produit">Produit</option>
                    <option value="tva">TVA</option>
                    <option value="tiers">Tiers</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1 uppercase">Sens</p>
                  <select value={addSens} onChange={e => setAddSens(e.target.value)} className={INPUT_CLS}>
                    <option value="debit">Débit</option>
                    <option value="credit">Crédit</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1 uppercase">Montant</p>
                  <input
                    type="number"
                    step="0.01"
                    value={addMontant}
                    onChange={e => setAddMontant(e.target.value)}
                    placeholder="0.00"
                    className={INPUT_CLS}
                    style={{ width: 90 }}
                  />
                </div>
                <button
                  onClick={addCustomAccount}
                  disabled={!addCode.trim() || !addLibelle.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                    text-white text-[12px] font-medium rounded-lg transition-colors"
                >
                  <Plus size={12} />
                  Ajouter
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {error && !saved && (
              <p className="text-[12px] text-red-600">{error}</p>
            )}
            {exportErr && (
              <p className="text-[12px] text-red-600">{exportErr}</p>
            )}

            {saved ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-[13px] text-emerald-600 font-medium py-2">
                  <CheckCircle2 size={14} />
                  Imputation validée avec succès
                </div>
                <button
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5
                    bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60
                    text-white text-[13px] font-medium rounded-lg transition-colors"
                >
                  {exporting ? (
                    <><Loader2 size={14} className="animate-spin" /> Téléchargement…</>
                  ) : (
                    <>Télécharger le journal Excel</>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={fetchSuggestions}
                  className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
                  title="Réinitialiser les suggestions"
                >
                  <RefreshCw size={12} />
                  Réinitialiser
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !isBalanced}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
                    disabled:opacity-60 text-white text-[13px] font-medium rounded-lg transition-colors"
                  title={!isBalanced ? "L'écriture doit être équilibrée pour valider" : undefined}
                >
                  {saving ? (
                    <><Loader2 size={13} className="animate-spin" /> Enregistrement…</>
                  ) : (
                    <><CheckCircle2 size={13} /> Valider l'imputation</>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
