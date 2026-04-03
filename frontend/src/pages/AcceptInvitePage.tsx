import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { acceptInvitation, getInvitationByToken } from '../api/invitations';
import { useAuth } from '../context/AuthContext';
import type { InvitationPublic } from '../types';

const INPUT_CLASS =
  'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 ' +
  'focus:border-blue-400 transition-colors';

const INPUT_READONLY_CLASS =
  'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg ' +
  'bg-gray-50 text-gray-500 cursor-default select-none';

type PageState = 'loading' | 'invalid' | 'already_accepted' | 'form';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [pageState, setPageState]     = useState<PageState>('loading');
  const [invite,    setInvite]        = useState<InvitationPublic | null>(null);
  const [errorMsg,  setErrorMsg]      = useState<string | null>(null);

  // Champs du formulaire
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [formError,   setFormError]   = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg('Lien d\'invitation invalide ou manquant.');
      setPageState('invalid');
      return;
    }

    getInvitationByToken(token)
      .then((data) => {
        setInvite(data);
        setFirstName(data.first_name);
        setLastName(data.last_name);
        setPageState('form');
      })
      .catch((err: unknown) => {
        if (err instanceof AxiosError) {
          const status = err.response?.status;
          const detail = err.response?.data?.detail;
          if (status === 409) {
            setPageState('already_accepted');
            return;
          }
          if (status === 410) {
            setErrorMsg('Ce lien d\'invitation a expiré. Demandez un nouvel envoi à votre administrateur.');
            setPageState('invalid');
            return;
          }
          setErrorMsg(detail ?? 'Invitation invalide ou introuvable.');
        } else {
          setErrorMsg('Une erreur réseau est survenue.');
        }
        setPageState('invalid');
      });
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setFormError('Tous les champs sont obligatoires.');
      return;
    }
    if (!password || !confirm) {
      setFormError('Veuillez saisir un mot de passe.');
      return;
    }
    if (password.length < 8) {
      setFormError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setFormError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      const { access_token, user } = await acceptInvitation({
        token,
        first_name:   firstName.trim(),
        last_name:    lastName.trim(),
        phone_number: phone.trim(),
        password,
      });
      setAuth(access_token, user);
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.detail ?? 'Impossible de finaliser l\'inscription.'
          : 'Impossible de finaliser l\'inscription.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-[14px]">C</span>
          </div>
          <span className="text-[17px] font-bold text-gray-900 tracking-tight">ComptaFlow</span>
        </div>

        <div
          className="bg-white rounded-2xl border border-gray-100 p-8"
          style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}
        >

          {/* ── Loading ── */}
          {pageState === 'loading' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-gray-400">Vérification de l'invitation…</p>
            </div>
          )}

          {/* ── Invalid / expired ── */}
          {pageState === 'invalid' && (
            <div className="text-center py-4">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <span className="text-red-500 text-lg">✕</span>
              </div>
              <h1 className="text-[16px] font-bold text-gray-900 mb-1">Lien invalide</h1>
              <p className="text-[13px] text-gray-500 mb-5">
                {errorMsg ?? 'Ce lien d\'invitation est invalide ou a expiré.'}
              </p>
              <Link
                to="/login"
                className="text-[13px] font-medium text-blue-600 hover:underline"
              >
                Retour à la connexion
              </Link>
            </div>
          )}

          {/* ── Already accepted ── */}
          {pageState === 'already_accepted' && (
            <div className="text-center py-4">
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <span className="text-emerald-500 text-lg">✓</span>
              </div>
              <h1 className="text-[16px] font-bold text-gray-900 mb-1">Invitation déjà utilisée</h1>
              <p className="text-[13px] text-gray-500 mb-5">
                Ce lien d'invitation a déjà été utilisé. Connectez-vous avec votre compte.
              </p>
              <Link
                to="/login"
                className="text-[13px] font-medium text-blue-600 hover:underline"
              >
                Se connecter
              </Link>
            </div>
          )}

          {/* ── Form ── */}
          {pageState === 'form' && invite && (
            <>
              <h1 className="text-[18px] font-bold text-gray-900 mb-1">Créer votre compte</h1>

              {/* Badge cabinet */}
              {invite.company_name && (
                <div className="flex items-center gap-2 mb-4 mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">Cabinet</span>
                  <span className="text-[13px] font-medium text-blue-700">{invite.company_name}</span>
                </div>
              )}

              {formError && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                  <p className="text-[12px] text-red-700">{formError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Prénom</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoComplete="given-name"
                      placeholder="Prénom"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Nom</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoComplete="family-name"
                      placeholder="Nom"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={invite.email}
                    readOnly
                    className={INPUT_READONLY_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    placeholder="+33 6 00 00 00 00"
                    className={INPUT_CLASS}
                  />
                </div>

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
                    className={INPUT_CLASS}
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
                    className={INPUT_CLASS}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 mt-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                    text-white text-[13px] font-semibold rounded-lg transition-colors"
                >
                  {submitting ? 'Activation…' : 'Activer mon compte'}
                </button>
              </form>
            </>
          )}

        </div>

        {pageState === 'form' && (
          <p className="text-center text-[12px] text-gray-500 mt-4">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Se connecter
            </Link>
          </p>
        )}

      </div>
    </div>
  );
}
