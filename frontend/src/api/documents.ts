import apiClient from './axios';
import type { ClientDocument } from '../types';

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
