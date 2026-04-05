import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token, user } = await login(email, password);
      setAuth(access_token, user);
      sessionStorage.setItem('just_logged_in', 'true');
      navigate('/');
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        const { status, data } = err.response;
        const detail = data?.detail;
        if (status === 401) {
          setError(detail || 'Email ou mot de passe incorrect.');
        } else if (status === 403) {
          setError(detail || 'Votre accès a été révoqué. Contactez votre cabinet comptable.');
        } else if (status === 422) {
          setError('Veuillez vérifier le format de votre email.');
        } else if (status >= 500) {
          setError('Erreur serveur. Veuillez réessayer plus tard.');
        } else {
          setError(detail || 'Une erreur est survenue.');
        }
      } else {
        setError('Impossible de contacter le serveur. Vérifiez votre connexion internet.');
      }
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

          <h1 className="text-[18px] font-bold text-gray-900 mb-1">Connexion</h1>
          <p className="text-[13px] text-gray-500 mb-6">
            Accédez à votre espace cabinet comptable.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">
                Email
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
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-gray-500 mt-4">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-blue-600 hover:underline font-medium">
            Créer un compte
          </Link>
        </p>

      </div>
    </div>
  );
}
