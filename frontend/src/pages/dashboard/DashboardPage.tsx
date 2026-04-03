import { useAuth } from '../../context/AuthContext';
import type { UserRole, User } from '../../types';

interface StatCardProps {
  emoji: string;
  title: string;
  value: string;
  subtitle: string;
}

function StatCard({ emoji, title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-2xl">{emoji}</div>
      <div className="mt-3 text-sm font-medium text-slate-700">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}

function roleMeta(role: UserRole) {
  switch (role) {
    case 'admin':
      return { label: 'Administrateur', className: 'bg-red-100 text-red-700' };
    case 'accountant':
      return { label: 'Comptable', className: 'bg-blue-100 text-blue-700' };
    case 'client':
      return { label: 'Client', className: 'bg-violet-100 text-violet-700' };
    default:
      return { label: role, className: 'bg-slate-100 text-slate-700' };
  }
}

type UserWithEmailVerified = User & { email_verified?: boolean };

export default function DashboardPage() {
  const { user } = useAuth();
  const currentUser = user as UserWithEmailVerified | null;

  if (!currentUser) return null;

  const roleInfo = roleMeta(currentUser.role);

  const allCards = [
    { key: 'clients', emoji: '📁', title: 'Clients', value: '—', subtitle: 'Total clients actifs' },
    { key: 'documents', emoji: '📄', title: 'Documents', value: '—', subtitle: 'Documents uploadés' },
    { key: 'invoices', emoji: '🧾', title: 'Factures à valider', value: '—', subtitle: 'En attente de validation' },
    { key: 'invitations', emoji: '✉️', title: 'Invitations', value: '—', subtitle: 'Invitations en attente' },
  ];

  const visibleCards =
    currentUser.role === 'admin'
      ? allCards
      : currentUser.role === 'accountant'
        ? allCards.filter((card) => card.key !== 'invitations')
        : allCards.filter((card) => card.key === 'documents' || card.key === 'invoices');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Bonjour {currentUser.first_name} 👋
        </h1>
        <p className="mt-2 text-slate-600">Bienvenue sur votre espace ComptaFlow</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex items-center gap-3">
            <span className="w-28 text-xs uppercase text-slate-500">Rôle</span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${roleInfo.className}`}>
              {roleInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-28 text-xs uppercase text-slate-500">Entreprise</span>
            <span className="font-medium text-slate-900">Company #{currentUser.company_id}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-28 text-xs uppercase text-slate-500">Email</span>
            <span className="font-medium text-slate-900">{currentUser.email}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-28 text-xs uppercase text-slate-500">Email vérifié</span>
            <span className={currentUser.email_verified === true ? 'text-emerald-600' : 'text-rose-600'}>
              {currentUser.email_verified === true ? '✓' : '✗'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {visibleCards.map((card) => (
          <StatCard
            key={card.key}
            emoji={card.emoji}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
          />
        ))}
      </div>
    </div>
  );
}
