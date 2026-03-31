import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-[48px] font-bold text-gray-200 leading-none">404</p>
      <p className="text-[15px] font-semibold text-gray-700 mt-3">Page introuvable</p>
      <p className="text-[13px] text-gray-400 mt-1">Cette page n'existe pas ou a été déplacée.</p>
      <Link to="/" className="mt-5 text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
        ← Retour au tableau de bord
      </Link>
    </div>
  );
}
