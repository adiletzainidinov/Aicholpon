import type { TrackEvent } from '../shared/types';

/** Admin "Посмотреть" opens invitations with ?preview=1 – those visits must not inflate the statistics. */
const isPreview = () => {
  try {
    return new URLSearchParams(location.search).get('preview') === '1';
  } catch {
    return false;
  }
};

export function track(event: TrackEvent, token: string | null) {
  if (isPreview()) return;
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
