# Айчолпон — кинематографичное 3D-приглашение (Next.js)

Кыз узатуу · 12 декабря 2026 · 16:00 · ресторан «Адем».

## Стек
Next.js 16 (App Router, TypeScript strict) · React 19 · Tailwind CSS 4 · three.js + React Three Fiber · GSAP (только в 3D-чанке) · Supabase (существующие RPC и Edge Functions) · Vercel.

## Структура
- `src/app/page.tsx` — статическая (prerendered) страница; тексты/календарь — Server Components.
- `src/components/invitation/*` — клиентские «острова»: оболочка, RSVP, обратный отсчёт, шеринг, 2D-конверт.
- `src/components/three/*` — 3D-сцена (динамический импорт, `ssr:false`): конверт с толщиной, клапан на шарнире, восковая печать (целая + две половинки), раскладная открытка с фольгой, гортензии/глициния (InstancedMesh), частицы, камера, свет.
  Все текстуры (бумага, дамаск, кружево, вкладыш, фольга, каллиграфия) процедурные — без загрузки файлов.
- `src/app/api/*` — серверные прокси к Supabase: `invitee`, `rsvp`, `track`, `admin`, `admin/session`.
- `src/app/admin` — админка (вход только по существующему паролю).

## Уровни качества
`high` / `balanced` / `lite` выбираются автоматически (WebGL, программный рендер, память, ядра, save-data, reduced-motion) и понижаются по FPS во время работы.
Принудительно: `?quality=lite|balanced|high`.

## Безопасность
- Service-role ключ Supabase не используется вообще; публикуемый ключ — только на сервере.
- Пароль админки проверяет существующая Edge Function `aicholpon-client-admin`; сессия — httpOnly/Secure/SameSite=Strict cookie (`/api/admin`), защита от перебора (лимит попыток + задержка), проверка Origin.
- Рекомендуется задать в Vercel `ADMIN_SESSION_SECRET` (≥16 символов) — тогда cookie шифруется AES-256-GCM.

## Совместимость
Старые ссылки `/?token=…` и `/admin/` продолжают работать. Музыка — оригинальный `public/aicholpon-music.mp3`.

## Разработка и тесты
```bash
npm install
npm run dev                                   # реальный Supabase
AICHOLPON_MOCK=1 npm run build && AICHOLPON_MOCK=1 PORT=3100 npm start   # временные данные в памяти
BASE=http://localhost:3100 npm run test:e2e   # Playwright e2e (пароль mock: mock-admin-password)
```
Mock-режим никогда не включается на production (`VERCEL_ENV=production`).
