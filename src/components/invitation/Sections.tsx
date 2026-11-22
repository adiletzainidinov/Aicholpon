import { EVENT } from '@/lib/shared/event';
import { Countdown } from './Countdown';
import { GuestName, GuestNotice } from './GuestGreeting';
import { Reveal } from './Reveal';
import { RSVPForm } from './RSVPForm';
import { ShareButton } from './ShareButton';

function Ornament() {
  return (
    <svg className="ornament" viewBox="0 0 180 18" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
      <path data-draw d="M2 9h62c6 0 9-6 15-6s8 6 11 6 5-6 11-6 9 6 15 6h62" />
      <circle cx="90" cy="9" r="2.4" fill="currentColor" />
      <circle cx="72" cy="9" r="1.2" fill="currentColor" />
      <circle cx="108" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ScrollCue() {
  return (
    <span className="scroll-cue" aria-hidden>
      <svg width="28" height="30" viewBox="0 0 28 30" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M5 5l9 9 9-9M5 15l9 9 9-9" />
      </svg>
    </span>
  );
}

/** Scene 2 – the name. In 3D mode the name is presented on the opened 3D card instead. */
export function Hero() {
  return (
    <section className="section relative" aria-labelledby="hero-title">
      <Reveal className="column hero-name">
        <p className="eyebrow halo" data-reveal>
          {EVENT.title} · 2026
        </p>
        <h1 id="hero-title" className="font-script write halo mt-3 text-[clamp(64px,19vw,112px)] leading-[1.05]" data-reveal>
          {EVENT.bride}
        </h1>
        <Ornament />
        <p className="halo text-[22px] tracking-[0.2em]" data-reveal>
          {EVENT.dateLabel}
        </p>
      </Reveal>
      <div className="absolute inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] grid justify-items-center gap-1">
        <span className="eyebrow halo">Төмөн сыдырыңыз</span>
        <ScrollCue />
      </div>
    </section>
  );
}

/** Scene 3 – the personal invitation. */
export function InvitationText() {
  return (
    <section className="section" aria-labelledby="invite-title">
      <Reveal className="column">
        <div className="lace-frame" data-reveal>
          <h2 id="invite-title" className="text-deep">
            <span className="font-script block text-[clamp(44px,12vw,60px)] leading-[1.1]">Урматтуу</span>
            <span className="mt-1 block text-[clamp(26px,7vw,34px)] font-semibold leading-tight tracking-[0.02em]">
              <GuestName fallback="коноктор" />!
            </span>
          </h2>
          <Ornament />
          <p className="text-[20px] leading-[1.65]">
            Сиздерди кызыбыз <b className="font-semibold">Айчолпондун</b> кыз узатуу тоюна чакырабыз!
          </p>
          <p className="mt-3 text-[20px] leading-[1.65]">Кубанычыбызды бөлүшүп, кадырлуу коногубуз болуңуздар. Келип ак батаңыздарды берип кетиңиздер!</p>
          <GuestNotice />
        </div>
      </Reveal>
    </section>
  );
}

const DOW = ['Дш', 'Шш', 'Шр', 'Бш', 'Жм', 'Иш', 'Жк'];

/** Scene 4 – date, calendar, countdown. */
export function DateScene() {
  const firstWeekday = 1; // 1 Dec 2026 is a Tuesday (Mon-first index)
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <section className="section" aria-labelledby="date-title">
      <Reveal className="column">
        <p className="eyebrow halo" data-reveal>
          Салтанат күнү
        </p>
        <h2 id="date-title" className="font-script write halo mt-2 text-[clamp(56px,16vw,84px)] leading-[1.1]" data-reveal>
          Декабрь
        </h2>
        <div className="paper-card mt-6" data-reveal>
          <div className="cal" role="grid" aria-label="2026-жылдын декабры">
            {DOW.map((d) => (
              <span key={d} className="dow" role="columnheader">
                {d}
              </span>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`e${i}`} />
            ))}
            {days.map((d) => (
              <span key={d} className={`day${d === 12 ? ' is-event' : ''}`} role="gridcell" aria-current={d === 12 ? 'date' : undefined}>
                {d === 12 && (
                  <svg viewBox="0 0 40 40" aria-hidden>
                    <path d="M20 34s-13-8-15.5-16C3 12 6.5 6.5 12 6.5c3.6 0 6 2 8 5 2-3 4.4-5 8-5 5.5 0 9 5.5 7.5 11.5C33 26 20 34 20 34Z" fill="#2f3f7a" />
                    <path data-draw d="M20 37s-16-9.5-18.5-19C0 10.5 5 3.5 12 3.5c3.6 0 6 1.6 8 4 2-2.4 4.4-4 8-4 7 0 12 7 10.5 14.5C36 27.5 20 37 20 37Z" fill="none" stroke="#c9a55c" strokeWidth="1" />
                  </svg>
                )}
                {d}
              </span>
            ))}
          </div>
          <p className="mt-5 text-[21px]">
            <b className="font-semibold">12-декабрь, {EVENT.dayName.toLowerCase()}</b>
          </p>
          <p className="eyebrow mt-1">Башталышы саат</p>
          <p className="text-[44px] font-semibold leading-none tracking-wider text-deep">{EVENT.time}</p>
        </div>
        <div className="mt-6" data-reveal>
          <Countdown />
        </div>
      </Reveal>
    </section>
  );
}

