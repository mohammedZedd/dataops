import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';

// ─── Titre dynamique selon la route ──────────────────────────────────────────

interface PageMeta {
  title: string;
  subtitle?: string;
}

function usePageMeta(): PageMeta {
  const { pathname } = useLocation();

  if (pathname === '/')
    return { title: 'Tableau de bord', subtitle: 'Vue d\'ensemble de l\'activité' };

  if (pathname === '/clients')
    return { title: 'Clients' };

  if (/^\/clients\/[^/]+\/invoices\/[^/]+/.test(pathname))
    return { title: 'Facture', subtitle: 'Détail et validation' };

  if (/^\/clients\/[^/]+/.test(pathname))
    return { title: 'Client', subtitle: 'Documents et factures' };

  if (pathname === '/documents')
    return { title: 'Documents' };

  if (pathname === '/accounting-entry')
    return { title: 'Création comptable', subtitle: 'Préparation des écritures comptables' };

  if (pathname === '/invitations')
    return { title: 'Invitations', subtitle: 'Gestion des accès' };

  if (pathname === '/settings')
    return { title: 'Paramètres' };

  if (pathname === '/help')
    return { title: 'Aide' };

  return { title: 'ComptaFlow' };
}

function getUserDisplayName(user: User): string {
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return full || user.email;
}

function getUserInitials(user: User): string {
  const fn = user.first_name?.trim() ?? '';
  const ln = user.last_name?.trim() ?? '';
  if (fn || ln) return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();
  const prefix = user.email.split('@')[0] ?? '';
  return prefix.slice(0, 2).toUpperCase();
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function TopNavbar() {
  const { title, subtitle } = usePageMeta();
  const { user } = useAuth();

  return (
    <header
      className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6"
      style={{ boxShadow: '0 1px 0 0 #f3f4f6' }}
    >
      <div className="flex items-center justify-between h-14">

        {/* Titre de page */}
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 leading-none">{title}</h2>
          {subtitle && (
            <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Recherche + actions */}
        <div className="flex items-center gap-3">

          {/* Barre de recherche */}
          <div className="relative hidden sm:flex items-center">
            <Search
              size={13}
              className="absolute left-2.5 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Rechercher un client, une facture…"
              className="w-56 pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200
                rounded-lg placeholder-gray-400 text-gray-700
                focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300
                transition-all focus:w-72"
            />
          </div>

          {/* Notifications */}
          <button className="relative h-8 w-8 rounded-lg hover:bg-gray-50 flex items-center
            justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <Bell size={15} />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-400" />
          </button>

          {/* Avatar utilisateur — données réelles depuis AuthContext */}
          <div className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
              flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold">
              {user ? getUserInitials(user) : '?'}
            </div>
            <span className="hidden md:block text-[12px] font-medium text-gray-700">
              {user ? getUserDisplayName(user) : ''}
            </span>
          </div>

        </div>
      </div>
    </header>
  );
}
