import { useState } from 'react';
import { User, Mail, Phone, Building2, Pencil, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { updateMe } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const INPUT_CLASS =
  'w-full px-3 py-2 text-[14px] border border-gray-300 rounded-md ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [editMode,    setEditMode]    = useState(false);
  const [editFirst,   setEditFirst]   = useState('');
  const [editLast,    setEditLast]    = useState('');
  const [editPhone,   setEditPhone]   = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [editError,   setEditError]   = useState<string | null>(null);
  const [toast,       setToast]       = useState<'success' | 'error' | null>(null);
  const [toastMsg,    setToastMsg]    = useState('');

  if (!user) return null;

  function enterEdit() {
    setEditFirst(user!.first_name);
    setEditLast(user!.last_name);
    setEditPhone(user!.phone_number ?? '');
    setEditCompany(user!.client_company_name ?? '');
    setEditError(null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditError(null);
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast(type);
    setToastMsg(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    const firstName = editFirst.trim();
    const lastName  = editLast.trim();
    if (!firstName || !lastName) {
      setEditError('Le prénom et le nom sont obligatoires.');
      return;
    }
    if (firstName.length + lastName.length < 2) {
      setEditError('Le nom complet doit contenir au moins 2 caractères.');
      return;
    }
    if (editPhone.trim() && editPhone.trim().length < 6) {
      setEditError('Le numéro de téléphone semble invalide.');
      return;
    }
    setEditError(null);
    setSaving(true);
    try {
      await updateMe({
        first_name:   firstName,
        last_name:    lastName,
        phone_number: editPhone.trim() || undefined,
        company_name: editCompany.trim() || undefined,
      });
      await refreshUser();
      setEditMode(false);
      showToast('success', 'Informations mises à jour');
    } catch {
      showToast('error', 'Impossible de mettre à jour vos informations.');
    } finally {
      setSaving(false);
    }
  }

  const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();

  const rowStyle = {
    display: 'flex' as const,
    gap: 14,
    padding: '14px 16px',
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
  };

  const iconBoxStyle = (bg: string) => ({
    height: 36, width: 36, minWidth: 36, borderRadius: 8, background: bg,
    display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  });

  const labelStyle = {
    fontSize: 10, fontWeight: 600, color: '#9CA3AF',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 4,
  };

  const valueStyle = { fontSize: 14, fontWeight: 500, color: '#111827' };

  return (
    <div className="space-y-6">

      {/* Toast */}
      <div className={`fixed top-16 right-4 z-[10001] flex items-center gap-2.5 bg-white rounded-xl
        shadow-lg px-4 py-3 transition-all duration-300
        ${toast === 'error' ? 'border border-red-200' : 'border border-green-200'}
        ${toast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}
      >
        {toast === 'success'
          ? <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
          : <AlertCircle size={18} className="text-red-500 flex-shrink-0" />}
        <span className="text-sm font-medium text-gray-800">{toastMsg}</span>
      </div>

      {/* Page header */}
      <div className="pb-5 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Consultez et modifiez vos informations personnelles.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {/* Card header */}
        <div style={{ background: '#F8FAFC', padding: '20px 24px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              height: 56, width: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                {user.first_name} {user.last_name}
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Client</p>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Nom complet */}
          <div style={{ ...rowStyle, alignItems: editMode ? 'flex-start' : 'center' }}>
            <div style={{ ...iconBoxStyle('#EFF6FF'), marginTop: editMode ? 4 : 0 }}>
              <User size={16} color="#3B82F6" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Nom complet</p>
              {editMode ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className={INPUT_CLASS} value={editFirst} onChange={(e) => setEditFirst(e.target.value)} placeholder="Prénom" />
                  <input className={INPUT_CLASS} value={editLast}  onChange={(e) => setEditLast(e.target.value)}  placeholder="Nom" />
                </div>
              ) : (
                <p style={valueStyle}>{user.first_name} {user.last_name}</p>
              )}
            </div>
          </div>

          {/* Email — read-only */}
          <div style={{ ...rowStyle, alignItems: 'center' }}>
            <div style={iconBoxStyle('#F5F3FF')}>
              <Mail size={16} color="#7C3AED" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Email</p>
              <p style={valueStyle}>{user.email}</p>
              {editMode && (
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={10} />
                  L'adresse email ne peut pas être modifiée
                </p>
              )}
            </div>
          </div>

          {/* Téléphone */}
          <div style={{ ...rowStyle, alignItems: editMode ? 'flex-start' : 'center' }}>
            <div style={{ ...iconBoxStyle('#F0FDF4'), marginTop: editMode ? 4 : 0 }}>
              <Phone size={16} color="#16A34A" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Téléphone</p>
              {editMode ? (
                <input className={INPUT_CLASS} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+33 6 12 34 56 78" />
              ) : (
                <p style={valueStyle}>{user.phone_number || '—'}</p>
              )}
            </div>
          </div>

          {/* Entreprise */}
          <div style={{ ...rowStyle, alignItems: editMode ? 'flex-start' : 'center' }}>
            <div style={{ ...iconBoxStyle('#FFF7ED'), marginTop: editMode ? 4 : 0 }}>
              <Building2 size={16} color="#EA580C" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Entreprise</p>
              {editMode ? (
                <input className={INPUT_CLASS} value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="Nom de votre entreprise" />
              ) : (
                <p style={valueStyle}>{user.client_company_name || '—'}</p>
              )}
            </div>
          </div>

          {editError && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontSize: 13, color: '#DC2626',
            }}>
              {editError}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {editMode ? (
            <>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-[13px] font-medium text-gray-600 border border-gray-200
                  rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-[13px] font-medium text-white bg-blue-600
                  hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </>
          ) : (
            <button
              onClick={enterEdit}
              className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium
                text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Pencil size={13} />
              Modifier mes informations
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
