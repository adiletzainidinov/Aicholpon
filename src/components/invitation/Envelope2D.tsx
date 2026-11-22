/** CSS/SVG envelope: the instant poster before 3D loads, and the Lite-mode envelope. */
export function Envelope2D({ open = false }: { open?: boolean }) {
  return (
    <div className="env2d" data-open={open} aria-hidden>
      <div className="env2d__back" />
      <div className="env2d__card">
        <span>Айчолпон</span>
      </div>
      <div className="env2d__pocket" />
      <div className="env2d__flap" />
      <svg className="env2d__lace" viewBox="0 0 150 118" preserveAspectRatio="none">
        <defs>
          <pattern id="lace" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="3.5" cy="3.5" r="2.2" fill="#a9bad8" />
            <circle cx="3.5" cy="3.5" r="0.9" fill="#eef3fb" />
          </pattern>
        </defs>
        <path d="M6 8 L75 104 L144 8" fill="none" stroke="url(#lace)" strokeWidth="7" strokeLinecap="round" opacity=".9" />
        <path d="M2 2 L75 112 L148 2" fill="none" stroke="#c9a55c" strokeWidth=".5" opacity=".9" />
      </svg>
      <div className="env2d__seal" style={{ top: '50.5%' }}>
        <span>А</span>
      </div>
    </div>
  );
}
