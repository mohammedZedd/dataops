import { BookOpen } from 'lucide-react';

export default function AccountingEntryPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
          Comptabilité
        </p>
        <h1 className="text-[20px] font-bold text-gray-900">Création comptable</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Préparation des écritures comptables
        </p>
      </div>

      {/* Contenu vide */}
      <div
        className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-20"
        style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
      >
        <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <BookOpen size={24} className="text-blue-500" />
        </div>
        <p className="text-[14px] font-semibold text-gray-700">
          Module en cours de développement
        </p>
        <p className="text-[13px] text-gray-400 mt-1">
          Les écritures comptables seront disponibles prochainement.
        </p>
      </div>
    </div>
  );
}
