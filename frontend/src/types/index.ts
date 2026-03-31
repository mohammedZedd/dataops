// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'accountant' | 'client';

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  company_id: string;
  company_name?: string | null;
  client_id?: string | null;
  created_at: string;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface Invitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  client_id?: string | null;
  client_name?: string | null;
  client_company_name?: string | null;
  status: InvitationStatus;
  expires_at: string;
  invited_by_user_id: string;
  company_id: string;
  accepted_at?: string | null;
  created_at: string;
}

export interface InvitationPublic {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  client_id?: string | null;
  client_name?: string | null;
  client_company_name?: string | null;
  status: InvitationStatus;
  expires_at: string;
}

export interface InvitationAccountantCreatePayload {
  first_name: string;
  last_name: string;
  email: string;
}

export interface InvitationClientCreatePayload {
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  client_id?: string;
}

export interface InvitationAcceptPayload {
  token: string;
  password: string;
}

// ─── Statuts ──────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | 'uploaded'    // fichier reçu, pas encore traité
  | 'processing'  // extraction OCR en cours
  | 'processed'   // extraction terminée
  | 'error';      // échec d'extraction

export type InvoiceStatus =
  | 'to_review'   // données extraites, attente vérification humaine
  | 'validated'   // validée par le comptable
  | 'rejected';   // rejetée (erreur de saisie / doublon)

// ─── Entités métier ───────────────────────────────────────────────────────────

/**
 * Client du cabinet comptable.
 */
export interface Client {
  id: string;
  name: string;
  siret?: string;
  email?: string;
  documentsCount: number;
  invoicesToReview: number;
  createdAt: string; // ISO date
}

/**
 * Document brut déposé par le client (PDF, image, etc.).
 * Un Document peut avoir zéro ou une Invoice liée (après extraction OCR).
 */
export interface Document {
  id: string;
  clientId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;       // 'application/pdf' | 'image/jpeg' | ...
  uploadedAt: string;     // ISO datetime
  status: DocumentStatus;
  invoiceId?: string;     // défini après extraction réussie
}

/**
 * Facture extraite d'un Document par OCR / IA.
 * Toujours liée à un Document parent.
 */
export interface Invoice {
  id: string;
  documentId: string;     // référence au Document source
  clientId: string;       // dénormalisé pour faciliter les requêtes
  invoiceNumber: string;
  supplierName: string;
  date: string;           // ISO date 'YYYY-MM-DD'
  totalAmount: number;    // montant TTC en euros
  vatAmount: number;      // montant TVA en euros
  status: InvoiceStatus;
}

// ─── Helpers de présentation ──────────────────────────────────────────────────

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  to_review: 'À vérifier',
  validated: 'Validée',
  rejected:  'Rejetée',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  uploaded:   'Déposé',
  processing: 'En cours',
  processed:  'Traité',
  error:      'Erreur',
};
