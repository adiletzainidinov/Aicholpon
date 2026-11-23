'use client';

import { useMemo, useState } from 'react';
import type { Guest } from '@/lib/shared/types';
import { answeredAt, formatDateTime, hasAnswered } from './api';

type Filter = 'all' | 'yes' | 'no';

/** Only guests who have already answered. No links or share buttons here – it is a read-only list. */
export function Responses({ guests }: { guests: Guest[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const answered = useMemo(
    () =>
      guests
        .filter(hasAnswered)
        .map((g) => ({ g, at: answeredAt(g) }))
        // newest answers first when the time is known
        .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)),
    [guests],
  );
  const yes = answered.filter(({ g }) => g.attending === true);
  const no = answered.filter(({ g }) => g.attending === false);
  const people = yes.reduce((n, { g }) => n + (g.people ?? 0), 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return answered.filter(({ g }) => {
      if (filter === 'yes' && g.attending !== true) return false;
      if (filter === 'no' && g.attending !== false) return false;
      return !q || g.name.toLowerCase().includes(q);
    });
  }, [answered, filter, query]);

  const chip = (f: Filter, label: string, n: number) => (
    <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`adm-filter ${filter === f ? 'is-on' : ''}`}>
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="adm-card !p-3 text-center">
          <div className="text-[12px] text-[#6e7f9e]">Придут</div>
          <div className="text-[24px] font-semibold tabular-nums text-[#24764b]">{yes.length}</div>
        </div>
        <div className="adm-card !p-3 text-center">
          <div className="text-[12px] text-[#6e7f9e]">Человек</div>
          <div className="text-[24px] font-semibold tabular-nums text-[#24764b]">{people}</div>
        </div>
        <div className="adm-card !p-3 text-center">
          <div className="text-[12px] text-[#6e7f9e]">Не придут</div>
          <div className="text-[24px] font-semibold tabular-nums text-[#aa3446]">{no.length}</div>
        </div>
      </div>

      <h2 className="text-[19px] font-semibold">
        Ответы гостей <span className="font-normal text-[#6e7f9e]">({answered.length})</span>
      </h2>
      <input className="adm-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени" aria-label="Поиск ответов" />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр ответов">
        {chip('all', 'Все', answered.length)}
        {chip('yes', 'Придут', yes.length)}
        {chip('no', 'Не придут', no.length)}
      </div>

      {shown.length === 0 && (
        <p className="adm-empty">{answered.length === 0 ? 'Пока никто не ответил. Ответы появятся здесь сразу после отправки анкеты.' : 'По этому запросу ответов нет.'}</p>
      )}

      <ul className="m-0 grid grid-cols-1 gap-2.5 p-0" data-testid="response-list">
        {shown.map(({ g, at }) => (
          <li key={g.id} className="adm-card flex min-w-0 list-none items-center gap-3 !py-3.5" data-testid="response">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full text-[17px] font-semibold ${g.attending ? 'bg-[#e3f3ea] text-[#24764b]' : 'bg-[#f8e5e8] text-[#aa3446]'}`}
              aria-hidden
            >
              {g.attending ? '✓' : '✕'}
            </span>
            <div className="min-w-0 flex-1">
              <b className="block break-words text-[16px]" data-testid="response-name">
                {g.name}
              </b>
              <span className="text-[13px] text-[#6e7f9e]">{at ? formatDateTime(at) : 'время ответа не сохранено'}</span>
            </div>
            <span className={`shrink-0 text-right text-[14px] font-semibold ${g.attending ? 'text-[#24764b]' : 'text-[#aa3446]'}`} data-testid="response-status">
              {g.attending ? (
                <>
                  Придёт
                  <br />
                  <span className="font-normal tabular-nums">
                    {g.people ?? 1} чел.
                  </span>
                </>
              ) : (
                'Не придёт'
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
