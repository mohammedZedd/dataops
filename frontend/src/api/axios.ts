import axios, { AxiosError } from 'axios';

/**
 * Instance axios centralisée.
 *
 * Variable d'environnement :
 *   VITE_API_URL=http://localhost:8000  → dev local
 *   VITE_API_URL=https://api.monapp.fr  → production
 *
 * ⚠️  FastAPI doit autoriser l'origine du frontend via CORS :
 *   from fastapi.middleware.cors import CORSMiddleware
 *   app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], ...)
 *
 * ⚠️  FastAPI renvoie du snake_case par défaut (documents_count, created_at…).
 *   Deux options pour que les types TypeScript (camelCase) correspondent :
 *   1. Configurer Pydantic avec alias_generator=to_camel (recommandé)
 *   2. Renommer les champs dans les types TypeScript
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// ─── Intercepteur de requête ──────────────────────────────────────────────────
// Emplacement réservé pour injecter le JWT quand l'auth sera en place.

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ─── Intercepteur de réponse ──────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (!error.response) {
      // Erreur réseau : serveur injoignable, timeout, pas de connexion
      console.error('[API] Erreur réseau — serveur injoignable :', error.message);
      return Promise.reject(new Error('Le serveur est inaccessible. Vérifiez votre connexion.'));
    }

    const { status, data } = error.response;

    switch (true) {
      case status === 401: {
        const url = error.config?.url ?? '';
        const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
        if (!isAuthEndpoint) {
          console.warn('[API] 401 — Non authentifié, redirection login');
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        break;
      }
      case status === 403:
        console.warn('[API] 403 — Accès refusé');
        break;
      case status === 404:
        // Géré localement par chaque fonction (throw ciblé)
        break;
      case status >= 500:
        console.error(`[API] ${status} — Erreur serveur :`, data);
        break;
    }

    return Promise.reject(error);
  },
);

export default apiClient;
