'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { airShimmer } from '@/lib/client/audio';

/**
 * Scroll-triggered entrance for a section (no animation library on the critical path):
 * [data-reveal] children rise in with a soft blur (staggered CSS transitions),
 * calligraphy marked .write is "written" by an animated mask (@property --reveal),
 * SVG paths marked [data-draw] are drawn with stroke-dashoffset.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll<SVGPathElement>('[data-draw]').forEach((p) => {
      const len = Math.ceil(p.getTotalLength());
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        el.querySelectorAll<HTMLElement>('[data-reveal]').forEach((item, i) => {
          item.style.transitionDelay = `${i * 120}ms`;
        });
        el.querySelectorAll<HTMLElement>('.write').forEach((w, i) => {
          w.style.transitionDelay = `${150 + i * 250}ms`;
          window.setTimeout(() => (w.dataset.done = 'true'), 2300 + i * 250);
        });
        el.classList.add('is-in');
        airShimmer();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className ?? ''}`}>
      {children}
    </div>
  );
}
