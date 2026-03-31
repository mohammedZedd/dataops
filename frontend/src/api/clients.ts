import apiClient from './axios';
import type { Client } from '../types';

// ─── Lecture ──────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  try {
    const { data } = await apiClient.get<Client[]>('/clients');
    return data;
  } catch (error) {
    console.error('[clients] getClients :', error);
    throw new Error('Impossible de charger la liste des clients.');
  }
}

export async function getClient(id: string): Promise<Client> {
  try {
    const { data } = await apiClient.get<Client>(`/clients/${id}`);
    return data;
  } catch (error) {
    console.error(`[clients] getClient(${id}) :`, error);
    throw new Error('Client introuvable.');
  }
}

// ─── Écriture ─────────────────────────────────────────────────────────────────

export async function createClient(name: string): Promise<Client> {
  try {
    const { data } = await apiClient.post<Client>('/clients', { name: name.trim() });
    return data;
  } catch (error) {
    console.error('[clients] createClient :', error);
    throw new Error("Impossible de créer le client.");
  }
}

export async function updateClient(
  id: string,
  payload: Partial<Pick<Client, 'name' | 'siret' | 'email'>>,
): Promise<Client> {
  try {
    const { data } = await apiClient.patch<Client>(`/clients/${id}`, payload);
    return data;
  } catch (error) {
    console.error(`[clients] updateClient(${id}) :`, error);
    throw new Error('Impossible de mettre à jour le client.');
  }
}

export async function deleteClient(id: string): Promise<void> {
  try {
    await apiClient.delete(`/clients/${id}`);
  } catch (error) {
    console.error(`[clients] deleteClient(${id}) :`, error);
    throw new Error('Impossible de supprimer le client.');
  }
}
