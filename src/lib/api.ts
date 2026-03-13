// ─── Central API Client ───────────────────────────────────────────────────────
// All calls to the FastAPI backend go through this file.
// Tokens are stored in localStorage and auto-refreshed on 401.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

const KEYS = {
  access:  'cf_access_token',
  refresh: 'cf_refresh_token',
  user:    'cf_user',
} as const;

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.access);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveSession(data: LoginResponse) {
  localStorage.setItem(KEYS.access,  data.accessToken);
  localStorage.setItem(KEYS.refresh, data.refreshToken);
  localStorage.setItem(KEYS.user,    JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem(KEYS.access);
  localStorage.removeItem(KEYS.refresh);
  localStorage.removeItem(KEYS.user);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'trainer' | 'client';
  name: string;
  trainerId?: string;
  clientId?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

let _refreshing: Promise<boolean> | null = null;

async function _doRefresh(): Promise<boolean> {
  const token = localStorage.getItem(KEYS.refresh);
  if (!token) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!res.ok) { clearSession(); return false; }
    const body = await res.json();
    localStorage.setItem(KEYS.access,  body.data.accessToken);
    localStorage.setItem(KEYS.refresh, body.data.refreshToken);
    return true;
  } catch { clearSession(); return false; }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...init } = options;

  const makeHeaders = () => {
    const h: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };
    if (!(init.body instanceof FormData)) {
      h['Content-Type'] = 'application/json';
    }
    if (!skipAuth) {
      const tok = getAccessToken();
      if (tok) h['Authorization'] = `Bearer ${tok}`;
    }
    return h;
  };

  let res = await fetch(`${BASE}${path}`, { ...init, headers: makeHeaders() });

  // Auto-refresh on 401
  if (res.status === 401 && !skipAuth) {
    if (!_refreshing) _refreshing = _doRefresh().finally(() => { _refreshing = null; });
    const ok = await _refreshing;
    if (ok) {
      res = await fetch(`${BASE}${path}`, { ...init, headers: makeHeaders() });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, code: body?.error?.code });
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return json.data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? 'Invalid credentials');
  }
  const json = await res.json();
  const data = json.data as LoginResponse;
  saveSession(data);
  return data;
}

export async function apiLogout(): Promise<void> {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  clearSession();
}

export async function apiMe(): Promise<User> {
  return apiFetch<User>('/auth/me');
}

// ── Public endpoints (no auth) ────────────────────────────────────────────────

export async function fetchPosts(params?: { category?: string; tag?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.category) q.set('category', params.category);
  if (params?.tag)      q.set('tag', params.tag);
  if (params?.limit)    q.set('limit', String(params.limit));
  if (params?.offset)   q.set('offset', String(params.offset));
  return apiFetch<any[]>(`/posts?${q}`, { skipAuth: true });
}

export async function fetchPost(slug: string) {
  return apiFetch<any>(`/posts/${slug}`, { skipAuth: true });
}

export async function fetchTeam() {
  return apiFetch<any[]>('/team', { skipAuth: true });
}

export async function fetchPlans() {
  return apiFetch<any[]>('/plans', { skipAuth: true });
}

export async function fetchOffers() {
  return apiFetch<any[]>('/offers?active=true', { skipAuth: true });
}

export async function submitEnquiry(data: { name: string; email?: string; phone?: string; plan?: string; message?: string }) {
  return apiFetch('/enquiries', { method: 'POST', body: JSON.stringify(data), skipAuth: true });
}

