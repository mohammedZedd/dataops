import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Users, CheckCircle2 } from 'lucide-react';
import { AxiosError } from 'axios';
import { createClientInvitation } from '../../api/invitations';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import type { Invitation } from '../../types';

interface Props {
  onClose: () => void;
  onCreated: (invitation: Invitation) => void;
  onReactivated?: () => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 ' +
  'focus:border-blue-400 transition-colors';

export default function InviteClientModal({ onClose, onCreated, onReactivated }: Props) {
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [created,     setCreated]     = useState<Invitation | null>(null);
  const [reactivated, setReactivated] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !companyName.trim()) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Veuillez saisir un email valide.');
      return;
    }

    setLoading(true);
    try {
      const result = await createClientInvitation({
        first_name:   firstName.trim(),
        last_name:    lastName.trim(),
        email:        email.trim(),
        company_name: companyName.trim(),
      });
      if ('reactivated' in result && result.reactivated) {
        setReactivated(true);
        onReactivated?.();
      } else {
        const inv = result as Invitation;
        setCreated(inv);
        onCreated(inv);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof AxiosError
          ? err.response?.data?.detail ?? "Impossible d'envoyer l'invitation."
          : "Impossible d'envoyer l'invitation.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const isDone = created || reactivated;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/40"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users size={17} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-900">Inviter un client</p>
              <p className="text-[12px] text-gray-400">
                {isDone ? 'Invitation envoyée avec succès.' : 'Le client accédera uniquement à son espace.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400
              hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {isDone ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <div>
                {reactivated ? (
                  <>
                    <p className="text-[15px] font-semibold text-gray-900">Accès réactivé !</p>
                    <p className="text-[13px] text-gray-500 mt-1">
                      Le client <span className="font-semibold text-gray-700">{email}</span><br />
                      peut de nouveau se connecter.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] font-semibold text-gray-900">Invitation envoyée !</p>
                    <p className="text-[13px] text-gray-500 mt-1">
                      Un email d'invitation a été envoyé à<br />
                      <span className="font-semibold text-gray-700">{created!.email}</span>
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {error && <ErrorBanner message={error} />}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Prénom"
                  autoFocus
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Nom"
                  className={INPUT_CLASS}
                />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@entreprise.fr"
                className={INPUT_CLASS}
              />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Entreprise du client (ex: SARL Dupont)"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className={INPUT_CLASS}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-end gap-2">
          {!isDone ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-800
                  hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700
                  disabled:opacity-60 text-white text-[13px] font-medium rounded-lg transition-colors"
              >
                <Send size={13} />
                {loading ? 'Envoi…' : "Envoyer l'invitation"}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-white bg-emerald-600
                hover:bg-emerald-700 rounded-lg transition-colors"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
