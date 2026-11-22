// Generates public/lite-flowers.svg – static hydrangea clusters for the Lite tier (no WebGL).
// A plain image keeps ~200 SVG nodes out of React hydration. Run: node scripts/gen-lite-flowers.mjs
import { writeFileSync } from 'node:fs';

function rng(seed) {
  let a = seed;
  return () => ((a = (a * 16807) % 2147483647), a / 2147483647);
}
const TONES = [
  ['#5f7fc8', '#86a3df', '#b7c9ee'],
  ['#8fb0e3', '#b5cbef', '#e3ecf9'],
  ['#8d8fd0', '#aeb0e4', '#d9dbf5'],
];
const f = (n) => Math.round(n * 100) / 100;

function cluster(cx, cy, r, tone, seed) {
  const rand = rng(seed);
  const colors = TONES[tone % TONES.length];
  let out = `<ellipse cx="${f(cx + r * 0.1)}" cy="${f(cy + r * 0.15)}" rx="${f(r * 1.05)}" ry="${f(r)}" fill="#2f3f7a" opacity=".12" filter="url(#s)"/>`;
  for (let i = 0; i < 46; i++) {
    const a = i * 2.39996;
    const d = Math.sqrt(i / 46) * r;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.92;
    const s = r * (0.2 + rand() * 0.06);
    const rot = rand() * 90;
    const c = colors[Math.floor(rand() * 3)];
    out += `<use href="#f" fill="${c}" transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})"/>`;
  }
  return out;
}

const petals = [0, 90, 180, 270].map((a) => `<ellipse cx=".55" rx=".5" ry=".36" transform="rotate(${a})" stroke="#fff" stroke-opacity=".5" stroke-width=".04"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice"><defs><filter id="s"><feGaussianBlur stdDeviation="8"/></filter><g id="f">${petals}<circle r=".12" fill="#e9d9a8"/></g></defs>${cluster(-10, 70, 70, 0, 3)}${cluster(410, 300, 54, 1, 7)}${cluster(-14, 520, 48, 2, 11)}${cluster(405, 740, 72, 0, 17)}</svg>`;
writeFileSync(new URL('../public/lite-flowers.svg', import.meta.url), svg);
console.log('lite-flowers.svg', svg.length, 'bytes');
