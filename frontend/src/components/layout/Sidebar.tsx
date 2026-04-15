import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings,
  HelpCircle,
  FileText,
  BookOpen,
  LogOut,
  Upload,
  Inbox,
  History,
  MessageSquare,
  UserCircle,
  CheckSquare,
  StickyNote,
  Users2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import apiClient from '../../api/axios';
import type { User } from '../../types';
import type { ClientDocument } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
  badge?: number;
}

const NAV_ADMIN: { section: string; items: NavItem[] }[] = [
  {
    section: 'Gestion',
    items: [
      { to: '/', label: 'Tableau de bord', icon: <LayoutDashboard size={16} />, end: true },
      { to: '/clients', label: 'Clients', icon: <Users size={16} /> },
      { to: '/tasks', label: 'Tâches', icon: <CheckSquare size={16} /> },
      { to: '/notes', label: 'Notes', icon: <StickyNote size={16} /> },
      { to: '/documents', label: 'Documents', icon: <FileText size={16} /> },
      { to: '/accounting-entry', label: 'Création comptable', icon: <BookOpen size={16} /> },
      { to: '/chat', label: 'Messages', icon: <MessageSquare size={16} /> },
    ],
  },
  {
    section: 'Compte',
    items: [
      { to: '/equipe', label: 'Équipe', icon: <Users2 size={16} /> },
      { to: '/invitations', label: 'Invitations', icon: <Users size={16} /> },
      { to: '/profile', label: 'Mon profil', icon: <UserCircle size={16} /> },
      { to: '/settings', label: 'Paramètres', icon: <Settings size={16} /> },
      { to: '/help', label: 'Aide', icon: <HelpCircle size={16} /> },
    ],
  },
];

function buildNavClient(receivedBadge: number): { section: string; items: NavItem[] }[] {
  return [
    {
      section: 'Espace client',
      items: [
        { to: '/client/dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={16} />, end: true },
        { to: '/client/documents', label: 'Mes documents', icon: <Upload size={16} />, end: true },
        { to: '/client/documents/received', label: 'Documents reçus', icon: <Inbox size={16} />, badge: receivedBadge },
        { to: '/client/messages', label: 'Messages', icon: <MessageSquare size={16} /> },
        { to: '/client/historique', label: 'Historique', icon: <History size={16} /> },
      ],
    },
    {
      section: 'Compte',
      items: [
        { to: '/client/profile', label: 'Mon profil', icon: <UserCircle size={16} /> },
      ],
    },
  ];
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

export function Sidebar() {
  const { user, logout } = useAuth();
  const { isOpen, close } = useSidebar();
  const navigate = useNavigate();
  const [receivedBadge, setReceivedBadge] = useState(0);

  // Fetch badge count for received docs (client only)
  useEffect(() => {
    if (user?.role !== 'client') return;
    const fetch = async () => {
      try {
        const { data } = await apiClient.get<ClientDocument[]>('/documents/my');
        const count = data.filter(d => d.source === 'cabinet' && d.is_new).length;
        setReceivedBadge(count);
      } catch { /* ignore */ }
    };
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [user?.role]);

  const nav = user?.role === 'client' ? buildNavClient(receivedBadge) : NAV_ADMIN;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-100
        flex flex-col z-40
        transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
      style={{ boxShadow: '1px 0 0 0 #f3f4f6' }}
    >
      {/* Logo + bouton fermeture (mobile uniquement) */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-[13px]">C</span>
          </div>
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">ComptaFlow</span>
        </div>
        <button
          onClick={close}
          className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          aria-label="Fermer le menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {nav.map(({ section, items }) => (
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
                    onClick={close}
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
                        <span className="flex-1">{item.label}</span>
                        {item.badge != null && item.badge > 0 && (
                          <span
                            className="ml-auto flex-shrink-0 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                            style={{ background: '#7C3AED', color: '#fff' }}
                          >
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer user */}
      <div className="px-3 py-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
            flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold">
            {user ? getUserInitials(user) : '?'}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[12px] font-semibold text-gray-800 truncate">
              {user ? getUserDisplayName(user) : '—'}
            </p>
            <p className="text-[11px] text-gray-400 truncate capitalize">
              {user?.role ?? ''}
            </p>
          </div>
          <LogOut size={16} className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors" />
        </button>
      </div>
    </aside>
  );
}
