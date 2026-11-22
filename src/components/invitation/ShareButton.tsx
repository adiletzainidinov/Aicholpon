'use client';

/** Shares the general invitation (never the guest's personal token link). */
export function ShareButton() {
  const share = () => {
    const url = location.origin + '/';
    const text = `Айчолпондун кыз узатуу тоюна чакыруу 💌 12-декабрь 2026, саат 16:00, ресторан «Адем». ${url}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  };
  return (
    <button type="button" className="btn" onClick={share}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5.1 5.24-1.37A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.1.82.83-3.03-.2-.31a8.2 8.2 0 1 1 6.95 3.85Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.13-.55.12-.16.25-.63.8-.78.96-.14.17-.29.19-.53.06a6.7 6.7 0 0 1-3.35-2.93c-.25-.44.25-.4.72-1.34.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.73 2.73 0 0 0-.85 2.03 4.74 4.74 0 0 0 1 2.52 10.84 10.84 0 0 0 4.15 3.67c1.55.67 2.16.73 2.93.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.07-.11-.23-.17-.47-.29Z" />
      </svg>
      WhatsApp аркылуу бөлүшүү
    </button>
  );
}
