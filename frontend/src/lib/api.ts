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
  transfer: (body: { recipientEmail: string; amount: number; confirmEmail?: string }) =>
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
      completedMissions?: import('./types').Mission[];
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

export const premiumApi = {
  usage: () => api<import('./types').PremiumUsage>('/api/premium/usage'),
  checkout: () =>
    api<{ url: string }>('/api/premium/checkout', { method: 'POST', body: '{}' }),
};

export const notificationsApi = {
  list: () =>
    api<{ notifications: import('./types').AppNotification[]; unreadCount: number }>(
      '/api/notifications'
    ),
  markRead: (opts: { ids?: string[]; all?: boolean }) =>
    api<{ ok: boolean }>('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify(opts),
    }),
};

export const presenceApi = {
  heartbeat: () => api<{ ok: boolean }>('/api/user/presence', { method: 'POST', body: '{}' }),
  get: (userId: string) =>
    api<{ isOnline: boolean; lastSeenAt: string | null }>(`/api/user/presence?userId=${userId}`),
};

export const reviewsApi = {
  create: (body: { missionId: string; rating: number; comment?: string }) =>
    api<{ message: string }>('/api/reviews', { method: 'POST', body: JSON.stringify(body) }),
  forUser: (userId: string) =>
    api<{ reviews: import('./types').Review[] }>(`/api/reviews?userId=${userId}`),
};

export const adminApi = {
  stats: () => api<{ stats: import('./types').AdminStats }>('/api/admin/stats'),
  users: (params?: { q?: string; role?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.role) sp.set('role', params.role);
    if (params?.status) sp.set('status', params.status);
    const q = sp.toString();
    return api<{ users: User[] }>(`/api/admin/users${q ? `?${q}` : ''}`);
  },
  userDetail: (id: string) => api<import('./types').AdminUserDetailResponse>(`/api/admin/users/${id}`),
  updateUser: (id: string, body: Record<string, unknown>) =>
    api<{ user: User }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetPassword: (id: string) =>
    api<{ message: string; resetLink: string }>(`/api/admin/users/${id}/reset-password`, { method: 'POST' }),
  setPremium: (id: string, body: { action: 'grant' | 'revoke'; months?: number }) =>
    api<{ message: string; user: User; expiresAt?: string }>(`/api/admin/users/${id}/premium`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  transactions: (params?: { type?: string; minAmount?: number; userId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.set('type', params.type);
    if (params?.minAmount) sp.set('minAmount', String(params.minAmount));
    if (params?.userId) sp.set('userId', params.userId);
    const q = sp.toString();
    return api<{ transactions: Transaction[] }>(`/api/admin/transactions${q ? `?${q}` : ''}`);
  },
  listings: () => api<{ listings: Listing[] }>('/api/admin/listings'),
  missions: () => api<{ missions: import('./types').Mission[] }>('/api/admin/missions'),
  missionMessages: (id: string) =>
    api<{ messages: import('./types').MissionMessage[] }>(`/api/admin/missions/${id}/messages`),
  updateMission: (id: string, status: string) =>
    api<{ message: string }>(`/api/admin/missions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  audit: () => api<{ entries: import('./types').AdminAuditEntry[] }>('/api/admin/audit'),
  announcements: () =>
    api<{ announcements: import('./types').PlatformAnnouncement[] }>('/api/admin/announcements'),
  createAnnouncement: (body: { title: string; message: string; active: boolean }) =>
    api<{ announcement: import('./types').PlatformAnnouncement }>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adjustBalance: (id: string, amount: number, action: 'add' | 'remove') =>
    api<{ user: User }>(`/api/admin/users/${id}/balance`, {
      method: 'PATCH',
      body: JSON.stringify({ amount, action }),
    }),
  deleteUser: (id: string) => api<{ message: string }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  deleteListing: (id: string) => api<{ message: string }>(`/api/admin/listings/${id}`, { method: 'DELETE' }),
  moderateListing: (id: string, status: string) =>
    api<{ listing: Listing }>(`/api/admin/listings/${id}/moderate`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  exportUsersCsv: async () => {
    const headers = await authHeaders();
    const res = await fetch('/api/admin/export/users', { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Export impossible');
    }
    return res.blob();
  },
};
