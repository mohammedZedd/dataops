import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, User, Settings, LogOut, X } from 'lucide-react';
import apiClient from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { soundService } from '../../utils/soundService';
import type { User as UserType } from '../../types';

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

function getUserDisplayName(user: UserType): string {
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return full || user.email;
}

function getUserInitials(user: UserType): string {
  const fn = user.first_name?.trim() ?? '';
  const ln = user.last_name?.trim() ?? '';
  if (fn || ln) return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();
  const prefix = user.email.split('@')[0] ?? '';
  return prefix.slice(0, 2).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  admin:      'Administrateur',
  accountant: 'Comptable',
  client:     'Client',
};

// ─── Composant ────────────────────────────────────────────────────────────────

export function TopNavbar() {
  const { title, subtitle } = usePageMeta();
  const { user, logout }    = useAuth();
  const navigate            = useNavigate();

  const [open, setOpen] = useState(false);
  const prevUnread = useRef(-1);
  const dropRef         = useRef<HTMLDivElement>(null);

  // Notifications
  const [notifs, setNotifs] = useState<{ id: string; type: string; title: string; message: string; link: string | null; is_read: boolean; created_at: string }[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/notifications');
      setNotifs(data.notifications ?? []);
      const newUnread = data.unread_count ?? 0;
      if (prevUnread.current === -1) {
        // First load: queue sound for first click if there are unread
        if (newUnread > 0) {
          const play = () => { soundService.playNotification(); document.removeEventListener('click', play); };
          document.addEventListener('click', play);
        }
      } else if (newUnread > prevUnread.current) {
        soundService.playNotification();
      }
      prevUnread.current = newUnread;
      setUnread(newUnread);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchNotifs(); const t = setInterval(fetchNotifs, 15000); return () => clearInterval(t); }, [fetchNotifs]);

  useEffect(() => {
    function h(e: MouseEvent) { if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  async function markRead(id: string) { await apiClient.patch(`/notifications/${id}/read`); setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: true } : n)); setUnread(p => Math.max(0, p - 1)); }
  async function markAllRead() { await apiClient.patch('/notifications/read-all'); setNotifs(p => p.map(n => ({ ...n, is_read: true }))); setUnread(0); }
  async function deleteNotif(id: string) { const n = notifs.find(x => x.id === id); await apiClient.delete(`/notifications/${id}`); setNotifs(p => p.filter(x => x.id !== id)); if (n && !n.is_read) setUnread(p => Math.max(0, p - 1)); }

  function timeAgo(d: string) { const ms = Date.now() - new Date(d).getTime(); const m = Math.floor(ms / 60000); if (m < 1) return "À l'instant"; if (m < 60) return `Il y a ${m} min`; const h = Math.floor(ms / 3600000); if (h < 24) return `Il y a ${h}h`; const days = Math.floor(ms / 86400000); if (days === 1) return 'Hier'; if (days < 7) return `Il y a ${days}j`; return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate('/login');
  }

  return (
    <header
      className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6"
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
            <Search size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />
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
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button onClick={() => setBellOpen(v => !v)} className="relative h-8 w-8 rounded-lg hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
              <Bell size={15} />
              {unread > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 14, height: 14, background: '#EF4444', color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', lineHeight: 1 }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'hidden', maxHeight: 440 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Notifications</span>
                    {unread > 0 && <span style={{ background: '#EF4444', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{unread}</span>}
                  </div>
                  {unread > 0 && <button onClick={markAllRead} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}>Tout lire</button>}
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 360 }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                      <p style={{ fontWeight: 500, color: '#374151' }}>Aucune notification</p>
                    </div>
                  ) : notifs.map(n => (
                    <div key={n.id} onClick={() => { markRead(n.id); if (n.link) { navigate(n.link); setBellOpen(false); } }}
                      style={{ padding: '12px 18px', borderBottom: '1px solid #F9FAFB', cursor: n.link ? 'pointer' : 'default', background: n.is_read ? '#fff' : '#F0F9FF', display: 'flex', gap: 10, alignItems: 'flex-start', transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.is_read ? '#fff' : '#F0F9FF'; }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: n.type === 'document_uploaded' ? '#EFF6FF' : n.type === 'invoice_validated' ? '#F0FDF4' : n.type === 'client_joined' ? '#F5F3FF' : '#F9FAFB' }}>
                        {n.type === 'document_uploaded' ? '📄' : n.type === 'invoice_validated' ? '✅' : n.type === 'invoice_rejected' ? '❌' : n.type === 'client_joined' ? '👤' : '🔔'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 1 }}>{n.title}</p>
                        <p style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, marginTop: 4 }} />}
                      <button onClick={e => { e.stopPropagation(); deleteNotif(n.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: 12, flexShrink: 0, padding: 2 }}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar + dropdown */}
          <div ref={dropRef} className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg transition-colors
                ${open ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
                flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold">
                {user ? getUserInitials(user) : '?'}
              </div>
              <span className="hidden md:block text-[12px] font-medium text-gray-700">
                {user ? getUserDisplayName(user) : ''}
              </span>
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute top-12 right-0 w-56 bg-white border border-gray-200
                rounded-xl shadow-lg z-50 overflow-hidden">

                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
                      flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold">
                      {user ? getUserInitials(user) : '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">
                        {user ? getUserDisplayName(user) : '—'}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
                    </div>
                  </div>
                  {user?.role && (
                    <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full
                      text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  )}
                </div>

                {/* Items */}
                <div className="py-1">
                  <button
                    disabled
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                      text-gray-300 cursor-not-allowed"
                  >
                    <User size={16} />
                    Mon profil
                  </button>

                  <button
                    onClick={() => { setOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                      text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={16} />
                    Paramètres
                  </button>
                </div>

                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                      text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Déconnexion
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
