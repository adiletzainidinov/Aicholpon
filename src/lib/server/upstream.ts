import 'server-only';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, UPSTREAM_TIMEOUT_MS } from './config';

export class UpstreamError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

async function request(path: string, body: unknown, withKey: boolean, extraHeaders?: HeadersInit): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withKey) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  let res: Response;
  try {
    res = await fetch(SUPABASE_URL + path, {
      method: 'POST',
      headers: { ...headers, ...(extraHeaders as Record<string, string> | undefined) },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    throw new UpstreamError('Сервер жеткиликсиз. Кайра аракет кылыңыз.', 503);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
        ? (json as { error: string }).error
        : `Ошибка сервера (${res.status})`;
    // keep "the request itself was rejected" (4xx, e.g. a malformed token) apart from outages (5xx)
    throw new UpstreamError(msg, res.status === 401 || res.status === 403 ? 401 : res.status >= 400 && res.status < 500 ? 400 : 502);
  }
  return json;
}

export const rpc = (fn: string, body: unknown) => request(`/rest/v1/rpc/${fn}`, body, true);
export const edge = (fn: string, body: unknown, headers?: HeadersInit) =>
  request(`/functions/v1/${fn}`, body, false, { Origin: 'https://aicholpon.vercel.app', ...(headers as Record<string, string> | undefined) });
