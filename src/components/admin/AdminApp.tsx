'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Guest, VisitEvent } from '@/lib/shared/types';
import { Analytics } from './Analytics';
import { adminApi, AuthError } from './api';
import { GuestManagement } from './GuestManagement';

type View = 'checking' | 'login' | 'dashboard';

export default function AdminApp() {
  const [view, setView] = useState<View>('checking');
  const [password, setPassword] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<VisitEvent[]>([]);
  const [tab, setTab] = useState<'guests' | 'stats'>('guests');

  const handleError = useCallback((e: unknown) => {
    if (e instanceof AuthError) {
      setView('login');
      setAuthMsg(e.message);
    }
  }, []);

  const load = useCallback(async () => {
    const [g, s] = await Promise.all([adminApi.list(), adminApi.stats()]);
    setGuests(Array.isArray(g) ? g : []);
    setEvents(Array.isArray(s) ? s : []);
  }, []);

  useEffect(() => {
    adminApi
      .session()
      .then(async (ok) => {
        if (!ok) return setView('login');
        await load();
        setView('dashboard');
      })
      .catch((e: unknown) => {
        handleError(e);
        setView('login');
      });
  }, [load, handleError]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAuthMsg('Проверяем вход…');
    try {
      await adminApi.login(password);
      setPassword('');
      await load();
      setAuthMsg('');
      setView('dashboard');
    } catch (err) {
      setAuthMsg(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await adminApi.logout();
    setGuests([]);
    setEvents([]);
    setView('login');
  }

  return (
    <div className="admin min-h-svh bg-[#f4f7fc] font-sans text-[15px] text-[#273d6b]">
      <main className="mx-auto max-w-[960px] px-4 pb-16 pt-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold">Айчолпон · Админка</h1>
            <a href="/" className="text-[14px] text-[#3855a0]">
              ← Приглашение
            </a>
          </div>
          {view === 'dashboard' && (
            <button type="button" className="adm-btn adm-btn--alt" onClick={logout}>
              Выйти
            </button>
          )}
        </header>

        {view === 'checking' && <p className="text-[#6e7f9e]">Загрузка…</p>}

        {view === 'login' && (
          <form onSubmit={login} className="mx-auto mt-10 grid max-w-[380px] gap-3 rounded-2xl bg-white p-6 shadow-[0_4px_18px_#314b7312]">
            <h2 className="text-[20px] font-semibold">Защищённый вход</h2>
            <p className="text-[#6e7f9e]">Введите пароль администратора.</p>
            <input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" autoComplete="current-password" required aria-label="Пароль" />
            <button className="adm-btn" disabled={busy}>
              Войти
            </button>
            {authMsg && (
              <p className="text-[14px] text-[#b32939]" role="alert">
                {authMsg}
              </p>
            )}
          </form>
        )}

        {view === 'dashboard' && (
          <>
            <nav className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-[0_4px_18px_#314b7312]" role="tablist">
              {(
                [
                  ['guests', 'Гости'],
                  ['stats', 'Статистика'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`rounded-xl py-2.5 ${tab === k ? 'bg-[#415d9b] text-white' : ''}`}>
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'guests' ? <GuestManagement guests={guests} reload={load} onError={handleError} /> : <Analytics guests={guests} events={events} />}
          </>
        )}
      </main>
    </div>
  );
}
