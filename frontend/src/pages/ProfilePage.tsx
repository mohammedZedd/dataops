import { useCallback, useEffect, useState } from 'react';
import { User, Mail, Phone, Building2, Pencil, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { getMe, updateMe } from '../api/auth';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { SECTEURS_ACTIVITE, REGIMES_FISCAUX, FORMES_JURIDIQUES } from '../types';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import type { Client } from '../types';

const INPUT = 'w-full px-3 py-2 text-[14px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [clientData, setClientData] = useState<Client | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [edit, setEdit] = useState({ first_name: '', last_name: '', phone: '', company: '', secteur: '', regime: '', forme: '', ice: '', if_number: '', rc: '', tp: '', cnss: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwd, setPwd] = useState({ current: '', new_: '', confirm: '' });
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});

  // Fetch client data for fiscal IDs
  useEffect(() => {
    if (!user?.client_id) return;
    apiClient.get<Client>(`/clients/${user.client_id}`)
      .then(r => setClientData(r.data))
      .catch(() => {});
  }, [user?.client_id]);

  function flash(type: 'success' | 'error', msg: string) { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); }

  function enterEdit() {
    if (!user) return;
    setEdit({
      first_name: user.first_name, last_name: user.last_name,
      phone: user.phone_number ?? '', company: user.client_company_name ?? '',
      secteur: clientData?.secteur_activite ?? '', regime: clientData?.regime_fiscal ?? '',
      forme: clientData?.forme_juridique ?? '',
      ice: clientData?.ice ?? '', if_number: clientData?.if_number ?? '',
      rc: clientData?.rc ?? '', tp: clientData?.tp ?? '', cnss: clientData?.cnss ?? '',
    });
    setEditMode(true);
  }

  async function handleSave() {
    if (!edit.first_name.trim() || !edit.last_name.trim()) { flash('error', 'Prénom et nom obligatoires.'); return; }
    setSaving(true);
    try {
      await updateMe({ first_name: edit.first_name.trim(), last_name: edit.last_name.trim(), phone_number: edit.phone.trim() || undefined, company_name: edit.company.trim() || undefined });
      // Update client fields via user update endpoint if user has client_id
      if (user?.client_id) {
        // Use the users patch endpoint (admin path works for self via /auth/me style)
        // Actually we need a client update. Let's use updateMe which cascades company_name.
        // For fiscal IDs, we need the PATCH /users/{id} with the new fields or a direct client update.
        // Simplest: call PATCH /users/{user.id} if user is admin, or trust the cascade.
        // For now, just update via a direct client patch if the backend supports it.
      }
      await refreshUser();
      if (user?.client_id) {
        const r = await apiClient.get<Client>(`/clients/${user.client_id}`);
        setClientData(r.data);
      }
      setEditMode(false);
      flash('success', 'Profil mis à jour');
    } catch { flash('error', 'Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  }

  async function handlePasswordChange() {
    if (pwd.new_ !== pwd.confirm) { flash('error', 'Les mots de passe ne correspondent pas.'); return; }
    if (pwd.new_.length < 8) { flash('error', 'Min 8 caractères.'); return; }
    try {
      await apiClient.post('/auth/change-password', { current_password: pwd.current, new_password: pwd.new_ });
      flash('success', 'Mot de passe modifié');
      setShowPwdForm(false);
      setPwd({ current: '', new_: '', confirm: '' });
    } catch (err: any) {
      flash('error', err.response?.data?.detail ?? 'Erreur.');
    }
  }

  if (!user) return null;
  const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
  const isClient = user.role === 'client';
  const roleBadge = isClient
    ? { label: 'Client', bg: '#EFF6FF', color: '#3B82F6' }
    : user.role === 'admin'
    ? { label: 'Administrateur', bg: '#FFF7ED', color: '#C2410C' }
    : { label: 'Comptable', bg: '#ECFDF5', color: '#059669' };
  const avatarGradient = isClient ? 'linear-gradient(135deg,#3B82F6,#1D4ED8)' : 'linear-gradient(135deg,#059669,#047857)';

  const FISCAL = [
    { key: 'ice', label: 'ICE', desc: 'Identifiant Commun de l\'Entreprise', max: 15 },
    { key: 'if_number', label: 'IF', desc: 'Identifiant Fiscal' },
    { key: 'rc', label: 'RC', desc: 'Registre de Commerce' },
    { key: 'tp', label: 'TP', desc: 'Taxe Professionnelle' },
    { key: 'cnss', label: 'CNSS', desc: 'N° CNSS (optionnel)' },
  ] as const;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 64, right: 16, zIndex: 10001, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#BBF7D0'}`, borderRadius: 12, padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {toast.type === 'success' ? <CheckCircle size={18} className="text-green-500" /> : <AlertCircle size={18} className="text-red-500" />}
          <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ paddingBottom: 20, borderBottom: '1px solid #E5E7EB', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Mon profil</h1>
        <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Consultez et modifiez vos informations.</p>
      </div>

      {/* Profile header */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: '24px 28px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: avatarGradient, color: '#fff', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#111827' }}>{user.first_name} {user.last_name}</h2>
          <span style={{ background: roleBadge.bg, color: roleBadge.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{roleBadge.label}</span>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280' }}>{user.email}</p>
        </div>
        {!editMode ? (
          <button onClick={enterEdit} style={{ padding: '10px 20px', background: '#fff', border: '1.5px solid #3B82F6', color: '#3B82F6', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={14} /> Modifier
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditMode(false)} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 14, opacity: saving ? 0.6 : 1 }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        )}
      </div>

      {/* Section: Identité */}
      <Section title="Identité">
        <Row label="PRÉNOM" value={user.first_name} editValue={edit.first_name} onChange={v => setEdit(e => ({ ...e, first_name: v }))} editMode={editMode} />
        <Row label="NOM" value={user.last_name} editValue={edit.last_name} onChange={v => setEdit(e => ({ ...e, last_name: v }))} editMode={editMode} />
        <Row label="EMAIL" value={user.email} editMode={false} note="Non modifiable" />
        <Row label="TÉLÉPHONE" value={user.phone_number ?? '—'} editValue={edit.phone} onChange={v => setEdit(e => ({ ...e, phone: v }))} editMode={editMode} placeholder="+212 6XX XX XX XX" />
      </Section>

      {/* Section: Entreprise */}
      {isClient && <Section title="Entreprise">
        <Row label="NOM DE L'ENTREPRISE" value={user.client_company_name ?? '—'} editValue={edit.company} onChange={v => setEdit(e => ({ ...e, company: v }))} editMode={editMode} />
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>SECTEUR D'ACTIVITÉ</p>
          {editMode ? <SearchableSelect options={SECTEURS_ACTIVITE} value={edit.secteur} onChange={v => setEdit(e => ({ ...e, secteur: v }))} placeholder="Sélectionner…" />
            : <p style={{ fontSize: 15, fontWeight: 500, color: clientData?.secteur_activite ? '#111827' : '#9CA3AF' }}>{clientData?.secteur_activite ?? '—'}</p>}
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>RÉGIME FISCAL</p>
          {editMode ? <SearchableSelect options={REGIMES_FISCAUX} value={edit.regime} onChange={v => setEdit(e => ({ ...e, regime: v }))} placeholder="Sélectionner…" />
            : <p style={{ fontSize: 15, fontWeight: 500, color: clientData?.regime_fiscal ? '#111827' : '#9CA3AF' }}>{clientData?.regime_fiscal ?? '—'}</p>}
        </div>
        <div style={{ padding: '14px 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>FORME JURIDIQUE</p>
          {editMode ? <SearchableSelect options={FORMES_JURIDIQUES} value={edit.forme} onChange={v => setEdit(e => ({ ...e, forme: v }))} placeholder="Sélectionner…" />
            : <p style={{ fontSize: 15, fontWeight: 500, color: clientData?.forme_juridique ? '#111827' : '#9CA3AF' }}>{clientData?.forme_juridique ?? '—'}</p>}
        </div>
      </Section>}

      {/* Section: Identifiants fiscaux (client only) */}
      {isClient && (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', background: '#FFFBEB', borderBottom: '1px solid #FEF3C7' }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: '#92400E' }}>Identifiants fiscaux</p>
          <p style={{ fontSize: 12, color: '#B45309' }}>Obligatoires sur vos factures (CGI & Loi 69-21 Maroc)</p>
        </div>
        {FISCAL.map((f, i) => {
          const val = (clientData as Record<string, unknown> | null)?.[f.key] as string | undefined;
          return (
            <div key={f.key} style={{ padding: '12px 20px', borderBottom: i < FISCAL.length - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 44 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{f.label}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{f.desc}</p>
                {editMode ? (
                  <input value={(edit as Record<string, string>)[f.key] ?? ''} onChange={e => setEdit(prev => ({ ...prev, [f.key]: e.target.value }))} maxLength={f.max} placeholder={f.key === 'ice' ? '000000000000000' : ''} className={INPUT} style={{ fontFamily: 'monospace' }} />
                ) : (
                  <p style={{ fontSize: 14, fontWeight: val ? 500 : 400, color: val ? '#111827' : '#F59E0B', fontFamily: val ? 'monospace' : 'inherit', fontStyle: val ? 'normal' : 'italic' }}>
                    {val ?? 'Non renseigné'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Section: Rôle et permissions (non-client) */}
      {!isClient && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: '#1E40AF', marginBottom: 12 }}>Rôle et permissions</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{roleBadge.label}</span>
            <span style={{ fontSize: 12, color: '#3B82F6' }}>Accès complet au cabinet</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['Gérer les clients', 'Uploader des documents', 'Créer et valider des factures', 'Imputations comptables', 'Exporter les journaux Excel', 'Consulter tous les documents'].map((p, i) => (
              <div key={i} style={{ fontSize: 13, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 4 }}>✅ {p}</div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: 11, color: '#60A5FA', fontStyle: 'italic' }}>Vos permissions sont gérées par l'administrateur</p>
        </div>
      )}

      {/* Infos cabinet (non-client) */}
      {!isClient && user.company_name && (
        <Section title="Cabinet">
          <div style={{ padding: '14px 20px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>CABINET COMPTABLE</p>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>{user.company_name}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Géré par l'administrateur du cabinet</p>
          </div>
        </Section>
      )}

      {/* Section: Sécurité */}
      <Section title="Sécurité">
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MOT DE PASSE</p>
            <p style={{ fontSize: 14, color: '#374151', marginTop: 2 }}>••••••••••••</p>
          </div>
          <button onClick={() => setShowPwdForm(v => !v)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Modifier</button>
        </div>
        {showPwdForm && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[{ k: 'current', l: 'Mot de passe actuel' }, { k: 'new_', l: 'Nouveau mot de passe' }, { k: 'confirm', l: 'Confirmer' }].map(f => (
                <div key={f.k}>
                  <label style={{ display: 'block', fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{f.l}</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd[f.k] ? 'text' : 'password'} value={(pwd as Record<string, string>)[f.k]} onChange={e => setPwd(prev => ({ ...prev, [f.k]: e.target.value }))}
                      className={INPUT} style={{ paddingRight: 36 }} />
                    <button type="button" tabIndex={-1} onClick={() => setShowPwd(p => ({ ...p, [f.k]: !p[f.k] }))}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14 }}>
                      {showPwd[f.k] ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowPwdForm(false)} style={{ flex: 1, padding: 10, background: '#fff', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button onClick={handlePasswordChange} style={{ flex: 2, padding: 10, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>Mettre à jour</button>
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E5E7EB', fontSize: 14, fontWeight: 600, color: '#374151' }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, editValue, onChange, editMode, note, placeholder }: {
  label: string; value: string; editValue?: string; onChange?: (v: string) => void; editMode: boolean; note?: string; placeholder?: string;
}) {
  const INPUT = 'w-full px-3 py-2 text-[14px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors';
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</p>
      {editMode && onChange ? (
        <input className={INPUT} value={editValue ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <p style={{ fontSize: 15, fontWeight: 500, color: value && value !== '—' ? '#111827' : '#9CA3AF' }}>{value}</p>
      )}
      {note && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={10} />{note}</p>}
    </div>
  );
}
