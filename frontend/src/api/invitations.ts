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

export async function createClientInvitation(
  payload: InvitationClientCreatePayload,
): Promise<Invitation> {
  const { data } = await apiClient.post<Invitation>('/invitations/clients', payload);
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
