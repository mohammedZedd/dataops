import type { RegisterPayload, TokenResponse, User } from '../types';
import apiClient from './axios';

export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/register', payload);
  return data;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/login', { email, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export async function updateMe(payload: {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  company_name?: string;
}): Promise<User> {
  const { data } = await apiClient.patch<User>('/auth/me', payload);
  return data;
}
