'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Guest, VisitEvent } from '@/lib/shared/types';
import { Analytics } from './Analytics';
import { adminApi, AuthError, exportCsv, hasAnswered } from './api';
import { Invitations } from './Invitations';
import { Responses } from './Responses';

type View = 'checking' | 'login' | 'dashboard';

export default function AdminApp() {
  const [view, setView] = useState<View>('checking');
  const [password, setPassword] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<VisitEvent[]>([]);
  const [tab, setTab] = useState<'invites' | 'responses' | 'stats'>('invites');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const handleError = useCallback((e: unknown) => {
    if (e instanceof AuthError) {
      setView('login');
      setAuthMsg(e.message);
    }
  }, []);

  const load = useCallback(async () => {
    const [g, s] = await Promise.all([adminApi.list(), adminApi.stats()]);
    const list = Array.isArray(g) ? g : [];
    setGuests(list);
    setEvents(Array.isArray(s) ? s : []);
    setUpdatedAt(new Date());
    setError('');
    return list;
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      handleError(e);
      setError(e instanceof Error ? e.message : 'Не удалось обновить данные');
    } finally {
      setRefreshing(false);
    }
  }, [load, handleError]);

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
        if (!(e instanceof AuthError)) setAuthMsg('Сервер недоступен. Проверьте интернет и обновите страницу.');
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
    <div className="admin min-h-svh overflow-x-clip bg-[#f4f7fc] font-sans text-[15px] text-[#273d6b]">
      <main className="mx-auto max-w-[960px] px-3.5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-4">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[21px] font-semibold leading-tight sm:text-[24px]">Айчолпон · Админка</h1>
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

        {view === 'checking' && (
          <div className="grid gap-3" aria-busy="true" aria-label="Загрузка">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/70" />
            ))}
          </div>
        )}

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
            <nav className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-[0_4px_18px_#314b7312]" role="tablist">
              {(
                [
                  ['invites', 'Приглашения', guests.length],
                  ['responses', 'Ответы', guests.filter(hasAnswered).length],
                  ['stats', 'Статистика', null],
                ] as const
              ).map(([k, label, n]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`min-w-0 rounded-xl px-0.5 py-2.5 text-[13px] leading-tight tracking-tight min-[360px]:text-[14px] min-[380px]:text-[15px] min-[380px]:tracking-normal ${tab === k ? 'bg-[#415d9b] text-white' : ''}`}
                >
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
                  {n !== null && <span className={`block text-[12px] tabular-nums ${tab === k ? 'text-white/80' : 'text-[#6e7f9e]'}`}>{n}</span>}
                </button>
              ))}
            </nav>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-[#6e7f9e]">
                {updatedAt ? `Обновлено в ${updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
              <div className="flex gap-2">
                <button type="button" className="adm-btn adm-btn--alt" onClick={refresh} disabled={refreshing}>
                  {refreshing ? 'Обновляем…' : 'Обновить'}
                </button>
                <button type="button" className="adm-btn adm-btn--alt" onClick={() => exportCsv(guests)}>
                  CSV
                </button>
              </div>
            </div>
            {error && (
              <p className="mb-4 rounded-xl bg-[#fbe9ec] px-4 py-3 text-[14px] text-[#aa3446]" role="alert">
                {error}
              </p>
            )}
            {tab === 'invites' && <Invitations guests={guests} reload={load} onError={handleError} />}
            {tab === 'responses' && <Responses guests={guests} />}
            {tab === 'stats' && <Analytics guests={guests} events={events} />}
          </>
        )}
      </main>
    </div>
  );
}
