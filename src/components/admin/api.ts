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

/** Opens the personal invitation without counting it as a guest visit. */
export const previewLink = (g: Guest) => `${inviteLink(g)}&preview=1`;

export const whatsappUrl = (g: Guest) =>
  'https://wa.me/?text=' + encodeURIComponent(`${g.name}, сизди Айчолпондун кыз узатуу тоюна чакырабыз! 💌 ${inviteLink(g)}`);

/** When the guest answered, if the backend stores it (field names differ between versions). */
export function answeredAt(g: Guest): Date | null {
  const raw = g.responded_at ?? g.answered_at ?? g.updated_at ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

export const formatDateTime = (d: Date) =>
  d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const hasAnswered = (g: Guest) => g.attending === true || g.attending === false;

export function exportCsv(guests: Guest[]) {
  const rows = [
    ['Имя', 'Ссылка', 'Ответ', 'Людей', 'Время ответа'],
    ...guests.map((g) => {
      const at = hasAnswered(g) ? answeredAt(g) : null;
      return [g.name, inviteLink(g), g.attending == null ? '' : g.attending ? 'Придёт' : 'Не придёт', g.attending === false ? 0 : (g.people ?? ''), at ? formatDateTime(at) : ''];
    }),
  ];
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'aicholpon-guests.csv';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
