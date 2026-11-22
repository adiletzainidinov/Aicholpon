import { NextResponse } from 'next/server';
import { getInvitee } from '@/lib/server/data';
import { isValidToken } from '@/lib/shared/rsvp';

export const dynamic = 'force-dynamic';
const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!isValidToken(token)) return NextResponse.json({ error: 'invalid_token' }, { status: 400, headers: PRIVATE });
  try {
    const guest = await getInvitee(token);
    if (!guest) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: PRIVATE });
    return NextResponse.json({ name: guest.name }, { headers: PRIVATE });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: PRIVATE });
  }
}
