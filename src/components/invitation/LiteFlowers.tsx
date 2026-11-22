/** Static SVG hydrangea clusters for the Lite tier (no WebGL). Deterministic, server-rendered. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
}

const TONES = [
  ['#5f7fc8', '#86a3df', '#b7c9ee'],
  ['#8fb0e3', '#b5cbef', '#e3ecf9'],
  ['#8d8fd0', '#aeb0e4', '#d9dbf5'],
];

function Cluster({ cx, cy, r, tone, seed }: { cx: number; cy: number; r: number; tone: number; seed: number }) {
  const rand = rng(seed);
  const colors = TONES[tone % TONES.length]!;
  const florets = Array.from({ length: 46 }, (_, i) => {
    const a = i * 2.39996;
    const d = Math.sqrt(i / 46) * r;
    return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.92, s: r * (0.2 + rand() * 0.06), rot: rand() * 90, c: colors[Math.floor(rand() * 3)]! };
  });
  return (
    <g>
      <ellipse cx={cx + r * 0.1} cy={cy + r * 0.15} rx={r * 1.05} ry={r} fill="#2f3f7a" opacity=".12" filter="url(#soft)" />
      {florets.map((f, i) => (
        <g key={i} transform={`translate(${f.x} ${f.y}) rotate(${f.rot}) scale(${f.s})`}>
          <use href="#floret" fill={f.c} />
        </g>
      ))}
    </g>
  );
}

export function LiteFlowers() {
  return (
    <svg className="scene-bg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden style={{ opacity: 0.9 }}>
      <defs>
        <filter id="soft">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <g id="floret">
          {[0, 90, 180, 270].map((a) => (
            <ellipse key={a} cx="0.55" cy="0" rx="0.5" ry="0.36" transform={`rotate(${a})`} stroke="#fff" strokeOpacity=".5" strokeWidth=".04" />
          ))}
          <circle r=".12" fill="#e9d9a8" />
        </g>
      </defs>
      <Cluster cx={-10} cy={70} r={70} tone={0} seed={3} />
      <Cluster cx={410} cy={300} r={54} tone={1} seed={7} />
      <Cluster cx={-14} cy={520} r={48} tone={2} seed={11} />
      <Cluster cx={405} cy={740} r={72} tone={0} seed={17} />
    </svg>
  );
}
