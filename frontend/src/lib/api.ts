import { getFirebaseAuth } from '@/lib/firebase/client';
import { User, Listing, Transaction } from '@/lib/types';

async function authHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Non connecté');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(path, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Erreur API');
  }
  return data as T;
}

export const authApi = {
  register: (body: object) =>
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      return data as { user: User };
    }),
  me: () => api<{ user: User }>('/api/auth/me'),
};

export const txApi = {
  transfer: (body: { recipientEmail: string; amount: number }) =>
    api<{ balance: number }>('/api/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const listingsApi = {
  list: (params?: string) =>
    fetch(`/api/listings${params ? `?${params}` : ''}`).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      return data as { listings: import('./types').Listing[] };
    }),
  create: (body: object) =>
    api<{ id: string }>('/api/listings', { method: 'POST', body: JSON.stringify(body) }),
  accept: (id: string) =>
    api<{ missionId: string }>(`/api/listings/${id}/accept`, { method: 'POST' }),
  completeMission: (id: string) =>
    api<{ message: string }>(`/api/listings/missions/${id}/complete`, { method: 'POST' }),
};

export const userApi = {
  dashboard: () =>
    api<{
      transactions: import('./types').Transaction[];
      listings: import('./types').Listing[];
      missions: import('./types').Mission[];
    }>('/api/user/dashboard'),
};

export const chatApi = {
  list: (missionId: string) =>
    api<{ messages: import('./types').MissionMessage[] }>(`/api/missions/${missionId}/messages`),
  send: (missionId: string, text: string) =>
    api<{ message: import('./types').MissionMessage }>(`/api/missions/${missionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  markRead: (missionId: string) =>
    api<{ ok: boolean }>(`/api/missions/${missionId}/read`, { method: 'POST' }),
};

export const adminApi = {
  users: () => api<{ users: User[] }>('/api/admin/users'),
  transactions: () => api<{ transactions: Transaction[] }>('/api/admin/transactions'),
  listings: () => api<{ listings: Listing[] }>('/api/admin/listings'),
  adjustBalance: (id: string, amount: number, action: 'add' | 'remove') =>
    api<{ user: User }>(`/api/admin/users/${id}/balance`, {
      method: 'PATCH',
      body: JSON.stringify({ amount, action }),
    }),
  deleteUser: (id: string) => api<{ message: string }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  moderateListing: (id: string, status: string) =>
    api<{ listing: Listing }>(`/api/admin/listings/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
