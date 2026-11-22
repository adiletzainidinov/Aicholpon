import { NextResponse } from 'next/server';
import { adminCall, type AdminAction } from '@/lib/server/data';
import { sameOrigin } from '@/lib/server/rateLimit';
import { clearSession, readSessionPassword } from '@/lib/server/session';
import { UpstreamError } from '@/lib/server/upstream';
import { MAX_NAME } from '@/lib/shared/types';

export const dynamic = 'force-dynamic';
const PRIVATE = { 'Cache-Control': 'private, no-store' };
const ACTIONS: readonly AdminAction[] = ['list', 'stats', 'add', 'rename', 'delete'];

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: PRIVATE });
  const password = await readSessionPassword();
  if (!password) return NextResponse.json({ error: 'Сессия истекла, войдите снова' }, { status: 401, headers: PRIVATE });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  const action = ACTIONS.find((a) => a === body.action);
  if (!action) return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400, headers: PRIVATE });

  const params: Record<string, unknown> = {};
  if (action === 'add' || action === 'rename') {
    const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
    if (!name || name.length > MAX_NAME) return NextResponse.json({ error: 'Введите имя (до 120 символов)' }, { status: 400, headers: PRIVATE });
    params.name = name;
  }
  if (action === 'rename' || action === 'delete') {
    if (typeof body.id !== 'string' || !body.id || body.id.length > 64) {
      return NextResponse.json({ error: 'Неверный идентификатор' }, { status: 400, headers: PRIVATE });
    }
    params.id = body.id;
  }

  try {
    const data = await adminCall(action, password, params);
    return NextResponse.json({ data }, { headers: PRIVATE });
  } catch (e) {
    const err = e instanceof UpstreamError ? e : new UpstreamError('Ошибка сервера');
    if (err.status === 401) await clearSession();
    return NextResponse.json({ error: err.message }, { status: err.status, headers: PRIVATE });
  }
}