export async function checkIn(data: { pin: string; memberName: string; memberPhone: string }) {
  return apiFetch<any>('/check-in', { method: 'POST', body: JSON.stringify(data), skipAuth: true });
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

export const admin = {
  // Posts
  listPosts: () => apiFetch<any[]>('/admin/posts'),
  createPost: (data: any) => apiFetch<any>('/admin/posts', { method: 'POST', body: JSON.stringify(data) }),
  updatePost: (id: string, data: any) => apiFetch<any>(`/admin/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePost: (id: string) => apiFetch(`/admin/posts/${id}`, { method: 'DELETE' }),
  uploadPostCover: (id: string, file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return apiFetch<{ url: string }>(`/admin/posts/${id}/cover`, { method: 'POST', body: fd });
  },

  // Team
  listTeam: () => apiFetch<any[]>('/admin/team'),
  createTeamMember: (data: any) => apiFetch<any>('/admin/team', { method: 'POST', body: JSON.stringify(data) }),
  updateTeamMember: (id: string, data: any) => apiFetch<any>(`/admin/team/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeamMember: (id: string) => apiFetch(`/admin/team/${id}`, { method: 'DELETE' }),
  uploadTeamImage: (id: string, file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return apiFetch<{ url: string }>(`/admin/team/${id}/image`, { method: 'POST', body: fd });
  },

  // Offers
  listOffers: () => apiFetch<any[]>('/admin/offers'),
  createOffer: (data: any) => apiFetch<any>('/admin/offers', { method: 'POST', body: JSON.stringify(data) }),
  updateOffer: (id: string, data: any) => apiFetch<any>(`/admin/offers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOffer: (id: string) => apiFetch(`/admin/offers/${id}`, { method: 'DELETE' }),

  // Plans
  listPlans: () => apiFetch<any[]>('/admin/plans'),
  createPlan: (data: any) => apiFetch<any>('/admin/plans', { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (id: string, data: any) => apiFetch<any>(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlan: (id: string) => apiFetch(`/admin/plans/${id}`, { method: 'DELETE' }),

  // Enquiries
  listEnquiries: (params?: { status?: string; read?: boolean; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status !== undefined) q.set('status', params.status);
    if (params?.read !== undefined)   q.set('read', String(params.read));
    if (params?.limit)                q.set('limit', String(params.limit));
    if (params?.offset)               q.set('offset', String(params.offset));
    return apiFetch<any[]>(`/admin/enquiries?${q}`);
  },
  updateEnquiry: (id: string, data: any) => apiFetch<any>(`/admin/enquiries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEnquiry: (id: string) => apiFetch(`/admin/enquiries/${id}`, { method: 'DELETE' }),

  // Duties
  listDuties: (weekStart?: string) => apiFetch<any[]>(`/admin/duties${weekStart ? `?weekStart=${weekStart}` : ''}`),
  createDuty: (data: any) => apiFetch<any>('/admin/duties', { method: 'POST', body: JSON.stringify(data) }),
  updateDuty: (id: string, data: any) => apiFetch<any>(`/admin/duties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDuty: (id: string) => apiFetch(`/admin/duties/${id}`, { method: 'DELETE' }),

  // Class sessions
  listClassSessions: (params?: { trainerId?: string; date?: string }) => {
    const q = new URLSearchParams();
    if (params?.trainerId) q.set('trainerId', params.trainerId);
    if (params?.date)      q.set('date', params.date);
    return apiFetch<any[]>(`/admin/class-sessions?${q}`);
  },

  // Trainer accounts
  listTrainerAccounts: () => apiFetch<any[]>('/admin/trainer-accounts'),
  createTrainerAccount: (data: any) => apiFetch<any>('/admin/trainer-accounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteTrainerAccount: (userId: string) => apiFetch(`/admin/trainer-accounts/${userId}`, { method: 'DELETE' }),
};

// ── Trainer endpoints ─────────────────────────────────────────────────────────

export const trainer = {
  // Duties
  listDuties: (weekStart?: string) => apiFetch<any[]>(`/trainer/duties${weekStart ? `?weekStart=${weekStart}` : ''}`),

  // Class sessions
  listClassSessions: (date?: string) => apiFetch<any[]>(`/trainer/class-sessions${date ? `?date=${date}` : ''}`),
  createClassSession: (data: any) => apiFetch<any>('/trainer/class-sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateClassSession: (id: string, data: any) => apiFetch<any>(`/trainer/class-sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClassSession: (id: string) => apiFetch(`/trainer/class-sessions/${id}`, { method: 'DELETE' }),
  getAttendance: (id: string) => apiFetch<any[]>(`/trainer/class-sessions/${id}/attendance`),

  // Clients
  listClients: (search?: string) => apiFetch<any[]>(`/trainer/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getClient: (id: string) => apiFetch<any>(`/trainer/clients/${id}`),
  createClient: (data: any) => apiFetch<any>('/trainer/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: any) => apiFetch<any>(`/trainer/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: string) => apiFetch(`/trainer/clients/${id}`, { method: 'DELETE' }),
  grantAccess: (clientId: string, data: any) => apiFetch<any>(`/trainer/clients/${clientId}/grant-access`, { method: 'POST', body: JSON.stringify(data) }),

  // PT Sessions
  listSessions: (params?: { clientId?: string; status?: string; date?: string }) => {
    const q = new URLSearchParams();
    if (params?.clientId) q.set('clientId', params.clientId);
    if (params?.status)   q.set('status', params.status);
    if (params?.date)     q.set('date', params.date);
    return apiFetch<any[]>(`/trainer/sessions?${q}`);
  },
  createSession: (data: any) => apiFetch<any>('/trainer/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id: string, data: any) => apiFetch<any>(`/trainer/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSession: (id: string) => apiFetch(`/trainer/sessions/${id}`, { method: 'DELETE' }),

  // Workout plans
  listWorkoutPlans: () => apiFetch<any[]>('/trainer/workout-plans'),
  getWorkoutPlan: (id: string) => apiFetch<any>(`/trainer/workout-plans/${id}`),
  createWorkoutPlan: (data: any) => apiFetch<any>('/trainer/workout-plans', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkoutPlan: (id: string, data: any) => apiFetch<any>(`/trainer/workout-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkoutPlan: (id: string) => apiFetch(`/trainer/workout-plans/${id}`, { method: 'DELETE' }),
  assignClients: (id: string, clientIds: string[]) => apiFetch<any>(`/trainer/workout-plans/${id}/assign`, { method: 'POST', body: JSON.stringify({ clientIds }) }),
  unassignClient: (planId: string, clientId: string) => apiFetch(`/trainer/workout-plans/${planId}/assign/${clientId}`, { method: 'DELETE' }),

  // Progress logs
  listProgress: (clientId: string) => apiFetch<any[]>(`/trainer/clients/${clientId}/progress`),
  addProgress: (clientId: string, data: any) => apiFetch<any>(`/trainer/clients/${clientId}/progress`, { method: 'POST', body: JSON.stringify(data) }),
  deleteProgress: (clientId: string, logId: string) => apiFetch(`/trainer/clients/${clientId}/progress/${logId}`, { method: 'DELETE' }),

  // Availability
  listAvailability: () => apiFetch<any[]>('/trainer/availability'),
  addAvailability: (data: any) => apiFetch<any>('/trainer/availability', { method: 'POST', body: JSON.stringify(data) }),
  deleteAvailability: (id: string) => apiFetch(`/trainer/availability/${id}`, { method: 'DELETE' }),

  // Session requests
  listSessionRequests: (status?: string) => apiFetch<any[]>(`/trainer/session-requests${status ? `?status=${status}` : ''}`),
  respondToRequest: (id: string, status: 'confirmed' | 'rejected') => apiFetch<any>(`/trainer/session-requests/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Messaging
  listConversations: () => apiFetch<any[]>('/conversations'),
  getMessages: (convId: string, limit = 50) => apiFetch<any[]>(`/conversations/${convId}/messages?limit=${limit}`),
  sendMessage: (convId: string, text: string) => apiFetch<any>(`/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
};

// ── Client endpoints ──────────────────────────────────────────────────────────

export const client = {
  listSessions: () => apiFetch<any[]>('/client/sessions'),
  getWorkoutPlan: () => apiFetch<any>('/client/workout-plan'),
  listProgress: () => apiFetch<any[]>('/client/progress'),
  addProgress: (data: any) => apiFetch<any>('/client/progress', { method: 'POST', body: JSON.stringify(data) }),
  getTrainerAvailability: () => apiFetch<any[]>('/client/trainer-availability'),
  listSessionRequests: () => apiFetch<any[]>('/client/session-requests'),
  createSessionRequest: (data: any) => apiFetch<any>('/client/session-requests', { method: 'POST', body: JSON.stringify(data) }),
  listConversations: () => apiFetch<any[]>('/conversations'),
  getMessages: (convId: string, limit = 50) => apiFetch<any[]>(`/conversations/${convId}/messages?limit=${limit}`),
  sendMessage: (convId: string, text: string) => apiFetch<any>(`/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
};

// ── WebSocket helper ──────────────────────────────────────────────────────────

export function openChatSocket(conversationId: string, onMessage: (data: any) => void): WebSocket {
  const wsBase = BASE.replace(/^http/, 'ws');
  const token  = getAccessToken() ?? '';
  const ws     = new WebSocket(`${wsBase}/ws/conversations/${conversationId}?token=${token}`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch { /* ignore */ }
  };
  return ws;
}
