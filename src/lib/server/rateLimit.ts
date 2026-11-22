import 'server-only';

/**
 * Login brute-force protection: sliding window per client IP plus a global
 * ceiling. Serverless instances do not share memory, so this is a best-effort
 * layer; every failed attempt is also slowed down, which bounds the attempt rate
 * per connection regardless of the instance.
 */
const WINDOW_MS = 15 * 60_000;
const PER_IP = 8;
const GLOBAL = 60;

const g = globalThis as unknown as { __aichLogin?: Map<string, number[]> };
const attempts = (g.__aichLogin ??= new Map());

function prune(list: number[], now: number) {
  while (list.length && now - list[0]! > WINDOW_MS) list.shift();
  return list;
}

export function loginAllowed(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const mine = prune(attempts.get(ip) ?? [], now);
  const all = prune(attempts.get('*') ?? [], now);
  if (mine.length >= PER_IP || all.length >= GLOBAL) {
    const oldest = Math.min(mine[0] ?? now, all[0] ?? now);
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - oldest)) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function recordFailure(ip: string) {
  const now = Date.now();
  attempts.set(ip, [...(attempts.get(ip) ?? []), now]);
  attempts.set('*', [...(attempts.get('*') ?? []), now]);
  if (attempts.size > 5000) attempts.clear();
}

export function recordSuccess(ip: string) {
  attempts.delete(ip);
}

export function clientIp(headers: Headers): string {
  return headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** Same-origin check for state-changing requests (defence-in-depth on top of SameSite=Strict). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site';
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}
