import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  FileText,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Gestion',
    items: [
      { to: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={16} />, end: true },
      { to: '/clients', label: 'Clients', icon: <Users size={16} /> },
      { to: '/documents', label: 'Documents', icon: <FileText size={16} /> },
      { to: '/accounting-entry', label: 'Création comptable', icon: <BookOpen size={16} /> },
    ],
  },
  {
    section: 'Compte',
    items: [
      { to: '/invitations', label: 'Invitations', icon: <Users size={16} /> },
      { to: '/settings', label: 'Paramètres', icon: <Settings size={16} /> },
      { to: '/help', label: 'Aide', icon: <HelpCircle size={16} /> },
    ],
  },
];

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

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-100 flex flex-col z-20"
      style={{ boxShadow: '1px 0 0 0 #f3f4f6' }}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-[13px]">C</span>
          </div>
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">ComptaFlow</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {section}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                          {item.icon}
                        </span>
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer user — données réelles depuis AuthContext */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
            flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold">
            {user ? getUserInitials(user) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-800 truncate">
              {user ? getUserDisplayName(user) : '—'}
            </p>
            <p className="text-[11px] text-gray-400 truncate capitalize">
              {user?.role ?? ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="text-gray-300 group-hover:text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
