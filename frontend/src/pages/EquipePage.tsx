import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users2, Plus, Search, Loader2 } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import InviteAccountantModal from '../features/invitations/InviteAccountantModal';
import type { Invitation } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  role: string;
  role_label: string;
  is_active: boolean;
  created_at: string;
  last_seen: string | null;
  clients_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRelative(iso: string | null): { label: string; dot: string } {
  if (!iso) return { label: '—', dot: '#D1D5DB' };
  const d   = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const diffD = (Date.now() - d.getTime()) / 86400000;
  if (diffD < 1)  return { label: "Aujourd'hui",                          dot: '#22C55E' };
  if (diffD < 2)  return { label: 'Hier',                                 dot: '#22C55E' };
  if (diffD < 7)  return { label: `Il y a ${Math.floor(diffD)} j`,        dot: '#F59E0B' };
  if (diffD < 30) return { label: `Il y a ${Math.floor(diffD / 7)} sem.`, dot: '#9CA3AF' };
  return { label: d.toLocaleDateString('fr-FR'), dot: '#9CA3AF' };
}

// ─── PillGroup ────────────────────────────────────────────────────────────────

function PillGroup({ options, value, onChange }: {
  options: { k: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
      {options.map(o => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 13,
            fontWeight: value === o.k ? 500 : 400,
            background: value === o.k ? '#fff' : 'transparent',
            color:      value === o.k ? '#111827' : '#6B7280',
            boxShadow:  value === o.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipePage() {
  const [members,      setMembers]      = useState<Member[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<'all' | 'admin' | 'accountant'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [inviteOpen,   setInviteOpen]   = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/team');
      setMembers(data.members ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => members.filter(m => {
    if (statusFilter === 'active'   && !m.is_active) return false;
    if (statusFilter === 'inactive' &&  m.is_active) return false;
    if (roleFilter !== 'all' && m.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!m.name.toLowerCase().includes(s) && !m.email.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [members, statusFilter, roleFilter, search]);

  const totalActive = members.filter(m => m.is_active).length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users2 size={22} /> Gestion de l'équipe
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
            {totalActive} membre{totalActive !== 1 ? 's' : ''} actif{totalActive !== 1 ? 's' : ''} · {members.length} au total
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: '#3B82F6', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}
        >
          <Plus size={16} /> Inviter un comptable
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            style={{ width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px 0 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <PillGroup
          options={[{ k: 'all', l: 'Tous' }, { k: 'active', l: 'Actifs' }, { k: 'inactive', l: 'Inactifs' }]}
          value={statusFilter}
          onChange={v => setStatusFilter(v as typeof statusFilter)}
        />
        <PillGroup
          options={[{ k: 'all', l: 'Tous rôles' }, { k: 'admin', l: 'Admins' }, { k: 'accountant', l: 'Comptables' }]}
          value={roleFilter}
          onChange={v => setRoleFilter(v as typeof roleFilter)}
        />
      </div>

      {/* Tableau */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader2 size={24} className="animate-spin" color="#3B82F6" />
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden' }}>

          {/* En-tête colonnes */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 80px',
            padding: '13px 24px', background: '#0F172A',
            color: '#94A3B8', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <div>Membre</div>
            <div>Email</div>
            <div>Rôle</div>
            <div style={{ textAlign: 'center' }}>Clients</div>
            <div style={{ textAlign: 'center' }}>Statut</div>
            <div style={{ textAlign: 'right' }}>Activité</div>
          </div>

          {/* État vide */}
          {filtered.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ height: 56, width: 56, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Users2 size={24} color="#9CA3AF" />
              </div>
              <div style={{ fontWeight: 500, color: '#374151', fontSize: 15 }}>Aucun membre trouvé</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Modifiez vos filtres ou invitez un nouveau membre</div>
            </div>
          )}

          {/* Lignes — clic → page détail */}
          {filtered.map((m, i) => {
            const isAdmin = m.role === 'admin';
            const rel     = fmtRelative(m.last_seen);
            return (
              <div
                key={m.id}
                onClick={() => navigate(`/equipe/${m.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 80px',
                  padding: '14px 24px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none',
                  alignItems: 'center',
                  borderLeft: `3px solid ${isAdmin ? '#3B82F6' : '#10B981'}`,
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                {/* Membre */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: isAdmin
                      ? 'linear-gradient(135deg,#3B82F6,#1D4ED8)'
                      : 'linear-gradient(135deg,#10B981,#047857)',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {m.initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.first_name} {m.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      Depuis {fmtDate(m.created_at)}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div style={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </div>

                {/* Rôle */}
                <div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: isAdmin ? '#EFF6FF' : '#ECFDF5',
                    color:      isAdmin ? '#1D4ED8' : '#047857',
                    border: `1px solid ${isAdmin ? '#BFDBFE' : '#A7F3D0'}`,
                  }}>
                    {isAdmin ? 'Admin' : 'Comptable'}
                  </span>
                </div>

                {/* Clients */}
                <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {m.clients_count}
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>
                    client{m.clients_count !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Statut */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                    background: m.is_active ? '#F0FDF4' : '#F9FAFB',
                    color:      m.is_active ? '#16A34A' : '#9CA3AF',
                    border: `1px solid ${m.is_active ? '#BBF7D0' : '#E5E7EB'}`,
                  }}>
                    {m.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                {/* Activité */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: rel.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{rel.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {inviteOpen && (
        <InviteAccountantModal
          companyName={user?.company_name}
          onClose={() => setInviteOpen(false)}
          onCreated={(_inv: Invitation) => { setInviteOpen(false); fetchAll(); }}
        />
      )}
    </div>
  );
}
