import 'server-only';
import type { Guest, VisitEvent } from '../shared/types';

/** In-memory data used only when AICHOLPON_MOCK=1 (local tests, never production). */
export const MOCK_PASSWORD = 'mock-admin-password';

interface MockDb {
  guests: Guest[];
  events: VisitEvent[];
}

const g = globalThis as unknown as { __aicholponMock?: MockDb };
export const mockDb: MockDb = (g.__aicholponMock ??= {
  guests: [
    { id: 'g1', name: 'Асан ага жана Үсөн эже', invite_token: 'demo-token-1', attending: null, people: null, created_at: new Date().toISOString() },
    { id: 'g2', name: 'Мээрим', invite_token: 'demo-token-2', attending: true, people: 2, created_at: new Date().toISOString() },
    { id: 'g3', name: 'Бакыт', invite_token: 'demo-token-3', attending: false, people: 0, created_at: new Date().toISOString() },
  ],
  events: [],
});

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Buffer.from(bytes).toString('base64url');
}
