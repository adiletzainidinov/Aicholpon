'use client';

import { useGuest } from './GuestContext';

export function GuestName({ fallback }: { fallback: string }) {
  const { name, status } = useGuest();
  if (status === 'loading') return <span className="inline-block min-w-[6ch] animate-pulse opacity-40">…</span>;
  return <>{name ?? fallback}</>;
}

export function GuestNotice() {
  const { status } = useGuest();
  if (status === 'not_found') return <p className="mt-4 text-[15px] text-[#8a4a57]">Жеке чакыруу шилтемеси табылган жок, бирок сиз дагы кадырлуу коногубузсуз.</p>;
  if (status === 'error') return <p className="mt-4 text-[15px] text-[#8a4a57]">Конок маалыматы жүктөлгөн жок. Интернетти текшериңиз.</p>;
  return null;
}
