'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Guest, VisitEvent } from '@/lib/shared/types';

const DAY = 86_400_000;
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function Stat({ label, value, accent, hint }: { label: string; value: number | string; accent?: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 shadow-[0_4px_18px_#314b7312] sm:p-4">
      <div className="text-[13px] leading-snug text-[#6e7f9e]">{label}</div>
      <div className="mt-2 text-[26px] font-semibold leading-none tabular-nums sm:text-[28px]" style={{ color: accent ?? '#273d6b' }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[12px] text-[#9aa6bf]">{hint}</div>}
    </div>
  );
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Views per day. Small phones default to 7 days (bars stay readable), wider screens to 14. */
function ViewsChart({ events, opens, views }: { events: VisitEvent[]; opens: number; views: number }) {
  const [range, setRange] = useState<7 | 14>(14);
  useEffect(() => {
    if (window.matchMedia('(max-width: 479px)').matches) setRange(7);
  }, []);

  const days = useMemo(() => {
    const today = startOfDay(Date.now());
    const counts = new Map<number, number>();
    for (const e of events) {
      if (e.event_type !== 'view') continue;
      const t = new Date(e.created_at).getTime();
      if (Number.isFinite(t)) counts.set(startOfDay(t), (counts.get(startOfDay(t)) ?? 0) + 1);
    }
    return Array.from({ length: range }, (_, i) => {
      const t = today - (range - 1 - i) * DAY;
      const d = new Date(t);
      return { t, day: d.getDate(), month: d.getMonth() + 1, wd: WEEKDAYS[d.getDay()]!, n: counts.get(t) ?? 0, isToday: i === range - 1 };
    });
  }, [events, range]);

  const total = days.reduce((s, d) => s + d.n, 0);
  const max = Math.max(1, ...days.map((d) => d.n));
  const dense = range === 14;

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_4px_18px_#314b7312]">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="font-semibold">Просмотры по дням</div>
          <div className="text-[13px] text-[#6e7f9e]">
            За {range} дней: <b className="tabular-nums text-[#273d6b]">{total}</b> · открыли конверт: {views ? Math.round((opens / views) * 100) : 0}%
          </div>
        </div>
        <div className="flex shrink-0 rounded-xl bg-[#eef2fa] p-0.5 text-[13px]" role="group" aria-label="Период">
          {([7, 14] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`min-h-[34px] rounded-[10px] px-3 ${range === r ? 'bg-white font-semibold text-[#273d6b] shadow-sm' : 'text-[#6e7f9e]'}`}
            >
              {r} дн.
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className="mt-4 grid h-[150px] place-items-center rounded-xl border border-dashed border-[#d5deef] text-center text-[14px] text-[#8a97b3]">
          За этот период просмотров пока нет
        </div>
      ) : (
        <div
          className="mt-4 grid h-[170px] items-end gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: `repeat(${range}, minmax(0, 1fr))` }}
          role="img"
          aria-label={`Просмотры за ${range} дней: ${days.map((d) => `${d.day}.${String(d.month).padStart(2, '0')} — ${d.n}`).join(', ')}`}
        >
          {days.map((d, i) => {
            const h = d.n ? Math.max(6, (d.n / max) * 110) : 3;
            const showLabel = !dense || i % 2 === (range - 1) % 2;
            return (
              <div key={d.t} className="flex min-w-0 flex-col items-center justify-end gap-1">
                <span className={`text-[11px] leading-none tabular-nums ${d.n ? 'text-[#273d6b]' : 'text-transparent'}`}>{d.n}</span>
                <div
                  className={`w-full max-w-[34px] rounded-t-md transition-[height] duration-500 ${d.isToday ? 'bg-[#415d9b]' : d.n ? 'bg-[#8fa7d8]' : 'bg-[#e6ebf5]'}`}
                  style={{ height: h }}
                />
                <span className={`mt-0.5 w-full truncate text-center text-[10px] leading-tight ${d.isToday ? 'font-semibold text-[#273d6b]' : 'text-[#8a97b3]'}`}>
                  {showLabel ? (
                    <>
                      {d.day}
                      <br />
                      <span className="text-[9px] uppercase">{d.wd}</span>
                    </>
                  ) : (
                    <span aria-hidden>·</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Analytics({ guests, events }: { guests: Guest[]; events: VisitEvent[] }) {
  const count = (t: string) => events.filter((e) => e.event_type === t).length;
  const now = Date.now();
  const today = startOfDay(now);
  const views = count('view');
  const opens = count('open');
  const yes = guests.filter((g) => g.attending === true);
  const no = guests.filter((g) => g.attending === false);
  const pending = guests.filter((g) => g.attending == null);
  const people = yes.reduce((n, g) => n + (g.people ?? 0), 0);
  const viewsToday = events.filter((e) => e.event_type === 'view' && new Date(e.created_at).getTime() >= today).length;
  const views7 = events.filter((e) => e.event_type === 'view' && now - new Date(e.created_at).getTime() < 7 * DAY).length;
  const answered = yes.length + no.length;

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6">
      <div className="min-w-0">
        <h2 className="mb-3 text-[19px] font-semibold">Приглашения и ответы</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Всего приглашений" value={guests.length} />
          <Stat label="Ответили" value={answered} />
          <Stat label="Придут (семей)" value={yes.length} accent="#24764b" />
          <Stat label="Отказались" value={no.length} accent="#aa3446" />
          <Stat label="Людей придёт" value={people} accent="#24764b" />
        </div>
        <p className="mt-2 text-[13px] text-[#6e7f9e]">
          Ещё не ответили: <b className="tabular-nums text-[#8a6d2c]">{pending.length}</b> — они не считаются отказавшимися.
        </p>
        {guests.length > 0 && (
          <div className="mt-3 rounded-2xl bg-white p-4 shadow-[0_4px_18px_#314b7312]">
            <div className="flex justify-between gap-2 text-[13px] text-[#6e7f9e]">
              <span>
                Ответили <b className="tabular-nums text-[#273d6b]">{answered}</b> из <span className="tabular-nums">{guests.length}</span>
              </span>
              <b className="tabular-nums text-[#273d6b]">{Math.round((answered / guests.length) * 100)}%</b>
            </div>
            <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[#eef2fa]" role="img" aria-label={`Придут ${yes.length}, не придут ${no.length}, нет ответа ${pending.length}`}>
              <span className="bg-[#3c9a69]" style={{ width: `${(yes.length / guests.length) * 100}%` }} />
              <span className="bg-[#d0566a]" style={{ width: `${(no.length / guests.length) * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#6e7f9e]">
              <span>
                <i className="mr-1 inline-block size-2 rounded-full bg-[#3c9a69]" />
                Придут
              </span>
              <span>
                <i className="mr-1 inline-block size-2 rounded-full bg-[#d0566a]" />
                Не придут
              </span>
              <span>
                <i className="mr-1 inline-block size-2 rounded-full bg-[#eef2fa] ring-1 ring-[#d5deef]" />
                Нет ответа
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <h2 className="mb-3 text-[19px] font-semibold">Посещения</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Просмотры сайта" value={views} />
          <Stat label="Открытия конверта" value={opens} />
          <Stat label="Сегодня" value={viewsToday} />
          <Stat label="За 7 дней" value={views7} />
          <Stat label="Ответы через сайт" value={count('rsvp_yes') + count('rsvp_no')} />
        </div>
        <div className="mt-3">
          <ViewsChart events={events} opens={opens} views={views} />
        </div>
        <p className="mt-2 text-[13px] text-[#6e7f9e]">Считаются открытия страниц и конвертов, а не уникальные люди.</p>
      </div>
    </section>
  );
}
