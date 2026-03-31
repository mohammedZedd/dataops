import { useState } from 'react';
import { X, Send, Mail } from 'lucide-react';
import { AxiosError } from 'axios';
import { createAccountantInvitation } from '../../api/invitations';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import type { Invitation } from '../../types';

interface Props {
  companyName: string | null | undefined;
  onClose: () => void;
  onCreated: (invitation: Invitation) => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg ' +
  'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 ' +
  'focus:border-blue-400 transition-colors';

export default function InviteAccountantModal({ companyName, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Veuillez saisir un email valide.');
      return;
    }

    setLoading(true);
    try {
      const created = await createAccountantInvitation({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim(),
      });
      onCreated(created);
      onClose();
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Mail size={17} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-900">Inviter un comptable</p>
              <p className="text-[12px] text-gray-400">Le comptable recevra un lien sécurisé.</p>
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
        <div className="px-6 py-5 space-y-3">
          {companyName && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                Cabinet
              </span>
              <span className="text-[13px] font-medium text-gray-700">{companyName}</span>
            </div>
          )}

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
            placeholder="email@cabinet.fr"
            className={INPUT_CLASS}
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-end gap-2">
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
              disabled:opacity-60 text-white text-[13px] font-medium rounded-lg transition-colors"
          >
            <Send size={13} />
            {loading ? 'Envoi…' : 'Envoyer l\'invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}
