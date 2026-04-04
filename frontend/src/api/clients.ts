import apiClient from './axios';
import type { Client, ClientUser } from '../types';

// ─── Lecture ──────────────────────────────────────────────────────────────────

export async function getClientUsers(): Promise<ClientUser[]> {
  try {
    const { data } = await apiClient.get<ClientUser[]>('/clients/users');
    return data;
  } catch (error) {
    console.error('[clients] getClientUsers :', error);
    throw new Error('Impossible de charger la liste des clients.');
  }
}

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

export async function revokeClientAccess(userId: string): Promise<void> {
  try {
    await apiClient.patch(`/users/${userId}`, { is_active: false });
  } catch (error) {
    console.error(`[clients] revokeClientAccess(${userId}) :`, error);
    throw new Error("Impossible de révoquer l'accès du client.");
  }
}

export async function updateClientUser(
  userId: string,
  payload: {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    company_name?: string;
    secteur_activite?: string;
  },
): Promise<ClientUser> {
  try {
    const { data } = await apiClient.patch<ClientUser>(`/users/${userId}`, payload);
    return data;
  } catch (error) {
    console.error(`[clients] updateClientUser(${userId}) :`, error);
    throw new Error('Impossible de mettre à jour les informations du client.');
  }
}
