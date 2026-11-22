'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type { Guest } from '@/lib/shared/types';
import { adminApi, inviteLink } from './api';

type Filter = 'all' | 'yes' | 'no' | 'pending';

const status = (g: Guest) =>
  g.attending === true ? { t: `Придёт · ${g.people ?? 1} чел.`, c: 'bg-[#e3f3ea] text-[#24764b]' } : g.attending === false ? { t: 'Не придёт', c: 'bg-[#f8e5e8] text-[#aa3446]' } : { t: 'Ожидаем ответ', c: 'bg-[#f5efdf] text-[#8a6d2c]' };

export function GuestManagement({ guests, reload, onError }: { guests: Guest[]; reload: () => Promise<void>; onError: (e: unknown) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      if (filter === 'yes' && g.attending !== true) return false;
      if (filter === 'no' && g.attending !== false) return false;
      if (filter === 'pending' && g.attending != null) return false;
      return !q || g.name.toLowerCase().includes(q);
    });
  }, [guests, query, filter]);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      await reload();
      if (ok) setMsg(ok);
    } catch (e) {
      onError(e);
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    await run(() => adminApi.add(n), `Приглашение для «${n}» создано`);
    setName('');
  }

  async function copy(g: Guest) {
    try {
      await navigator.clipboard.writeText(inviteLink(g));
      setCopied(g.id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      prompt('Скопируйте ссылку', inviteLink(g));
    }
  }

  function whatsapp(g: Guest) {
    const text = `${g.name}, сизди Айчолпондун кыз узатуу тоюна чакырабыз! 💌 ${inviteLink(g)}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  }

  function exportCsv() {
    const rows = [['Имя', 'Ссылка', 'Ответ', 'Людей'], ...guests.map((g) => [g.name, inviteLink(g), g.attending == null ? '' : g.attending ? 'Придёт' : 'Не придёт', g.attending === false ? 0 : (g.people ?? '')])];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'aicholpon-guests.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const chip = (f: Filter, label: string) => (
    <button type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-[14px] ${filter === f ? 'bg-[#415d9b] text-white' : 'bg-white text-[#3b5492] shadow-[0_0_0_1px_#bac8e2_inset]'}`}>
      {label}
    </button>
  );

  return (
    <section className="grid grid-cols-1 gap-4">
      <div className="rounded-2xl bg-white p-4 shadow-[0_4px_18px_#314b7312]">
        <h2 className="mb-2 text-[20px] font-semibold">Создать приглашение</h2>
        <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
          <input className="adm-input flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя гостя или семьи" maxLength={120} required aria-label="Имя гостя" />
          <button className="adm-btn" disabled={busy}>
            Создать ссылку
          </button>
        </form>
        {msg && (
          <p className="mt-2 text-[14px] text-[#276c49]" role="status">
            {msg}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[20px] font-semibold">Список гостей</h2>
        <div className="flex gap-2">
          <button type="button" className="adm-btn adm-btn--alt" onClick={() => run(async () => {}, 'Обновлено')} disabled={busy}>
            Обновить
          </button>
          <button type="button" className="adm-btn adm-btn--alt" onClick={exportCsv}>
            CSV
          </button>
        </div>
      </div>
      <input className="adm-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени" aria-label="Поиск по имени" />
      <div className="flex flex-wrap gap-2">
        {chip('all', `Все (${guests.length})`)}
        {chip('yes', 'Придут')}
        {chip('no', 'Не придут')}
        {chip('pending', 'Без ответа')}
      </div>
      <p className="text-[13px] text-[#6e7f9e]">Показано: {shown.length}</p>

      <ul className="m-0 grid grid-cols-1 gap-3 p-0" data-testid="guest-list">
        {shown.map((g) => {
          const s = status(g);
          const isEditing = editing?.id === g.id;
          return (
            <li key={g.id} className="min-w-0 list-none rounded-2xl bg-white p-4 shadow-[0_4px_18px_#314b7312]" data-testid="guest">
              <div className="flex flex-wrap items-start justify-between gap-2">
                {isEditing ? (
                  <form
                    className="flex w-full gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = editing.name.trim();
                      if (n) void run(() => adminApi.rename(g.id, n), 'Имя изменено').then(() => setEditing(null));
                    }}
                  >
                    <input className="adm-input flex-1" value={editing.name} onChange={(e) => setEditing({ id: g.id, name: e.target.value })} maxLength={120} autoFocus aria-label="Новое имя" />
                    <button className="adm-btn" disabled={busy}>
                      OK
                    </button>
                    <button type="button" className="adm-btn adm-btn--alt" onClick={() => setEditing(null)}>
                      ✕
                    </button>
                  </form>
                ) : (
                  <b className="min-w-0 break-words text-[17px]" data-testid="guest-name">
                    {g.name}
                  </b>
                )}
                {!isEditing && <span className={`rounded-full px-2.5 py-1 text-[13px] ${s.c}`}>{s.t}</span>}
              </div>
              <a className="mt-1 block truncate text-[13px] text-[#3855a0]" href={inviteLink(g)} target="_blank" rel="noopener noreferrer">
                {inviteLink(g)}
              </a>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button type="button" className="adm-btn adm-btn--alt" onClick={() => copy(g)}>
                  {copied === g.id ? '✓ Скопировано' : 'Копировать'}
                </button>
                <button type="button" className="adm-btn adm-btn--alt" onClick={() => whatsapp(g)}>
                  WhatsApp
                </button>
                <button type="button" className="adm-btn adm-btn--alt" onClick={() => setEditing({ id: g.id, name: g.name })}>
                  Изменить
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--danger"
                  onClick={() => {
                    if (confirm(`Удалить приглашение «${g.name}»?`)) void run(() => adminApi.remove(g.id), 'Приглашение удалено');
                  }}
                  disabled={busy}
                >
                  Удалить
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
