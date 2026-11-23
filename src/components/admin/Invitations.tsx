'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type { Guest } from '@/lib/shared/types';
import { adminApi, hasAnswered, inviteLink, previewLink, whatsappUrl } from './api';

type Msg = { text: string; ok: boolean } | null;

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (g: Guest) => {
    try {
      await navigator.clipboard.writeText(inviteLink(g));
      setCopied(g.id);
      window.setTimeout(() => setCopied((c) => (c === g.id ? null : c)), 1800);
    } catch {
      window.prompt('Скопируйте ссылку', inviteLink(g));
    }
  };
  return { copied, copy };
}

const openWhatsApp = (g: Guest) => window.open(whatsappUrl(g), '_blank', 'noopener,noreferrer');

/** Small status chip – the invitations tab only hints at the answer, details live in "Ответы гостей". */
function Status({ g }: { g: Guest }) {
  if (g.attending === true) return <span className="adm-chip adm-chip--yes">Придёт · {g.people ?? 1}</span>;
  if (g.attending === false) return <span className="adm-chip adm-chip--no">Не придёт</span>;
  return <span className="adm-chip adm-chip--wait">Ждём ответ</span>;
}

function ShareActions({ g, copied, onCopy, primary = false }: { g: Guest; copied: boolean; onCopy: () => void; primary?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <a className="adm-btn adm-btn--alt adm-btn--link" href={previewLink(g)} target="_blank" rel="noopener noreferrer">
        Посмотреть
      </a>
      <button type="button" className={`adm-btn ${primary ? '' : 'adm-btn--alt'}`} onClick={onCopy}>
        {copied ? '✓ Скопировано' : 'Копировать ссылку'}
      </button>
      <button type="button" className="adm-btn adm-btn--wa col-span-2 sm:col-span-1" onClick={() => openWhatsApp(g)}>
        Отправить в WhatsApp
      </button>
    </div>
  );
}

export function Invitations({ guests, reload, onError }: { guests: Guest[]; reload: () => Promise<Guest[]>; onError: (e: unknown) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [created, setCreated] = useState<Guest | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const { copied, copy } = useCopy();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? guests.filter((g) => g.name.toLowerCase().includes(q)) : guests;
  }, [guests, query]);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) setMsg({ text: ok, ok: true });
      return true;
    } catch (e) {
      onError(e);
      setMsg({ text: e instanceof Error ? e.message : 'Ошибка', ok: false });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    const n = name.replace(/\s+/g, ' ').trim();
    if (!n) return;
    const before = new Set(guests.map((g) => g.id));
    let made: Guest | null = null;
    const ok = await run(async () => {
      const res = (await adminApi.add(n)) as Partial<Guest> | Partial<Guest>[] | null;
      const fresh = await reload();
      // the backend may or may not echo the new row – find it either way
      const echoed = Array.isArray(res) ? res[0] : res;
      made =
        (echoed?.id && fresh.find((g) => g.id === echoed.id)) ||
        fresh.find((g) => !before.has(g.id) && g.name === n) ||
        fresh.find((g) => !before.has(g.id)) ||
        null;
    });
    if (ok) {
      setName('');
      setCreated(made);
      setMsg(made ? null : { text: `Приглашение для «${n}» создано`, ok: true });
    }
  }

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4">
      <div className="adm-card">
        <h2 className="mb-2 text-[19px] font-semibold">Новое приглашение</h2>
        <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
          <input className="adm-input flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя гостя или семьи" maxLength={120} required aria-label="Имя гостя" />
          <button className="adm-btn" disabled={busy || !name.trim()}>
            {busy ? 'Создаём…' : 'Создать приглашение'}
          </button>
        </form>
        {msg && (
          <p className={`mt-2 text-[14px] ${msg.ok ? 'text-[#276c49]' : 'text-[#aa3446]'}`} role={msg.ok ? 'status' : 'alert'}>
            {msg.text}
          </p>
        )}

        {created && (
          <div className="mt-4 rounded-xl border border-[#cfe6d9] bg-[#f1faf5] p-3.5" role="status" data-testid="created-invite">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-[14px] text-[#276c49]">
                ✓ Приглашение создано для <b className="break-words">{created.name}</b>
              </p>
              <button type="button" className="shrink-0 text-[20px] leading-none text-[#6e7f9e]" onClick={() => setCreated(null)} aria-label="Скрыть">
                ×
              </button>
            </div>
            <input className="adm-input mt-2 text-[13px]" readOnly value={inviteLink(created)} aria-label="Персональная ссылка" onFocus={(e) => e.currentTarget.select()} />
            <div className="mt-2">
              <ShareActions g={created} copied={copied === created.id} onCopy={() => copy(created)} primary />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[19px] font-semibold">
          Приглашения <span className="font-normal text-[#6e7f9e]">({guests.length})</span>
        </h2>
        <p className="text-[13px] text-[#6e7f9e]">ответили {guests.filter(hasAnswered).length}</p>
      </div>
      <input className="adm-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени" aria-label="Поиск приглашений" />

      {shown.length === 0 && (
        <p className="adm-empty">{guests.length === 0 ? 'Приглашений пока нет — создайте первое выше.' : 'По этому запросу никого не найдено.'}</p>
      )}

      <ul className="m-0 grid grid-cols-1 gap-3 p-0" data-testid="invite-list">
        {shown.map((g) => {
          const isEditing = editing?.id === g.id;
          return (
            <li key={g.id} className="adm-card min-w-0 list-none" data-testid="invite">
              {isEditing ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = editing.name.replace(/\s+/g, ' ').trim();
                    if (!n) return;
                    void run(async () => {
                      await adminApi.rename(g.id, n);
                      await reload();
                    }, 'Имя изменено').then((ok) => ok && setEditing(null));
                  }}
                >
                  <input className="adm-input min-w-0 flex-1" value={editing.name} onChange={(e) => setEditing({ id: g.id, name: e.target.value })} maxLength={120} autoFocus aria-label="Новое имя" />
                  <button className="adm-btn" disabled={busy}>
                    OK
                  </button>
                  <button type="button" className="adm-btn adm-btn--alt" onClick={() => setEditing(null)} aria-label="Отмена">
                    ✕
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <b className="min-w-0 break-words text-[17px]" data-testid="invite-name">
                    {g.name}
                  </b>
                  <Status g={g} />
                </div>
              )}
              <a className="mt-1 block truncate text-[13px] text-[#3855a0]" href={previewLink(g)} target="_blank" rel="noopener noreferrer">
                {inviteLink(g)}
              </a>
              <div className="mt-3">
                <ShareActions g={g} copied={copied === g.id} onCopy={() => copy(g)} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="adm-btn adm-btn--alt" onClick={() => setEditing({ id: g.id, name: g.name })} disabled={isEditing}>
                  Изменить
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--danger"
                  disabled={busy}
                  onClick={() => {
                    const warn = hasAnswered(g) ? '\n\nГость уже ответил — его ответ тоже будет удалён.' : '';
                    if (!window.confirm(`Удалить приглашение «${g.name}»?${warn}`)) return;
                    void run(async () => {
                      await adminApi.remove(g.id);
                      await reload();
                      setCreated((c) => (c?.id === g.id ? null : c));
                    }, 'Приглашение удалено');
                  }}
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
