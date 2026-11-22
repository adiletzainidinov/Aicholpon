'use client';

import { useEffect, useRef, useState } from 'react';

/** "Scroll down" hint: tapping glides to the next scene; it fades away once the guest starts scrolling. */
export function ScrollCue() {
  const ref = useRef<HTMLButtonElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setHidden(window.scrollY > 48));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const go = () => {
    const next = ref.current?.closest('section')?.nextElementSibling as HTMLElement | null;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (next) next.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    else window.scrollBy({ top: window.innerHeight * 0.9, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <button ref={ref} type="button" className="scroll-cue" data-hidden={hidden} onClick={go} aria-label="Кийинки бөлүмгө өтүү">
      <span className="scroll-cue__label">Төмөн сыдырыңыз</span>
      <span className="scroll-cue__arrows" aria-hidden>
        <svg viewBox="0 0 24 12" width="22" height="11">
          <path d="M3 2.5l9 7 9-7" />
        </svg>
        <svg viewBox="0 0 24 12" width="22" height="11">
          <path d="M3 2.5l9 7 9-7" />
        </svg>
      </span>
    </button>
  );
}
