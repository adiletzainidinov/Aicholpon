import { NextResponse } from 'next/server';
import { adminCall } from '@/lib/server/data';
import { clientIp, loginAllowed, recordFailure, recordSuccess, sameOrigin } from '@/lib/server/rateLimit';
import { clearSession, readSessionPassword, writeSession } from '@/lib/server/session';
import { UpstreamError } from '@/lib/server/upstream';

export const dynamic = 'force-dynamic';
const PRIVATE = { 'Cache-Control': 'private, no-store' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Is there a valid session? */
export async function GET() {
  const password = await readSessionPassword();
  return NextResponse.json({ authenticated: Boolean(password) }, { headers: PRIVATE });
}

/** Log in with the existing admin password (verified by the Supabase Edge Function). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: PRIVATE });
  const ip = clientIp(req.headers);
  const gate = loginAllowed(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { error: `Слишком много попыток. Повторите через ${Math.ceil(gate.retryAfter / 60)} мин.` },
      { status: 429, headers: { ...PRIVATE, 'Retry-After': String(gate.retryAfter) } },
    );
  }
  let password = '';
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    /* empty */
  }
  if (!password || password.length > 200) {
    return NextResponse.json({ error: 'Введите пароль' }, { status: 400, headers: PRIVATE });
  }
  try {
    await adminCall('stats', password);
  } catch (e) {
    if (e instanceof UpstreamError && e.status >= 500) {
      return NextResponse.json({ error: 'Сервер недоступен, попробуйте позже' }, { status: 503, headers: PRIVATE });
    }
    recordFailure(ip);
    await sleep(700 + Math.random() * 500);
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401, headers: PRIVATE });
  }
  recordSuccess(ip);
  await writeSession(password);
  return NextResponse.json({ ok: true }, { headers: PRIVATE });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: PRIVATE });
  await clearSession();
  return NextResponse.json({ ok: true }, { headers: PRIVATE });
}
