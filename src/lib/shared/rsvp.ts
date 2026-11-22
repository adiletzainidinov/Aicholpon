import { MAX_NAME, MAX_PEOPLE, type RsvpPayload } from './types';

/** Normalises and validates an RSVP payload. Declining always stores 0 people. */
export function normaliseRsvp(input: unknown): { ok: true; value: RsvpPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Маалымат туура эмес' };
  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim() : '';
  if (!name) return { ok: false, error: 'Атыңызды жазыңыз' };
  if (name.length > MAX_NAME) return { ok: false, error: 'Аты өтө узун' };
  if (typeof raw.attending !== 'boolean') return { ok: false, error: 'Жоопту тандаңыз' };
  const attending = raw.attending;
  let people = 0;
  if (attending) {
    const n = Number(raw.people);
    people = Number.isFinite(n) ? Math.min(MAX_PEOPLE, Math.max(1, Math.round(n))) : 1;
  }
  const token = typeof raw.token === 'string' && /^[A-Za-z0-9_-]{4,128}$/.test(raw.token) ? raw.token : null;
  return { ok: true, value: { token, name, attending, people } };
}

export function isValidToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{4,128}$/.test(token);
}
