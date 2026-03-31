import apiClient from './axios';
import type { Document, Invoice } from '../types';

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocumentsByClient(clientId: string): Promise<Document[]> {
  try {
    const { data } = await apiClient.get<Document[]>(`/clients/${clientId}/documents`);
    return data;
  } catch (error) {
    console.error(`[invoices] getDocumentsByClient(${clientId}) :`, error);
    throw new Error('Impossible de charger les documents.');
  }
}

export async function getDocument(id: string): Promise<Document> {
  try {
    const { data } = await apiClient.get<Document>(`/documents/${id}`);
    return data;
  } catch (error) {
    console.error(`[invoices] getDocument(${id}) :`, error);
    throw new Error('Document introuvable.');
  }
}

// ─── Factures ─────────────────────────────────────────────────────────────────

/**
 * Récupère les factures d'un client.
 *
 * Si FastAPI expose GET /clients/{id}/invoices → utiliser directement.
 * Si non, passer par les documents puis récupérer les invoices liées.
 * Ici on suppose que l'endpoint /clients/{id}/invoices existe.
 */
export async function getInvoicesByClient(clientId: string): Promise<Invoice[]> {
  try {
    const { data } = await apiClient.get<Invoice[]>(`/clients/${clientId}/invoices`);
    return data;
  } catch (error) {
    console.error(`[invoices] getInvoicesByClient(${clientId}) :`, error);
    throw new Error('Impossible de charger les factures.');
  }
}

export async function getInvoice(id: string): Promise<Invoice> {
  try {
    const { data } = await apiClient.get<Invoice>(`/invoices/${id}`);
    return data;
  } catch (error) {
    console.error(`[invoices] getInvoice(${id}) :`, error);
    throw new Error('Facture introuvable.');
  }
}

export async function updateInvoice(
  id: string,
  payload: Partial<Omit<Invoice, 'id' | 'clientId' | 'documentId'>>,
): Promise<Invoice> {
  try {
    const { data } = await apiClient.patch<Invoice>(`/invoices/${id}`, payload);
    return data;
  } catch (error) {
    console.error(`[invoices] updateInvoice(${id}) :`, error);
    throw new Error('Impossible de mettre à jour la facture.');
  }
}

/**
 * Valide une facture via PATCH /invoices/{id}.
 * Si FastAPI expose POST /invoices/{id}/validate, remplacer par :
 *   const { data } = await apiClient.post<Invoice>(`/invoices/${id}/validate`);
 */
export async function validateInvoice(id: string): Promise<Invoice> {
  try {
    const { data } = await apiClient.patch<Invoice>(`/invoices/${id}`, { status: 'validated' });
    return data;
  } catch (error) {
    console.error(`[invoices] validateInvoice(${id}) :`, error);
    throw new Error('Impossible de valider la facture.');
  }
}

export async function rejectInvoice(id: string): Promise<Invoice> {
  try {
    const { data } = await apiClient.patch<Invoice>(`/invoices/${id}`, { status: 'rejected' });
    return data;
  } catch (error) {
    console.error(`[invoices] rejectInvoice(${id}) :`, error);
    throw new Error('Impossible de rejeter la facture.');
  }
}
