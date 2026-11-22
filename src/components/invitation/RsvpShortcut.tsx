'use client';

import { useEffect, useState } from 'react';

/**
 * A quiet "Жооп берүү" pill: appears once the guest has left the first scene and
 * hides while the RSVP form (or the final scene) is on screen. One tap glides to the form.
 */
export function RsvpShortcut() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const form = document.getElementById('rsvp');
    let formVisible = false;
    const io = form
      ? new IntersectionObserver(([e]) => {
          formVisible = Boolean(e && (e.isIntersecting || e.boundingClientRect.top < 0));
          update();
        }, { rootMargin: '0px 0px -30% 0px' })
      : null;
    if (form) io?.observe(form);
    let raf = 0;
    function update() {
      setShow(window.scrollY > window.innerHeight * 0.6 && !formVisible);
    }
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const go = () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('rsvp')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <button type="button" className="rsvp-shortcut" data-show={show} onClick={go} tabIndex={show ? 0 : -1} aria-hidden={!show}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.4 3 4.8 6.6 4.8c2 0 3.6 1.1 5.4 3 1.8-1.9 3.4-3 5.4-3 3.6 0 5.7 3.6 4.2 6.9C19.5 16.4 12 21 12 21Z" />
      </svg>
      Жооп берүү
    </button>
  );
}
