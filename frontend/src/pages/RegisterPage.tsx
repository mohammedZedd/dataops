import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { register } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !companyName.trim() || !password || !confirm) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Veuillez saisir un email valide.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      const { access_token, user } = await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        company_name: companyName.trim(),
        password,
      });
      setAuth(access_token, user);
      navigate('/');
    } catch (err) {
      const msg = err instanceof AxiosError
        ? err.response?.data?.detail ?? 'Erreur lors de la création du compte.'
        : 'Une erreur est survenue.';
      setError(msg);
    } finally {
      setLoading(false);
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

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8"
          style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>

          <h1 className="text-[18px] font-bold text-gray-900 mb-1">Créer un compte</h1>
          <p className="text-[13px] text-gray-500 mb-6">
            Rejoignez ComptaFlow pour votre cabinet.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Prénom
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  placeholder="Camille"
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg
                    placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                    focus:border-blue-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Nom
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  placeholder="Dupont"
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg
                    placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                    focus:border-blue-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">
                Email professionnel
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="expert@cabinet.fr"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg
                  placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                  focus:border-blue-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">
                Nom du cabinet / entreprise
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                required
                autoComplete="organization"
                placeholder="Cabinet Dupont & Associés"
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg
                  placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                  focus:border-blue-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
                onChange={e => setConfirm(e.target.value)}
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
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                text-white text-[13px] font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-gray-500 mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Se connecter
          </Link>
        </p>

      </div>
    </div>
  );
}
