import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getMe } from '../api/auth';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('auth_token'),
    loading: true,
  });

  // Au montage : si un token existe, on vérifie qu'il est encore valide
  const hydrate = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setState({ user: null, token: null, loading: false });
      return;
    }
    try {
      const user = await getMe();
      setState({ user, token, loading: false });
    } catch {
      localStorage.removeItem('auth_token');
      setState({ user: null, token: null, loading: false });
    }
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  function setAuth(token: string, user: User) {
    localStorage.setItem('auth_token', token);
    setState({ user, token, loading: false });
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setState({ user: null, token: null, loading: false });
  }

  async function refreshUser() {
    try {
      const user = await getMe();
      setState((prev) => ({ ...prev, user }));
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook d'accès — lance une erreur si utilisé hors AuthProvider
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
