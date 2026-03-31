import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { acceptInvitation, getInvitationByToken } from '../api/invitations';
import { useAuth } from '../context/AuthContext';
import type { InvitationPublic } from '../types';

export default function AcceptInvitePage() {
  const [search] = useSearchParams();
  const token = search.get('token') ?? '';
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [invite, setInvite] = useState<InvitationPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien d’invitation invalide.');
      setLoading(false);
      return;
    }
    getInvitationByToken(token)
      .then((data) => setInvite(data))
      .catch((err: unknown) => {
        const msg = err instanceof AxiosError
          ? err.response?.data?.detail ?? 'Invitation invalide ou expirée.'
          : 'Invitation invalide ou expirée.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password || !confirm) {
      setError('Veuillez saisir un mot de passe.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      const { access_token, user } = await acceptInvitation({ token, password });
      setAuth(access_token, user);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof AxiosError
        ? err.response?.data?.detail ?? 'Impossible de finaliser l’invitation.'
        : 'Impossible de finaliser l’invitation.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-[14px]">C</span>
          </div>
          <span className="text-[17px] font-bold text-gray-900 tracking-tight">ComptaFlow</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8"
          style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>

          <h1 className="text-[18px] font-bold text-gray-900 mb-1">Finaliser votre compte</h1>
          <p className="text-[13px] text-gray-500 mb-6">
            Créez votre mot de passe pour accéder à l’espace cabinet.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invite ? (
            <>
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 mb-4">
                <p className="text-[12px] text-gray-600">
                  {invite.first_name} {invite.last_name} — {invite.email}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 capitalize">
                  Rôle : {invite.role}{invite.client_name ? ` · Client : ${invite.client_name}` : ''}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="8 caractères minimum"
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg
                      placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                      focus:border-blue-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg
                      placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                      focus:border-blue-400 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                    text-white text-[13px] font-semibold rounded-lg transition-colors"
                >
                  {submitting ? 'Activation…' : 'Activer mon compte'}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
