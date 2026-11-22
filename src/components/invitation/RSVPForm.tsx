'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { track } from '@/lib/client/track';
import { MAX_NAME, MAX_PEOPLE } from '@/lib/shared/types';
import { useGuest } from './GuestContext';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'saved'; attending: boolean; people: number } | { kind: 'error'; message: string };

export function RSVPForm() {
  const guest = useGuest();
  const [name, setName] = useState('');
  const [touchedName, setTouchedName] = useState(false);
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  const [people, setPeople] = useState(1);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [peopleHidden, setPeopleHidden] = useState(true);
  const savedRef = useRef<HTMLDivElement>(null);

  // prefill from the personal link unless the guest already typed something
  useEffect(() => {
    if (guest.name && !touchedName) setName(guest.name);
  }, [guest.name, touchedName]);

  // "Келе албайм" removes the people field entirely (collapsed, then hidden)
  const showPeople = answer === 'yes';
  useEffect(() => {
    if (showPeople) {
      setPeopleHidden(false);
      return;
    }
    const t = setTimeout(() => setPeopleHidden(true), 460);
    return () => clearTimeout(t);
  }, [showPeople]);

  useEffect(() => {
    if (status.kind === 'saved' && savedRef.current) {
      savedRef.current.animate(
        [
          { opacity: 0, transform: 'translateY(10px) scale(0.94)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 800, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
      );
    }
  }, [status.kind]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!answer) {
      setStatus({ kind: 'error', message: 'Жоопту тандаңыз: «Келем» же «Келе албайм».' });
      return;
    }
    const trimmed = name.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      setStatus({ kind: 'error', message: 'Атыңызды жазыңыз.' });
      return;
    }
    const attending = answer === 'yes';
    const count = attending ? Math.min(MAX_PEOPLE, Math.max(1, people)) : 0;
    setStatus({ kind: 'sending' });
    try {
      const r = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guest.token, name: trimmed, attending, people: count }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || 'Жооп сакталган жок');
      track(attending ? 'rsvp_yes' : 'rsvp_no', guest.token);
      setStatus({ kind: 'saved', attending, people: count });
    } catch (err) {
      setStatus({ kind: 'error', message: (err instanceof Error ? err.message : 'Ката') + '. Кайра аракет кылыңыз.' });
    }
  }

  if (status.kind === 'saved') {
    return (
      <div ref={savedRef} className="paper-card" role="status" aria-live="polite" data-testid="rsvp-saved">
        <svg width="56" height="56" viewBox="0 0 56 56" className="mx-auto" aria-hidden>
          <circle cx="28" cy="28" r="26" fill="none" stroke="#c9a55c" strokeWidth="1.5" />
          <path d="M17 29l7 7 15-16" fill="none" stroke="#2f3f7a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-script mt-2 text-[40px] leading-tight">Рахмат!</p>
        <p className="mt-2">
          {status.attending
            ? `Жообуңуз сакталды. Сизди ${status.people > 1 ? `${status.people} киши менен ` : ''}күтөбүз!`
            : 'Жообуңуз сакталды. Келе албасаңыз да, жылуу тилектериңиз үчүн рахмат.'}
        </p>
        <button type="button" className="btn btn--ghost mt-5" onClick={() => setStatus({ kind: 'idle' })}>
          Жоопту өзгөртүү
        </button>
      </div>
    );
  }

  const sending = status.kind === 'sending';
  return (
    <form className="paper-card grid gap-5 text-left" onSubmit={submit} noValidate data-testid="rsvp-form">
      <label className="grid gap-2 text-center">
        <span className="eyebrow">Сиздин атыңыз</span>
        <input
          className="field"
          name="name"
          value={name}
          maxLength={MAX_NAME}
          autoComplete="name"
          placeholder="Атыңыз жана фамилияңыз"
          onChange={(e) => {
            setTouchedName(true);
            setName(e.target.value);
          }}
          required
        />
      </label>

      <fieldset className="grid gap-3 border-0 p-0">
        <legend className="eyebrow mb-3 w-full text-center">Тойго келесизби?</legend>
        <label className="choice">
          <input type="radio" name="answer" value="yes" checked={answer === 'yes'} onChange={() => setAnswer('yes')} />
          <span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#2f3f7a" aria-hidden>
              <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.4 3 4.8 6.6 4.8c2 0 3.6 1.1 5.4 3 1.8-1.9 3.4-3 5.4-3 3.6 0 5.7 3.6 4.2 6.9C19.5 16.4 12 21 12 21Z" />
            </svg>
            Келем
          </span>
        </label>
        <label className="choice">
          <input type="radio" name="answer" value="no" checked={answer === 'no'} onChange={() => setAnswer('no')} />
          <span>Келе албайм</span>
        </label>
      </fieldset>

      <div className="rsvp-collapse" data-open={showPeople} hidden={peopleHidden && !showPeople} aria-hidden={!showPeople} data-testid="people-wrap">
        <div>
          <div className="grid justify-items-center gap-2 pb-1 pt-1">
            <span className="eyebrow">Коноктордун саны</span>
            <div className="stepper">
              <button type="button" aria-label="Азайтуу" onClick={() => setPeople((p) => Math.max(1, p - 1))} disabled={!showPeople}>
                −
              </button>
              <output aria-live="polite" data-testid="people-count">
                {people}
              </output>
              <button type="button" aria-label="Көбөйтүү" onClick={() => setPeople((p) => Math.min(MAX_PEOPLE, p + 1))} disabled={!showPeople}>
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {status.kind === 'error' && (
        <p className="text-center text-[16px] text-[#a03445]" role="alert">
          {status.message}
        </p>
      )}

      <button type="submit" className="btn w-full" disabled={sending}>
        {sending ? 'Жөнөтүлүүдө…' : 'Жөнөтүү'}
      </button>
    </form>
  );
}
