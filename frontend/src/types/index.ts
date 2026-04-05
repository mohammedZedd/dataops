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
  client_company_name?: string | null;
  phone_number?: string | null;
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
  company_name?: string | null;
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
  first_name: string;
  last_name: string;
  phone_number: string;
  password: string;
}

// ─── Statuts ──────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | 'uploaded'    // fichier reçu, pas encore traité
  | 'processing'  // extraction OCR en cours
  | 'processed'   // extraction terminée
  | 'error';      // échec d'extraction

export interface ClientDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  uploaded_at: string;
  status: DocumentStatus;
}

export type InvoiceStatus =
  | 'to_review'   // données extraites, attente vérification humaine
  | 'validated'   // validée par le comptable
  | 'rejected';   // rejetée (erreur de saisie / doublon)

export type InvoiceDirection = 'achat' | 'vente';

// ─── Entités métier ───────────────────────────────────────────────────────────

/**
 * User avec role CLIENT vu par le cabinet (issu du système d'invitation).
 */
export interface ClientUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  client_id?: string | null;
  client_company_name?: string | null;
  secteur_activite?: string | null;
  regime_fiscal?: string | null;
  forme_juridique?: string | null;
  documents_count?: number;
  is_active: boolean;
  created_at: string;
}

/**
 * Client du cabinet comptable.
 */
export interface Client {
  id: string;
  name: string;
  siret?: string;
  email?: string;
  secteur_activite?: string | null;
  regime_fiscal?: string | null;
  forme_juridique?: string | null;
  documents_count: number;
  invoices_to_review: number;
  created_at: string;
}

/**
 * Document brut déposé par le client (PDF, image, etc.).
 */
export interface Document {
  id: string;
  clientId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
  status: DocumentStatus;
  invoiceId?: string;
}

/**
 * Facture extraite d'un Document par OCR / IA.
 * Champs en snake_case pour correspondre à l'API FastAPI.
 */
export interface Invoice {
  id: string;
  document_id: string;
  invoice_number: string;
  supplier_name: string;
  date: string;           // ISO date 'YYYY-MM-DD'
  total_amount: number;   // montant TTC
  vat_amount: number;     // montant TVA
  status: InvoiceStatus;
  direction?: InvoiceDirection | null;
  tva_rate?: number;
  accounting_validated?: boolean;
  validated_accounts?: AccountEntry[] | null;
}

// ─── Accounting suggestion types ──────────────────────────────────────────────

export interface AccountSuggestion {
  code: string;
  libelle: string;
  type: 'charge' | 'tva' | 'tiers' | 'produit';
  sens: 'debit' | 'credit';
  montant: number;
  is_primary: boolean;
  obligatoire: boolean;
}

export interface RetenueSource {
  applicable: boolean;
  taux: number;
  compte: string | null;
  libelle: string | null;
  note: string | null;
}

export interface SuggestedAccountsResponse {
  direction: InvoiceDirection;
  journal: string;
  tva_rate: number;
  tva_regime: string;
  secteur: string | null;
  regime_fiscal: string | null;
  retenue_source: RetenueSource;
  suggested_accounts: AccountSuggestion[];
}

export interface AccountEntry {
  code: string;
  libelle: string;
  type: string;
  sens: string;
  montant: number;
  validated: boolean;
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

export const SECTEURS_ACTIVITE = [
  'Commerce général (import/export, négoce)',
  'Commerce de détail',
  'Grande distribution',
  'Import / Export',
  'BTP (Bâtiment et Travaux Publics)',
  'Promotion immobilière',
  'Services informatiques et numérique',
  'Conseil et expertise comptable',
  'Professions libérales (médecin, avocat, architecte, notaire)',
  'Transport routier de marchandises',
  'Transport de voyageurs',
  'Logistique et entreposage',
  'Industrie manufacturière',
  'Industrie agroalimentaire',
  'Agriculture et élevage',
  'Pêche et aquaculture',
  'Mines et carrières',
  'Artisanat',
  'Hôtellerie et hébergement',
  'Restauration et cafés',
  'Télécommunications',
  'Banque et établissements de crédit',
  'Assurance',
  'Santé (cliniques, cabinets médicaux)',
  'Pharmacie et parapharmacie',
  'Education et formation professionnelle',
  'Média et communication',
  'Énergie et environnement',
  'Autre',
] as const;

export const REGIMES_FISCAUX = [
  'Résultat net réel (RNR)',
  'Résultat net simplifié (RNS)',
  'Forfait',
  'Auto-entrepreneur',
  'Exonéré (zones franches, CFC, etc.)',
] as const;

export const FORMES_JURIDIQUES = [
  'SARL (Société à Responsabilité Limitée)',
  'SA (Société Anonyme)',
  'SNC (Société en Nom Collectif)',
  'SCS (Société en Commandite Simple)',
  'Auto-entrepreneur',
  'Personne physique (commerçant)',
  'Association',
  'Coopérative',
  'Succursale étrangère',
] as const;
