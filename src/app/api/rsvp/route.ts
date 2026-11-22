import { NextResponse } from 'next/server';
import { submitRsvp } from '@/lib/server/data';
import { sameOrigin } from '@/lib/server/rateLimit';
import { UpstreamError } from '@/lib/server/upstream';
import { normaliseRsvp } from '@/lib/shared/rsvp';

export const dynamic = 'force-dynamic';
const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403, headers: PRIVATE });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Маалымат туура эмес' }, { status: 400, headers: PRIVATE });
  }
  const parsed = normaliseRsvp(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers: PRIVATE });
  try {
    await submitRsvp(parsed.value);
    return NextResponse.json({ ok: true, people: parsed.value.people }, { headers: PRIVATE });
  } catch (e) {
    const message = e instanceof UpstreamError ? e.message : 'Жооп сакталган жок';
    return NextResponse.json({ ok: false, error: message }, { status: 502, headers: PRIVATE });
  }
}
