import { NextResponse } from 'next/server';
import { trackEvent } from '@/lib/server/data';
import { isValidToken } from '@/lib/shared/rsvp';
import type { TrackEvent } from '@/lib/shared/types';

export const dynamic = 'force-dynamic';
const EVENTS: readonly TrackEvent[] = ['view', 'open', 'rsvp_yes', 'rsvp_no'];

export async function POST(req: Request) {
  let body: { event?: unknown; token?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* ignore */
  }
  const event = EVENTS.find((e) => e === body.event);
  if (!event) return new NextResponse(null, { status: 204 });
  if (req.headers.get('sec-fetch-site') === 'cross-site') return new NextResponse(null, { status: 204 });
  try {
    await trackEvent(event, isValidToken(body.token) ? body.token : null, req.headers.get('user-agent'));
  } catch {
    /* analytics must never break the page */
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
