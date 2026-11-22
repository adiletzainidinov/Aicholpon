import 'server-only';
import { MOCK_MODE } from './config';
import { MOCK_PASSWORD, mockDb, randomToken } from './mock';
import { edge, rpc, UpstreamError } from './upstream';
import type { Guest, RsvpPayload, TrackEvent, VisitEvent } from '../shared/types';

export async function getInvitee(token: string): Promise<{ name: string } | null> {
  if (MOCK_MODE) {
    const guest = mockDb.guests.find((x) => x.invite_token === token);
    return guest ? { name: guest.name } : null;
  }
  const rows = await rpc('aicholpon_invitee', { p_token: token });
  const first = Array.isArray(rows) ? (rows[0] as { name?: unknown } | undefined) : undefined;
  return first && typeof first.name === 'string' ? { name: first.name } : null;
}

export async function submitRsvp(p: RsvpPayload): Promise<void> {
  if (MOCK_MODE) {
    const guest = p.token ? mockDb.guests.find((x) => x.invite_token === p.token) : undefined;
    if (guest) Object.assign(guest, { attending: p.attending, people: p.people, responded_at: new Date().toISOString() });
    else mockDb.guests.push({ id: crypto.randomUUID(), name: p.name, invite_token: randomToken(), attending: p.attending, people: p.people });
    return;
  }
  const res = (await edge('aicholpon-submit', p)) as { ok?: boolean; error?: string } | null;
  if (!res?.ok) throw new UpstreamError(res?.error ?? 'Жооп сакталган жок');
}

export async function trackEvent(event: TrackEvent, token: string | null, userAgent: string | null): Promise<void> {
  if (MOCK_MODE) {
    mockDb.events.push({ event_type: event, token, created_at: new Date().toISOString() });
    return;
  }
  await edge('aicholpon-track', { event, token }, userAgent ? { 'User-Agent': userAgent.slice(0, 300) } : undefined);
}

export type AdminAction = 'list' | 'stats' | 'add' | 'rename' | 'delete';

/** Calls the existing admin Edge Function. The password is verified server-side by Supabase. */
export async function adminCall(action: AdminAction, password: string, params: Record<string, unknown> = {}): Promise<unknown> {
  if (MOCK_MODE) return mockAdmin(action, password, params);
  const res = (await edge('aicholpon-client-admin', { action, password, ...params })) as { data?: unknown; error?: string } | null;
  if (!res) throw new UpstreamError('Ошибка сервера', 502);
  if (res.error) throw new UpstreamError(res.error, /парол|password|unauthor|forbidden|доступ|вход/i.test(res.error) ? 401 : 400);
  return res.data;
}

function mockAdmin(action: AdminAction, password: string, params: Record<string, unknown>): unknown {
  if (password !== MOCK_PASSWORD) throw new UpstreamError('Неверный пароль', 401);
  const id = String(params.id ?? '');
  switch (action) {
    case 'list':
      return [...mockDb.guests].reverse();
    case 'stats':
      return mockDb.events as VisitEvent[];
    case 'add': {
      const guest: Guest = { id: crypto.randomUUID(), name: String(params.name), invite_token: randomToken(), attending: null, people: null, created_at: new Date().toISOString() };
      mockDb.guests.push(guest);
      return guest;
    }
    case 'rename': {
      const guest = mockDb.guests.find((x) => x.id === id);
      if (!guest) throw new UpstreamError('Не найдено', 502);
      guest.name = String(params.name);
      return guest;
    }
    case 'delete':
      mockDb.guests = mockDb.guests.filter((x) => x.id !== id);
      return true;
  }
}
