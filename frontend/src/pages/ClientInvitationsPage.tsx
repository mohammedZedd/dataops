import { useCallback, useEffect, useState } from 'react';
import { Mail, UserPlus, Clock, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import {
  getClientTeamInvitations,
  resendClientTeamInvitation,
  cancelClientTeamInvitation,
} from '../api/invitations';
import type { Invitation } from '../types';
import InviteTeamMemberModal from '../features/invitations/InviteTeamMemberModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7)  return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return fmtDate(iso);
}

function fmtExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'expirée';
  const days = Math.ceil(diff / 86400000);
  if (days === 1) return 'expire demain';
  if (days < 7)  return `expire dans ${days} j`;
  return `expire le ${fmtDate(iso)}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

type InvStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

const STATUS_CFG: Record<InvStatus, { bg: string; color: string; border: string; label: string; Icon: typeof Clock }> = {
  pending:   { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', label: 'En attente', Icon: Clock       },
  accepted:  { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Acceptée',   Icon: CheckCircle2 },
  expired:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Expirée',    Icon: XCircle      },
  cancelled: { bg: '#F9FAFB', color: '#9CA3AF', border: '#E5E7EB', label: 'Annulée',    Icon: XCircle      },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as InvStatus] ?? STATUS_CFG.cancelled;
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ─── Filter pill group ────────────────────────────────────────────────────────

type Tab = 'all' | 'pending' | 'accepted' | 'expired';

const TAB_CFG: { k: Tab; label: string; activeColor: string }[] = [
  { k: 'all',      label: 'Toutes',     activeColor: '#6366F1' },
  { k: 'pending',  label: 'En attente', activeColor: '#D97706' },
  { k: 'accepted', label: 'Acceptées',  activeColor: '#16A34A' },
  { k: 'expired',  label: 'Expirées',   activeColor: '#DC2626' },
];

function FilterTabs({ active, onChange, counts }: {
  active: Tab;
  onChange: (t: Tab) => void;
  counts: Record<Tab, number>;
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {TAB_CFG.map(t => {
        const isActive = active === t.k;
        return (
          <button
            key={t.k}
            onClick={() => onChange(t.k)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? t.activeColor : '#F3F4F6',
              color: isActive ? '#fff' : '#6B7280',
            }}
          >
            {t.label}
            {counts[t.k] > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                background: isActive ? 'rgba(255,255,255,0.25)' : '#E5E7EB',
                color: isActive ? '#fff' : '#6B7280',
              }}>
                {counts[t.k]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [activeTab,   setActiveTab]   = useState<Tab>('all');

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClientTeamInvitations();
      setInvitations(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  async function handleResend(id: string) {
    setActioningId(id);
    try {
      await resendClientTeamInvitation(id);
    } catch { /* ignore */ }
    finally { setActioningId(null); }
  }

  async function handleCancel(id: string) {
    if (!confirm('Annuler cette invitation ?')) return;
    setActioningId(id);
    try {
      await cancelClientTeamInvitation(id);
      setInvitations(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i));
    } catch { /* ignore */ }
    finally { setActioningId(null); }
  }

  function handleInvited(_inv: Invitation) {
    setInviteOpen(false);
    fetchInvitations();
  }

  const counts: Record<Tab, number> = {
    all:      invitations.length,
    pending:  invitations.filter(i => i.status === 'pending').length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    expired:  invitations.filter(i => i.status === 'expired').length,
  };

  const visible = activeTab === 'all'
    ? invitations
    : invitations.filter(i => i.status === activeTab);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mail size={22} /> Invitations
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
            Invitations envoyées aux membres de votre équipe
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: '#6366F1', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}
        >
          <UserPlus size={16} /> Inviter un membre
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total',       value: counts.all,      bg: '#F9FAFB', border: '#E5E7EB', color: '#374151' },
          { label: 'En attente',  value: counts.pending,  bg: '#FFFBEB', border: '#FDE68A', color: '#D97706' },
          { label: 'Acceptées',   value: counts.accepted, bg: '#F0FDF4', border: '#BBF7D0', color: '#16A34A' },
          { label: 'Expirées',    value: counts.expired,  bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: s.color, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres + tableau */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <FilterTabs active={activeTab} onChange={setActiveTab} counts={counts} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden' }}>
        {/* En-tête tableau */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.8fr 1fr 1fr 1fr 160px',
          padding: '13px 24px', background: '#0F172A',
          color: '#94A3B8', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          <div>Invité</div>
          <div>Email</div>
          <div>Statut</div>
          <div>Envoyée</div>
          <div>Expiration</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader2 size={22} className="animate-spin" color="#6366F1" />
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9CA3AF' }}>
            <div style={{ height: 52, width: 52, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Mail size={22} color="#9CA3AF" />
            </div>
            <div style={{ fontWeight: 500, color: '#374151', fontSize: 14 }}>
              {activeTab === 'all' ? 'Aucune invitation envoyée' : `Aucune invitation ${TAB_CFG.find(t => t.k === activeTab)?.label.toLowerCase()}`}
            </div>
            {activeTab === 'all' && (
              <button
                onClick={() => setInviteOpen(true)}
                style={{ marginTop: 14, background: '#6366F1', color: 'white', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Envoyer la première invitation
              </button>
            )}
          </div>
        ) : visible.map((inv, i) => (
          <div
            key={inv.id}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 1.8fr 1fr 1fr 1fr 160px',
              padding: '14px 24px',
              borderBottom: i < visible.length - 1 ? '1px solid #F3F4F6' : 'none',
              alignItems: 'center',
              borderLeft: `3px solid ${
                inv.status === 'accepted' ? '#10B981'
                : inv.status === 'pending' ? '#F59E0B'
                : '#E5E7EB'
              }`,
            }}
          >
            {/* Invité */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: inv.status === 'accepted' ? '#D1FAE5'
                  : inv.status === 'pending' ? '#FEF3C7'
                  : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {inv.status === 'accepted'
                  ? <CheckCircle2 size={15} color="#10B981" />
                  : inv.status === 'pending'
                  ? <Clock size={15} color="#D97706" />
                  : <XCircle size={15} color="#9CA3AF" />
                }
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  {inv.first_name} {inv.last_name}
                </div>
              </div>
            </div>

            {/* Email */}
            <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {inv.email}
            </div>

            {/* Statut */}
            <div><StatusBadge status={inv.status} /></div>

            {/* Envoyée */}
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>{fmtRelative(inv.created_at)}</div>

            {/* Expiration */}
            <div style={{ fontSize: 12, color: inv.status === 'pending' ? '#D97706' : '#9CA3AF' }}>
              {inv.status === 'pending' ? fmtExpiry(inv.expires_at) : '—'}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              {inv.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleResend(inv.id)}
                    disabled={actioningId === inv.id}
                    title="Renvoyer l'invitation"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                      background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                      borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                      opacity: actioningId === inv.id ? 0.5 : 1,
                    }}
                  >
                    <RefreshCw size={11} /> Renvoyer
                  </button>
                  <button
                    onClick={() => handleCancel(inv.id)}
                    disabled={actioningId === inv.id}
                    title="Annuler l'invitation"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                      background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                      borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                      opacity: actioningId === inv.id ? 0.5 : 1,
                    }}
                  >
                    <XCircle size={11} /> Annuler
                  </button>
                </>
              )}
              {inv.status === 'accepted' && inv.accepted_at && (
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  Acceptée le {fmtDate(inv.accepted_at)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {inviteOpen && (
        <InviteTeamMemberModal
          onClose={() => setInviteOpen(false)}
          onCreated={handleInvited}
        />
      )}
    </div>
  );
}
