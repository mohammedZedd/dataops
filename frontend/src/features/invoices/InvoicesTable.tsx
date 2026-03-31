import { Eye } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { Invoice } from '../../types';

interface Props {
  invoices: Invoice[];
  onRowClick: (invoice: Invoice) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatAmount(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function InvoicesTable({ invoices, onRowClick }: Props) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-100">
          {['Date', 'Fournisseur', 'N° Facture', 'Montant TTC', 'Statut', ''].map(h => (
            <th
              key={h}
              className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {invoices.map(inv => (
          <tr
            key={inv.id}
            className="hover:bg-gray-50 transition-colors group"
          >
            <td className="px-4 py-3.5 text-[13px] text-gray-600 tabular-nums whitespace-nowrap">
              {formatDate(inv.date)}
            </td>
            <td className="px-4 py-3.5 text-[13px] font-medium text-gray-800">
              {inv.supplierName}
            </td>
            <td className="px-4 py-3.5 text-[13px] text-gray-500 font-mono">
              {inv.invoiceNumber}
            </td>
            <td className="px-4 py-3.5 text-[13px] font-semibold text-gray-800 tabular-nums whitespace-nowrap">
              {formatAmount(inv.totalAmount)}
            </td>
            <td className="px-4 py-3.5">
              <StatusBadge status={inv.status} />
            </td>
            <td className="px-4 py-3.5 text-right">
              <button
                onClick={() => onRowClick(inv)}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600
                  hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye size={13} />
                Voir
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
