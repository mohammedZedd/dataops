/**
 * api/index.ts — point d'entrée unique de la couche API.
 *
 * Toutes les pages et composants importent depuis '../api' (ce fichier).
 * La logique réelle est dans api/clients.ts et api/invoices.ts.
 *
 * Cela permet de changer l'implémentation (mock → FastAPI) sans toucher
 * aux imports dans les pages.
 */

export * from './clients';
export * from './invoices';
export * from './invitations';
export { default as apiClient } from './axios';
