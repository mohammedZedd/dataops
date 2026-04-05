import apiClient from './axios';
import type { ClientDocument, Invoice } from '../types';

export interface AdminClientDoc {
  id: string;
  file_name: string;
  file_size: number | null;
  uploaded_at: string;
  status: string;
  invoice_id: string | null;
  invoice_status: string | null;
}

export async function getClientDocuments(clientId: string): Promise<AdminClientDoc[]> {
  const { data } = await apiClient.get<AdminClientDoc[]>(`/clients/${clientId}/documents`);
  return data;
}

export async function getMyDocuments(): Promise<ClientDocument[]> {
  const { data } = await apiClient.get<ClientDocument[]>('/documents/my');
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

export async function getPresignedDownloadUrl(id: string): Promise<string> {
  const { data } = await apiClient.get<{ url: string }>(`/documents/download/${id}`);
  return data.url;
}

export async function getPresignedPreviewUrl(id: string): Promise<string> {
  const { data } = await apiClient.get<{ url: string }>(`/documents/preview/${id}`);
  return data.url;
}

export async function uploadDocument(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ClientDocument> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await apiClient.post<ClientDocument>('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress(e) {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
  return data;
}

export async function createInvoiceFromDocument(documentId: string): Promise<Invoice> {
  const { data } = await apiClient.post<Invoice>(`/documents/${documentId}/create-invoice`);
  return data;
}

export interface ExtractionResult {
  invoice_number: string | null;
  date: string | null;
  supplier_name: string | null;
  total_amount: number | null;
  vat_amount: number | null;
  ht_amount: number | null;
  vat_rate: number;
  ice: string | null;
  if_fiscal: string | null;
  rc: string | null;
  tp: string | null;
  cnss: string | null;
  currency: string;
  confidence: number;
  raw_text: string;
}

export async function extractDocumentData(documentId: string): Promise<ExtractionResult> {
  const { data } = await apiClient.post<ExtractionResult>(`/documents/${documentId}/extract`);
  return data;
}
