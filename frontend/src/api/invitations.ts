import apiClient from './axios';
import type {
  Invitation,
  InvitationAcceptPayload,
  InvitationAccountantCreatePayload,
  InvitationClientCreatePayload,
  InvitationPublic,
  TokenResponse,
} from '../types';

export async function createAccountantInvitation(
  payload: InvitationAccountantCreatePayload,
): Promise<Invitation> {
  const { data } = await apiClient.post<Invitation>('/invitations/accountants', payload);
  return data;
}

export type ReactivationResponse = { reactivated: true; message: string };

export async function createClientInvitation(
  payload: InvitationClientCreatePayload,
): Promise<Invitation | ReactivationResponse> {
  const { data } = await apiClient.post<Invitation | ReactivationResponse>('/invitations/clients', payload);
  return data;
}

export async function getInvitations(): Promise<Invitation[]> {
  const { data } = await apiClient.get<Invitation[]>('/invitations');
  return data;
}

export async function getInvitationByToken(token: string): Promise<InvitationPublic> {
  const { data } = await apiClient.get<InvitationPublic>(`/invitations/${token}`);
  return data;
}

export async function acceptInvitation(payload: InvitationAcceptPayload): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/invitations/accept', payload);
  return data;
}

export async function resendInvitation(id: string): Promise<void> {
  await apiClient.post(`/invitations/resend/${id}`);
}

export async function revokeInvitation(id: string): Promise<void> {
  await apiClient.delete(`/invitations/${id}`);
}

export interface InvitationUpdatePayload {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: 'accountant' | 'client';
  client_id?: string | null;
  expires_at?: string;  // ISO datetime
}

export async function updateInvitation(
  id: string,
  payload: InvitationUpdatePayload,
  resend = false,
): Promise<Invitation> {
  const { data } = await apiClient.patch<Invitation>(
    `/invitations/${id}${resend ? '?resend=true' : ''}`,
    payload,
  );
  return data;
}
