import type { TrackEvent } from '../shared/types';

export function track(event: TrackEvent, token: string | null) {
  try {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, token }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
