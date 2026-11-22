'use client';

import type { Guest, VisitEvent } from '@/lib/shared/types';

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_4px_18px_#314b7312]">
      <div className="text-[13px] text-[#6e7f9e]">{label}</div>
      <div className="mt-1 text-[28px] font-semibold leading-none" style={{ color: accent ?? '#273d6b' }}>
        {value}
      </div>
    </div>
  );
}

export function Analytics({ guests, events }: { guests: Guest[]; events: VisitEvent[] }) {
  const count = (t: string) => events.filter((e) => e.event_type === t).length;
  const now = Date.now();
  const today = new Date().toDateString();
  const views = count('view');
  const opens = count('open');
  const yes = guests.filter((g) => g.attending === true);
  const no = guests.filter((g) => g.attending === false);
  const pending = guests.filter((g) => g.attending === null || g.attending === undefined);
  const people = yes.reduce((n, g) => n + (g.people ?? 0), 0);

  // views per day, last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 86400000);
    const key = d.toDateString();
    return { label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, n: events.filter((e) => e.event_type === 'view' && new Date(e.created_at).toDateString() === key).length };
  });
  const max = Math.max(1, ...days.map((d) => d.n));

  return (
    <section className="grid grid-cols-1 gap-6">
      <div>
        <h2 className="mb-3 text-[20px] font-semibold">Приглашения и ответы</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Приглашений" value={guests.length} />
          <Stat label="Придут (ответы)" value={yes.length} accent="#24764b" />
          <Stat label="Гостей придёт" value={people} accent="#24764b" />
          <Stat label="Не придут" value={no.length} accent="#aa3446" />
          <Stat label="Нет ответа" value={pending.length} accent="#8a6d2c" />
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-[20px] font-semibold">Статистика посещений</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Просмотры сайта" value={views} />
          <Stat label="Открытия конверта" value={opens} />
          <Stat label="Сегодня" value={events.filter((e) => e.event_type === 'view' && new Date(e.created_at).toDateString() === today).length} />
          <Stat label="За 7 дней" value={events.filter((e) => e.event_type === 'view' && now - new Date(e.created_at).getTime() < 7 * 86400000).length} />
          <Stat label="Ответы через сайт" value={count('rsvp_yes') + count('rsvp_no')} />
        </div>
        <div className="mt-3 rounded-2xl bg-white p-4 shadow-[0_4px_18px_#314b7312]">
          <div className="mb-2 flex justify-between text-[13px] text-[#6e7f9e]">
            <span>Просмотры за 14 дней</span>
            <span>Открыли конверт: {views ? Math.round((opens / views) * 100) : 0}%</span>
          </div>
          <div className="flex h-28 items-end gap-1" role="img" aria-label="Просмотры по дням">
            {days.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-[#6e7f9e]">{d.n || ''}</span>
                <div className="w-full rounded-t-md bg-[#7d98cf]" style={{ height: `${(d.n / max) * 80}px`, minHeight: 2 }} />
                <span className="text-[9px] text-[#9aa6bf]">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[13px] text-[#6e7f9e]">Считаются открытия страниц и конвертов, а не уникальные люди.</p>
      </div>
    </section>
  );
}
