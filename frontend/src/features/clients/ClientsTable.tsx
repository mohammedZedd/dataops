import { AlertCircle, ChevronRight } from 'lucide-react';
import type { Client } from '../../types';

interface Props {
  clients: Client[];
  onRowClick: (client: Client) => void;
}

export function ClientsTable({ clients, onRowClick }: Props) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-100">
          {['Client', 'Documents', 'Statut', ''].map(h => (
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
        {clients.map(client => (
          <tr
            key={client.id}
            onClick={() => onRowClick(client)}
            className="hover:bg-gray-50 cursor-pointer transition-colors group"
          >
            {/* Nom */}
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-[13px] font-semibold text-blue-600">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-gray-800">{client.name}</p>
                  {client.siret && (
                    <p className="text-[11px] text-gray-400 font-mono">{client.siret}</p>
                  )}
                </div>
              </div>
            </td>

            {/* Documents */}
            <td className="px-4 py-3.5 text-[13px] text-gray-500 tabular-nums">
              {client.documentsCount}
            </td>

            {/* Statut */}
            <td className="px-4 py-3.5">
              {client.invoicesToReview > 0 ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  <AlertCircle size={11} />
                  {client.invoicesToReview} à vérifier
                </span>
              ) : (
                <span className="text-[12px] text-gray-400">À jour</span>
              )}
            </td>

            {/* Action */}
            <td className="px-4 py-3.5 text-right">
              <ChevronRight
                size={16}
                className="text-gray-300 group-hover:text-gray-500 inline transition-colors"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
