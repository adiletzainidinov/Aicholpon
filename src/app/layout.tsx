import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const script = localFont({
  src: '../fonts/great-vibes.woff2',
  variable: '--font-script',
  weight: '400',
  display: 'swap',
  fallback: ['cursive'],
});

const serif = localFont({
  src: [
    { path: '../fonts/cormorant-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/cormorant-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-serif',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://aicholpon.vercel.app'),
  title: 'Айчолпон — Кыз узатуу · 12.12.2026',
  description: 'Айчолпондун кыз узатуу тоюна чакыруу — 12-декабрь 2026, саат 16:00, ресторан «Адем».',
  openGraph: {
    title: 'Айчолпон — Кыз узатуу',
    description: '12-декабрь 2026 · 16:00 · Ресторан «Адем»',
    type: 'website',
    locale: 'ky_KG',
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#d3dae6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ky" className={`${script.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
