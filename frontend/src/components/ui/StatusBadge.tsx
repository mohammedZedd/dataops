import type { InvoiceStatus, DocumentStatus } from '../../types';

type Status = InvoiceStatus | DocumentStatus;

const CONFIG: Record<Status, { label: string; classes: string }> = {
  // Invoice statuses
  to_review: { label: 'À vérifier', classes: 'bg-amber-50 text-amber-700'   },
  validated: { label: 'Validée',    classes: 'bg-emerald-50 text-emerald-700' },
  rejected:  { label: 'Rejetée',   classes: 'bg-red-50 text-red-600'        },
  // Document statuses
  uploaded:   { label: 'Déposé',    classes: 'bg-gray-100 text-gray-600'     },
  processing: { label: 'En cours',  classes: 'bg-blue-50 text-blue-700'      },
  processed:  { label: 'Traité',    classes: 'bg-blue-50 text-blue-700'      },
  error:      { label: 'Erreur',    classes: 'bg-red-50 text-red-600'        },
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, classes } = CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium ${classes}`}>
      {label}
    </span>
  );
}
