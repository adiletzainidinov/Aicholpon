import type { Guest, VisitEvent } from '@/lib/shared/types';

export class AuthError extends Error {}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const j = (await r.json().catch(() => ({}))) as { data?: T; error?: string };
  if (r.status === 401) throw new AuthError(j.error || 'Требуется вход');
  if (!r.ok) throw new Error(j.error || `Ошибка (${r.status})`);
  return j.data as T;
}

export const adminApi = {
  session: async () => ((await (await fetch('/api/admin/session', { cache: 'no-store' })).json()) as { authenticated: boolean }).authenticated,
  login: async (password: string) => {
    const r = await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new Error(j.error || 'Ошибка входа');
  },
  logout: () => fetch('/api/admin/session', { method: 'DELETE' }),
  list: () => post<Guest[]>('/api/admin', { action: 'list' }),
  stats: () => post<VisitEvent[]>('/api/admin', { action: 'stats' }),
  add: (name: string) => post<unknown>('/api/admin', { action: 'add', name }),
  rename: (id: string, name: string) => post<unknown>('/api/admin', { action: 'rename', id, name }),
  remove: (id: string) => post<unknown>('/api/admin', { action: 'delete', id }),
};

export const inviteLink = (g: Guest) => `${location.origin}/?token=${encodeURIComponent(g.invite_token)}`;
