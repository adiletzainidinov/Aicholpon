import 'server-only';
import { cookies } from 'next/headers';

/**
 * Admin session.
 *
 * The real password check happens in the Supabase Edge Function, which needs the
 * password on every call. We therefore keep it in an httpOnly, Secure,
 * SameSite=Strict cookie scoped to /api/admin – never readable by page JS
 * (unlike the old sessionStorage approach). When ADMIN_SESSION_SECRET is set the
 * value is additionally encrypted with AES-256-GCM.
 */
export const SESSION_COOKIE = 'aicholpon_admin';
const MAX_AGE = 60 * 60 * 12; // 12h

async function key(): Promise<CryptoKey | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(password: string): Promise<string> {
  const issued = Math.floor(Date.now() / 1000);
  const plain = JSON.stringify({ p: password, iat: issued });
  const k = await key();
  if (!k) return 'p.' + Buffer.from(plain).toString('base64url');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(plain)));
  return 'e.' + Buffer.from(iv).toString('base64url') + '.' + Buffer.from(enc).toString('base64url');
}

async function unseal(value: string): Promise<string | null> {
  try {
    let plain: string;
    if (value.startsWith('e.')) {
      const k = await key();
      if (!k) return null;
      const [, ivB64, dataB64] = value.split('.');
      const out = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: Buffer.from(ivB64 ?? '', 'base64url') },
        k,
        Buffer.from(dataB64 ?? '', 'base64url'),
      );
      plain = new TextDecoder().decode(out);
    } else if (value.startsWith('p.')) {
      if (await key()) return null; // once a secret is configured, refuse unencrypted cookies
      plain = Buffer.from(value.slice(2), 'base64url').toString();
    } else return null;
    const parsed = JSON.parse(plain) as { p?: unknown; iat?: unknown };
    if (typeof parsed.p !== 'string' || typeof parsed.iat !== 'number') return null;
    if (Date.now() / 1000 - parsed.iat > MAX_AGE) return null;
    return parsed.p;
  } catch {
    return null;
  }
}

export async function readSessionPassword(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value ? unseal(value) : null;
}

export async function writeSession(password: string) {
  (await cookies()).set(SESSION_COOKIE, await seal(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/api/admin', maxAge: 0 });
}
