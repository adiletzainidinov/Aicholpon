'use client';

import { useEffect, useRef, useState } from 'react';
import { EVENT } from '@/lib/shared/event';

const TARGET = new Date(EVENT.startsAtIso).getTime();

function parts(now: number) {
  const s = Math.max(0, Math.floor((TARGET - now) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Live countdown; ticks only while visible on screen. */
export function Countdown() {
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let timer = 0;
    const tick = () => setNow(Date.now());
    const io = new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e?.isIntersecting) {
        tick();
        timer = window.setInterval(tick, 1000);
      }
    });
    if (ref.current) io.observe(ref.current);
    tick();
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  }, []);
  const p = now === null ? null : parts(now);
  const cells: [number | undefined, string][] = [
    [p?.d, 'күн'],
    [p?.h, 'саат'],
    [p?.m, 'мүнөт'],
    [p?.s, 'секунд'],
  ];
  return (
    <div ref={ref} className="count" role="timer" aria-label="Тойго чейин калган убакыт">
      {cells.map(([v, label]) => (
        <div key={label}>
          <b suppressHydrationWarning>{v === undefined ? '—' : String(v).padStart(label === 'күн' ? 1 : 2, '0')}</b>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}
