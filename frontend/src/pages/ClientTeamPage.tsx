import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Users, Loader2, Trash2 } from 'lucide-react';
import { getClientTeamMembers, removeClientTeamMember, type ClientTeamMember } from '../api/invitations';
import type { Invitation } from '../types';
import InviteTeamMemberModal from '../features/invitations/InviteTeamMemberModal';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export default function ClientTeamPage() {
  const [members,    setMembers]    = useState<ClientTeamMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await getClientTeamMembers());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function handleRemove(memberId: string) {
    if (!confirm('Retirer ce membre de votre équipe ?')) return;
    setRemovingId(memberId);
    try {
      await removeClientTeamMember(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch { /* ignore */ }
    finally { setRemovingId(null); }
  }

  function handleInvited(_inv: Invitation) {
    setInviteOpen(false);
    fetchMembers();
  }

  const activeCount = members.filter(m => m.is_active).length;
  const MAX_MEMBERS = 10;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={22} /> Mon équipe
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
            Membres de votre entreprise ayant accès à votre espace client
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          disabled={activeCount >= MAX_MEMBERS}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: activeCount >= MAX_MEMBERS ? '#E5E7EB' : '#6366F1',
            color: activeCount >= MAX_MEMBERS ? '#9CA3AF' : 'white',
            border: 'none', borderRadius: 8, cursor: activeCount >= MAX_MEMBERS ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: 13,
          }}
          title={activeCount >= MAX_MEMBERS ? `Limite de ${MAX_MEMBERS} membres atteinte` : undefined}
        >
          <UserPlus size={16} /> Inviter un membre
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4F46E5' }}>{activeCount}</div>
          <div style={{ fontSize: 12, color: '#4F46E5', marginTop: 2 }}>Membre{activeCount !== 1 ? 's' : ''} actif{activeCount !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#374151' }}>{MAX_MEMBERS}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Maximum autorisé</div>
        </div>
        <div style={{
          background: activeCount >= MAX_MEMBERS ? '#FEF3C7' : '#F0FDF4',
          border: `1px solid ${activeCount >= MAX_MEMBERS ? '#FDE68A' : '#BBF7D0'}`,
          borderRadius: 12, padding: '14px 18px',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: activeCount >= MAX_MEMBERS ? '#D97706' : '#16A34A' }}>
            {MAX_MEMBERS - activeCount}
          </div>
          <div style={{ fontSize: 12, color: activeCount >= MAX_MEMBERS ? '#D97706' : '#16A34A', marginTop: 2 }}>
            Place{MAX_MEMBERS - activeCount !== 1 ? 's' : ''} restante{MAX_MEMBERS - activeCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tableau membres */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader2 size={24} className="animate-spin" color="#6366F1" />
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 80px',
            padding: '13px 24px', background: '#0F172A',
            color: '#94A3B8', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <div>Membre</div>
            <div>Email</div>
            <div style={{ textAlign: 'center' }}>Statut</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {members.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ height: 52, width: 52, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Users size={22} color="#9CA3AF" />
              </div>
              <div style={{ fontWeight: 500, color: '#374151', fontSize: 14 }}>Aucun membre dans votre équipe</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Invitez des collègues pour accéder ensemble à votre espace</div>
              <button
                onClick={() => setInviteOpen(true)}
                style={{ marginTop: 14, background: '#6366F1', color: 'white', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Inviter le premier membre
              </button>
            </div>
          ) : members.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 80px',
                padding: '14px 24px',
                borderBottom: i < members.length - 1 ? '1px solid #F3F4F6' : 'none',
                alignItems: 'center',
                borderLeft: `3px solid ${m.is_me ? '#6366F1' : '#E5E7EB'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: m.is_me ? 'linear-gradient(135deg,#6366F1,#4F46E5)' : 'linear-gradient(135deg,#9CA3AF,#6B7280)',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {initials(m.first_name, m.last_name)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    {m.first_name} {m.last_name}
                    {m.is_me && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: '#6366F1', background: '#EEF2FF', padding: '2px 8px', borderRadius: 20 }}>
                        Vous
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>Depuis {fmtDate(m.created_at)}</div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.email}
              </div>

              <div style={{ textAlign: 'center' }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                  background: m.is_active ? '#F0FDF4' : '#F9FAFB',
                  color: m.is_active ? '#16A34A' : '#9CA3AF',
                  border: `1px solid ${m.is_active ? '#BBF7D0' : '#E5E7EB'}`,
                }}>
                  {m.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {!m.is_me && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    disabled={removingId === m.id}
                    title="Retirer ce membre"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#EF4444', padding: '6px', borderRadius: 6,
                      opacity: removingId === m.id ? 0.5 : 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {inviteOpen && (
        <InviteTeamMemberModal
          onClose={() => setInviteOpen(false)}
          onCreated={handleInvited}
        />
      )}
    </div>
  );
}