/** Scene 5 – the venue (no address/coordinates are invented). */
export function VenueScene() {
  return (
    <section className="section" aria-labelledby="venue-title">
      <Reveal className="column">
        <p className="eyebrow halo" data-reveal>
          Салтанат өтүүчү жай
        </p>
        <div className="paper-card mt-5 overflow-hidden" data-reveal>
          <svg viewBox="0 0 240 70" className="mx-auto w-[220px] text-gold" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
            <path data-draw d="M20 66V38c0-16 22-30 100-30s100 14 100 30v28" />
            <path data-draw d="M44 66V42c0-10 18-20 76-20s76 10 76 20v24" />
            <path d="M120 8v-6M114 5h12" />
          </svg>
          <p className="eyebrow -mt-1">Ресторан</p>
          <h2 id="venue-title" className="font-script write text-[clamp(72px,22vw,108px)] leading-[1.05] text-deep" data-reveal>
            {EVENT.venueShort}
          </h2>
          <Ornament />
          <p className="text-[21px]">
            {EVENT.dateLabel.replace(/ · /g, '.')} · саат {EVENT.time}
          </p>
          <p className="mt-3 text-[17px] text-[#5f6b94]">Даректи тактоо үчүн уюштуруучулар менен байланышыңыз.</p>
        </div>
      </Reveal>
    </section>
  );
}

/** Scene 6 – RSVP. */
export function RSVPScene() {
  return (
    <section className="section" id="rsvp" aria-labelledby="rsvp-title">
      <Reveal className="column">
        <h2 id="rsvp-title" className="font-script write halo text-[clamp(52px,14vw,76px)] leading-[1.1]" data-reveal>
          Конок анкетасы
        </h2>
        <p className="halo mb-6 mt-1" data-reveal>
          Келериңизди алдын ала билдирип коюңуз
        </p>
        <div data-reveal>
          <RSVPForm />
        </div>
      </Reveal>
    </section>
  );
}

/** Scene 7 – thanks & share. */
export function FinalScene() {
  return (
    <section className="section" aria-labelledby="final-title">
      <Reveal className="column">
        <div className="mx-auto mb-4 w-[92px]" data-reveal>
          <svg viewBox="0 0 92 84" aria-hidden>
            <defs>
              <radialGradient id="wax" cx="35%" cy="30%" r="80%">
                <stop offset="0" stopColor="#7f9be0" />
                <stop offset=".55" stopColor="#3c519a" />
                <stop offset="1" stopColor="#25336b" />
              </radialGradient>
            </defs>
            <path d="M46 80S6 56 3 30C1 13 13 3 26 3c9 0 15 5 20 12 5-7 11-12 20-12 13 0 25 10 23 27-3 26-43 50-43 50Z" fill="url(#wax)" />
            <path d="M46 68S16 49 14 30c-1-10 6-17 14-17 7 0 12 5 18 13 6-8 11-13 18-13 8 0 15 7 14 17-2 19-32 38-32 38Z" fill="none" stroke="#a9bdf0" strokeOpacity=".5" />
            <text x="46" y="45" textAnchor="middle" fontFamily="var(--font-script)" fontSize="28" fill="#dbe5fb">
              А
            </text>
          </svg>
        </div>
        <h2 id="final-title" className="font-script write halo text-[clamp(64px,18vw,96px)] leading-[1.05]" data-reveal>
          Рахмат!
        </h2>
        <p className="halo mt-3 text-[22px]" data-reveal>
          Сиздерди чыдамсыздык менен күтөбүз!
        </p>
        <Ornament />
        <div data-reveal>
          <ShareButton />
        </div>
        <p className="eyebrow halo mt-10" data-reveal>
          {EVENT.bride} · {EVENT.dateLabel}
        </p>
      </Reveal>
    </section>
  );
}
