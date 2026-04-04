import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, Check, X, Plus, ChevronDown, ChevronUp,
  BookOpen, Loader2, CheckCircle2,
} from 'lucide-react';
import { getSuggestedAccounts, saveInvoiceAccounts } from '../../api/invoices';
import type { AccountEntry, AccountSuggestion, InvoiceDirection, SuggestedAccountsResponse } from '../../types';

interface Props {
  invoiceId: string;
  secteurActivite?: string | null;
  totalAmount: number;
  vatAmount: number;
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

function formatAmount(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

function getRowAmount(row: AccountRow): number | null {
  if (row.montant_ht != null) return row.montant_ht;
  if (row.montant_tva != null) return row.montant_tva;
  if (row.montant_ttc != null) return row.montant_ttc;
  return null;
}

export function AccountingSection({ invoiceId, secteurActivite, totalAmount, vatAmount, onSaved }: Props) {
  const [data,      setData]      = useState<SuggestedAccountsResponse | null>(null);
  const [rows,      setRows]      = useState<AccountRow[]>([]);
  const [direction, setDirection] = useState<InvoiceDirection>('achat');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  // Custom account add form
  const [showAdd,    setShowAdd]    = useState(false);
  const [addCode,    setAddCode]    = useState('');
  const [addLibelle, setAddLibelle] = useState('');
  const [addMontant, setAddMontant] = useState('');
  const [addType,    setAddType]    = useState('charge');

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
          editedAmount: String(
            acc.montant_ht ?? acc.montant_tva ?? acc.montant_ttc ?? ''
          ),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  function toggleRow(index: number) {
    setRows(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const nextState: RowState = r.state === 'validated' ? 'rejected'
        : r.state === 'rejected' ? 'pending'
        : 'validated';
      return { ...r, state: nextState };
    }));
  }

  function updateAmount(index: number, value: string) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, editedAmount: value } : r));
  }

  function addCustomAccount() {
    if (!addCode.trim() || !addLibelle.trim()) return;
    const montant = parseFloat(addMontant) || 0;
    const newRow: AccountRow = {
      code: addCode.trim(),
      libelle: addLibelle.trim(),
      type: addType as AccountRow['type'],
      is_primary: false,
      state: 'validated',
      editedAmount: addMontant,
      montant_ht:  addType === 'charge' || addType === 'produit' ? montant : undefined,
      montant_tva: addType === 'tva'    ? montant : undefined,
      montant_ttc: addType === 'tiers'  ? montant : undefined,
    };
    setRows(prev => [...prev, newRow]);
    setAddCode(''); setAddLibelle(''); setAddMontant(''); setAddType('charge');
    setShowAdd(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const accounts: AccountEntry[] = rows
        .filter(r => r.state === 'validated')
        .map(r => {
          const amt = parseFloat(r.editedAmount) || getRowAmount(r) || 0;
          return {
            code: r.code,
            libelle: r.libelle,
            type: r.type,
            montant_ht:  r.type === 'charge' || r.type === 'produit' ? amt : null,
            montant_tva: r.type === 'tva'    ? amt : null,
            montant_ttc: r.type === 'tiers'  ? amt : null,
            validated: true,
          };
        });
      await saveInvoiceAccounts(invoiceId, accounts, direction);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

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
          <div className="flex items-center gap-2">
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
              {direction === 'achat' ? '🔴 ACHAT' : '🟢 VENTE'}
            </button>
            {/* TVA badge */}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
              TVA {data.tva_rate}%
            </span>
          </div>
        )}
      </div>

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
                  {['COMPTE', 'LIBELLÉ', 'TYPE', 'MONTANT', 'ACTION'].map(col => (
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
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#111827' }}>
                        {row.code}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151', maxWidth: 200 }}>
                        {row.libelle}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                          background: colors.bg, color: colors.text,
                        }}>
                          {TYPE_LABELS[row.type] ?? row.type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {isValidated ? (
                          <input
                            type="number"
                            step="0.01"
                            value={row.editedAmount}
                            onChange={e => updateAmount(idx, e.target.value)}
                            className={INPUT_CLS}
                            style={{ width: 100 }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                            {formatAmount(getRowAmount(row))}
                          </span>
                        )}
                      </td>
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
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            {saved && (
              <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 font-medium">
                <CheckCircle2 size={13} />
                Imputation enregistrée
              </div>
            )}
            {!saved && error && (
              <p className="text-[12px] text-red-600">{error}</p>
            )}
            {!saved && !error && <span />}
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
                disabled:opacity-60 text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              {saving ? (
                <><Loader2 size={13} className="animate-spin" /> Enregistrement…</>
              ) : (
                <><CheckCircle2 size={13} /> Valider l'imputation</>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
