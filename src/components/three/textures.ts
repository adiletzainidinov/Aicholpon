import * as THREE from 'three';

/**
 * Procedural PBR textures drawn on canvas at runtime.
 * Nothing is downloaded: paper fibres, damask embossing, lace, liner, gold foil
 * masks and the calligraphy are generated deterministically for the device's
 * quality tier (texture size). Every surface gets a colour map plus a height
 * (bump) map, and foil surfaces get roughness / metalness masks.
 */

export const PALETTE = {
  pearl: '#f6f3ee',
  pearlWarm: '#f3ede3',
  ice: '#dfe8f5',
  blue: '#7d98cf',
  deep: '#2f3f7a',
  ink: '#24336e',
  silver: '#b9c3d3',
  champagne: '#eadcc0',
  gold: '#c9a55c',
} as const;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(w));
  c.height = Math.max(4, Math.round(h));
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, color: boolean, anisotropy = 4) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

export function cssFont(varName: '--font-script' | '--font-serif', fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

export async function ensureFonts() {
  const script = cssFont('--font-script', 'cursive');
  const serif = cssFont('--font-serif', 'serif');
  try {
    await Promise.all([
      document.fonts.load(`80px ${script}`, 'Айчолпон А'),
      document.fonts.load(`500 40px ${serif}`, 'КЫЗ УЗАТУУ 2026'),
      document.fonts.load(`600 40px ${serif}`, 'Сиздерди 16:00'),
    ]);
  } catch {
    /* draw with fallbacks */
  }
  return { script, serif };
}

/* ------------------------------------------------------------------ */
/* Paper                                                               */
/* ------------------------------------------------------------------ */

/** Soft value-noise blotches + fibres. Draws onto both colour and height canvases. */
function paperGrain(color: CanvasRenderingContext2D, height: CanvasRenderingContext2D, w: number, h: number, seed: number, tint = 'rgba(120,110,95,') {
  const r = rng(seed);
  // low-frequency cloudiness
  const small = canvas(24, Math.max(4, Math.round((24 * h) / w)));
  const id = small.ctx.createImageData(small.c.width, small.c.height);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 118 + r() * 20;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 255;
  }
  small.ctx.putImageData(id, 0, 0);
  height.imageSmoothingEnabled = true;
  height.globalAlpha = 1;
  height.drawImage(small.c, 0, 0, w, h);

  color.save();
  color.globalAlpha = 0.05;
  color.globalCompositeOperation = 'multiply';
  color.drawImage(small.c, 0, 0, w, h);
  color.restore();

  // fibres
  const n = Math.round((w * h) / 900);
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = 4 + r() * 18;
    const a = r() * Math.PI * 2;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    height.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
    height.lineWidth = 0.6 + r() * 0.8;
    height.beginPath();
    height.moveTo(x, y);
    height.quadraticCurveTo(x + (r() - 0.5) * 8, y + (r() - 0.5) * 8, x2, y2);
    height.stroke();
    if (i % 3 === 0) {
      color.strokeStyle = tint + (0.025 + r() * 0.03) + ')';
      color.lineWidth = 0.6;
      color.beginPath();
      color.moveTo(x, y);
      color.lineTo(x2, y2);
      color.stroke();
    }
  }
}

/** One mirrored damask motif (stroke + fill), drawn around (0,0) with size s. */
function damaskMotif(ctx: CanvasRenderingContext2D, s: number) {
  const half = () => {
    ctx.beginPath();
    // central stem
    ctx.moveTo(0, -0.48 * s);
    ctx.bezierCurveTo(0.05 * s, -0.3 * s, 0.05 * s, 0.25 * s, 0, 0.48 * s);
    // big scroll
    ctx.moveTo(0, 0.18 * s);
    ctx.bezierCurveTo(0.18 * s, 0.05 * s, 0.38 * s, 0.12 * s, 0.36 * s, 0.3 * s);
    ctx.bezierCurveTo(0.34 * s, 0.42 * s, 0.2 * s, 0.4 * s, 0.22 * s, 0.31 * s);
    // upper scroll
    ctx.moveTo(0, -0.08 * s);
    ctx.bezierCurveTo(0.2 * s, -0.12 * s, 0.32 * s, -0.3 * s, 0.22 * s, -0.4 * s);
    ctx.bezierCurveTo(0.14 * s, -0.47 * s, 0.06 * s, -0.38 * s, 0.13 * s, -0.33 * s);
    // leaf
    ctx.moveTo(0.02 * s, 0.02 * s);
    ctx.quadraticCurveTo(0.26 * s, -0.02 * s, 0.4 * s, 0.06 * s);
    ctx.quadraticCurveTo(0.24 * s, 0.12 * s, 0.02 * s, 0.02 * s);
    ctx.stroke();
    // buds
    ctx.beginPath();
    ctx.arc(0.36 * s, -0.18 * s, 0.025 * s, 0, Math.PI * 2);
    ctx.arc(0.43 * s, 0.38 * s, 0.02 * s, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.save();
  half();
  ctx.scale(-1, 1);
  half();
  ctx.restore();
  // crown
  ctx.beginPath();
  ctx.moveTo(0, -0.62 * s);
  ctx.quadraticCurveTo(0.07 * s, -0.54 * s, 0, -0.48 * s);
  ctx.quadraticCurveTo(-0.07 * s, -0.54 * s, 0, -0.62 * s);
  ctx.fill();
}

function damaskField(ctx: CanvasRenderingContext2D, w: number, h: number, cell: number, style: string, lw: number) {
  ctx.save();
  ctx.strokeStyle = style;
  ctx.fillStyle = style;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  for (let row = -1, y = 0; y < h + cell; row++, y = row * cell * 0.62) {
    for (let x = (row % 2 ? cell / 2 : 0) - cell; x < w + cell; x += cell) {
      ctx.save();
      ctx.translate(x, y);
      damaskMotif(ctx, cell * 0.52);
      ctx.restore();
    }
  }
  ctx.restore();
}

export interface SurfaceSet {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  roughnessMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  dispose(): void;
}

/**
 * three.js reads roughness from the G channel and metalness from the B channel, so both
 * grayscale masks are packed into one texture (one upload and half the GPU memory).
 */
function packRoughMetal(rough: HTMLCanvasElement, metal?: HTMLCanvasElement) {
  const { c, ctx } = canvas(rough.width, rough.height);
  const channel = (src: HTMLCanvasElement, rgb: string) => {
    const tmp = canvas(src.width, src.height);
    tmp.ctx.drawImage(src, 0, 0);
    tmp.ctx.globalCompositeOperation = 'multiply';
    tmp.ctx.fillStyle = rgb;
    tmp.ctx.fillRect(0, 0, src.width, src.height);
    ctx.drawImage(tmp.c, 0, 0);
  };
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'lighter';
  channel(rough, '#00ff00');
  if (metal) channel(metal, '#0000ff');
  return c;
}

function surface(color: HTMLCanvasElement, height: HTMLCanvasElement, rough?: HTMLCanvasElement, metal?: HTMLCanvasElement): SurfaceSet {
  const orm = rough ? toTexture(packRoughMetal(rough, metal), false) : undefined;
  const set: SurfaceSet = {
    map: toTexture(color, true),
    bumpMap: toTexture(height, false),
    roughnessMap: orm,
    metalnessMap: metal ? orm : undefined,
    dispose() {
      set.map.dispose();
      set.bumpMap.dispose();
      orm?.dispose();
    },
  };
  return set;
}

/* ------------------------------------------------------------------ */
/* Envelope                                                            */
/* ------------------------------------------------------------------ */

/** Front pocket of the envelope: embossed damask + the overlapping bottom flap. */
export function envelopePocket(size: number, aspect: number): SurfaceSet {
  const w = size;
  const h = size * aspect;
  const col = canvas(w, h);
  const hei = canvas(w, h);
  col.ctx.fillStyle = PALETTE.pearl;
  col.ctx.fillRect(0, 0, w, h);
  const g = col.ctx.createRadialGradient(w * 0.4, h * 0.3, 0, w * 0.5, h * 0.5, h * 0.8);
  g.addColorStop(0, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(225,215,200,0.25)');
  col.ctx.fillStyle = g;
  col.ctx.fillRect(0, 0, w, h);
  hei.ctx.fillStyle = '#808080';
  hei.ctx.fillRect(0, 0, w, h);
  paperGrain(col.ctx, hei.ctx, w, h, 11);

  damaskField(hei.ctx, w, h, w * 0.3, 'rgba(255,255,255,0.55)', w * 0.006);
  damaskField(col.ctx, w, h, w * 0.3, 'rgba(165,175,195,0.10)', w * 0.004);

  // bottom flap overlap: slightly raised region with a soft shadow edge
  const apexY = h * 0.42;
  const flap = new Path2D();
  flap.moveTo(0, h);
  flap.lineTo(w * 0.04, h * 0.98);
  flap.quadraticCurveTo(w * 0.5, apexY - h * 0.03, w * 0.96, h * 0.98);
  flap.lineTo(w, h);
  flap.closePath();
  hei.ctx.fillStyle = 'rgba(255,255,255,0.12)';
  hei.ctx.fill(flap);
  col.ctx.save();
  col.ctx.shadowColor = 'rgba(80,70,60,0.18)';
  col.ctx.shadowBlur = w * 0.012;
  col.ctx.shadowOffsetY = -w * 0.003;
  col.ctx.strokeStyle = 'rgba(250,248,244,0.9)';
  col.ctx.lineWidth = w * 0.002;
  col.ctx.stroke(flap);
  col.ctx.restore();
  // side flaps' fold lines
  col.ctx.strokeStyle = 'rgba(150,140,125,0.10)';
  col.ctx.lineWidth = w * 0.002;
  col.ctx.beginPath();
  col.ctx.moveTo(0, h * 0.02);
  col.ctx.lineTo(w * 0.5, h * 0.55);
  col.ctx.lineTo(w, h * 0.02);
  col.ctx.stroke();
  return surface(col.c, hei.c);
}

/** Lace band (silver-blue florets, scallops, picots) along a line from a to b. */
function laceBand(
  col: CanvasRenderingContext2D,
  hei: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  seed: number,
) {
  const r = rng(seed);
  const len = Math.hypot(bx - ax, by - ay);
  const ang = Math.atan2(by - ay, bx - ax);
  const step = width * 0.55;
  const draw = (ctx: CanvasRenderingContext2D, isHeight: boolean) => {
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    const main = isHeight ? 'rgba(255,255,255,0.75)' : 'rgba(118,143,196,1)';
    const light = isHeight ? 'rgba(255,255,255,0.95)' : 'rgba(226,234,247,1)';
    const dark = isHeight ? 'rgba(0,0,0,0.25)' : 'rgba(74,96,150,0.95)';
    // net mesh
    ctx.strokeStyle = isHeight ? 'rgba(255,255,255,0.25)' : 'rgba(140,160,205,0.55)';
    ctx.lineWidth = Math.max(0.6, width * 0.012);
    for (let x = 0; x < len; x += width * 0.12) {
      ctx.beginPath();
      ctx.moveTo(x, -width * 0.42);
      ctx.lineTo(x + width * 0.3, width * 0.42);
      ctx.moveTo(x + width * 0.3, -width * 0.42);
      ctx.lineTo(x, width * 0.42);
      ctx.stroke();
    }
    // scallop edges
    ctx.strokeStyle = main;
    ctx.lineWidth = Math.max(1, width * 0.035);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let x = 0; x < len; x += step * 0.5) {
        ctx.moveTo(x, side * width * 0.42);
        ctx.arc(x + step * 0.25, side * width * 0.42, step * 0.25, Math.PI, 0, side > 0);
      }
      ctx.stroke();
      ctx.fillStyle = light;
      for (let x = step * 0.25; x < len; x += step * 0.5) {
        ctx.beginPath();
        ctx.arc(x, side * width * (0.42 + 0.33 * 0.5) + (side > 0 ? 0 : 0), width * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // florets along the band
    for (let x = step * 0.5; x < len; x += step) {
      const s = width * (0.2 + r() * 0.06);
      const y = (r() - 0.5) * width * 0.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * Math.PI);
      for (let p = 0; p < 5; p++) {
        ctx.rotate((Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(s * 0.55, 0, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = p % 2 ? main : light;
        ctx.fill();
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(0.5, s * 0.06);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = isHeight ? '#fff' : PALETTE.champagne;
      ctx.fill();
      ctx.restore();
      // tiny leaves between florets
      ctx.save();
      ctx.translate(x + step * 0.5, (r() - 0.5) * width * 0.2);
      ctx.rotate((r() - 0.5) * 1.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.6, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = main;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };
  draw(col, false);
  draw(hei, true);
}

/**
 * Flap (triangle with rounded tip). Canvas covers the flap's bounding box:
 * x in [0,w] ↔ shape x [-W/2, W/2]; y in [0,h] ↔ shape y [0, -FH] (top = hinge).
 */
export function envelopeFlap(size: number, aspect: number): SurfaceSet & { liner: SurfaceSet } {
  const w = size;
  const h = size * aspect;
  const col = canvas(w, h);
  const hei = canvas(w, h);
  const rough = canvas(w, h);
  const metal = canvas(w, h);
  col.ctx.fillStyle = PALETTE.pearl;
  col.ctx.fillRect(0, 0, w, h);
  const g = col.ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(230,222,210,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0.35)');
  col.ctx.fillStyle = g;
  col.ctx.fillRect(0, 0, w, h);
  hei.ctx.fillStyle = '#808080';
  hei.ctx.fillRect(0, 0, w, h);
  paperGrain(col.ctx, hei.ctx, w, h, 23);
  damaskField(hei.ctx, w, h, w * 0.3, 'rgba(255,255,255,0.55)', w * 0.006);
  damaskField(col.ctx, w, h, w * 0.3, 'rgba(165,175,195,0.10)', w * 0.004);

  rough.ctx.fillStyle = '#d0d0d0';
  rough.ctx.fillRect(0, 0, w, h);
  metal.ctx.fillStyle = '#000';
  metal.ctx.fillRect(0, 0, w, h);

  // gold foil hairline along the slanted edges
  const inset = w * 0.035;
  const tipY = h - inset * 1.6;
  const foil = (ctx: CanvasRenderingContext2D, style: string, lw: number) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(inset * 0.6, inset * 0.5);
    ctx.lineTo(w / 2, tipY);
    ctx.lineTo(w - inset * 0.6, inset * 0.5);
    ctx.stroke();
  };
  foil(col.ctx, PALETTE.gold, w * 0.004);
  foil(hei.ctx, 'rgba(255,255,255,0.6)', w * 0.004);
  foil(metal.ctx, '#fff', w * 0.006);
  foil(rough.ctx, '#3a3a3a', w * 0.006);

  // the reference's lace V-band, a little inside the edges
  const bandW = w * 0.085;
  const off = w * 0.11;
  laceBand(col.ctx, hei.ctx, off * 0.4, off * 0.9, w / 2, h - off * 0.95, bandW, 5);
  laceBand(col.ctx, hei.ctx, w - off * 0.4, off * 0.9, w / 2, h - off * 0.95, bandW, 9);

  return { ...surface(col.c, hei.c, rough.c, metal.c), liner: liner(Math.round(size * 0.75), aspect, 3) };
}

/** Inner liner: ice-blue paper with a fine toile of hydrangea florets. */
export function liner(size: number, aspect: number, seed: number): SurfaceSet {
  const w = size;
  const h = size * aspect;
  const col = canvas(w, h);
  const hei = canvas(w, h);
  const r = rng(seed);
  const g = col.ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#dbe5f4');
  g.addColorStop(1, '#c9d7ee');
  col.ctx.fillStyle = g;
  col.ctx.fillRect(0, 0, w, h);
  hei.ctx.fillStyle = '#808080';
  hei.ctx.fillRect(0, 0, w, h);
  paperGrain(col.ctx, hei.ctx, w, h, seed + 1, 'rgba(60,80,130,');
  const cell = w * 0.12;
  for (let y = cell * 0.5; y < h + cell; y += cell * 0.9) {
    for (let x = ((y / cell) % 2 ? cell * 0.5 : 0); x < w + cell; x += cell) {
      const s = cell * (0.16 + r() * 0.05);
      col.ctx.save();
      col.ctx.translate(x + (r() - 0.5) * cell * 0.2, y + (r() - 0.5) * cell * 0.2);
      col.ctx.rotate(r() * Math.PI);
      for (let p = 0; p < 4; p++) {
        col.ctx.rotate(Math.PI / 2);
        col.ctx.beginPath();
        col.ctx.ellipse(s * 0.55, 0, s * 0.5, s * 0.34, 0, 0, Math.PI * 2);
        col.ctx.fillStyle = 'rgba(255,255,255,0.55)';
        col.ctx.fill();
      }
      col.ctx.beginPath();
      col.ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2);
      col.ctx.fillStyle = 'rgba(201,165,92,0.6)';
      col.ctx.fill();
      col.ctx.restore();
    }
  }
  return surface(col.c, hei.c);
}

/** Wax seal relief: rim ring, beaded circle and the monogram. Used as bump + subtle tint. */
export function sealRelief(size: number, script: string): SurfaceSet {
  const w = size;
  const col = canvas(w, w);
  const hei = canvas(w, w);
  const rough = canvas(w, w);
  const c = w / 2;
  col.ctx.fillStyle = '#e7cf95';
  col.ctx.fillRect(0, 0, w, w);
  const rg = col.ctx.createRadialGradient(c * 0.8, c * 0.7, 0, c, c, c);
  rg.addColorStop(0, '#f6e3b0');
  rg.addColorStop(0.7, '#d4b06a');
  rg.addColorStop(1, '#a9843f');
  col.ctx.fillStyle = rg;
  col.ctx.fillRect(0, 0, w, w);

  // height: dome + recessed inner field + raised ring + beads + monogram
  const hg = hei.ctx.createRadialGradient(c, c, 0, c, c, c);
  hg.addColorStop(0, '#9a9a9a');
  hg.addColorStop(0.62, '#8a8a8a');
  hg.addColorStop(0.66, '#e0e0e0');
  hg.addColorStop(0.71, '#6a6a6a');
  hg.addColorStop(1, '#808080');
  hei.ctx.fillStyle = hg;
  hei.ctx.fillRect(0, 0, w, w);
  hei.ctx.fillStyle = '#d8d8d8';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    hei.ctx.beginPath();
    hei.ctx.arc(c + Math.cos(a) * c * 0.56, c + Math.sin(a) * c * 0.56, w * 0.008, 0, Math.PI * 2);
    hei.ctx.fill();
  }
  rough.ctx.fillStyle = '#5a5a5a';
  rough.ctx.fillRect(0, 0, w, w);

  const drawMono = (ctx: CanvasRenderingContext2D, fill: string, blur = 0) => {
    ctx.save();
    ctx.font = `${Math.round(w * 0.62)}px ${script}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    if (blur) {
      ctx.shadowColor = fill;
      ctx.shadowBlur = blur;
    }
    ctx.fillText('А', c - w * 0.01, c + w * 0.06);
    ctx.restore();
  };
  drawMono(hei.ctx, '#ffffff', w * 0.012);
  drawMono(hei.ctx, '#f4f4f4');
  drawMono(col.ctx, 'rgba(255,240,200,0.55)');
  drawMono(rough.ctx, '#262626');
  // small laurel sprigs under the letter
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + s * (0.35 + i * 0.16);
      const x = c + Math.cos(a) * c * 0.43;
      const y = c + Math.sin(a) * c * 0.43;
      hei.ctx.save();
      hei.ctx.translate(x, y);
      hei.ctx.rotate(a + (s * Math.PI) / 2);
      hei.ctx.beginPath();
      hei.ctx.ellipse(0, 0, w * 0.022, w * 0.009, 0, 0, Math.PI * 2);
      hei.ctx.fillStyle = '#e8e8e8';
      hei.ctx.fill();
      hei.ctx.restore();
    }
  }
  return surface(col.c, hei.c, rough.c);
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function foilFrame(ctxs: { col: CanvasRenderingContext2D; hei: CanvasRenderingContext2D; metal: CanvasRenderingContext2D; rough: CanvasRenderingContext2D }, w: number, h: number, inset: number) {
  const path = (ctx: CanvasRenderingContext2D) => {
    const r = inset * 0.9;
    ctx.beginPath();
    ctx.moveTo(inset + r, inset);
    ctx.lineTo(w - inset - r, inset);
    ctx.arc(w - inset, inset, r, Math.PI, Math.PI / 2, true);
    ctx.lineTo(w - inset, h - inset - r);
    ctx.arc(w - inset, h - inset, r, -Math.PI / 2, Math.PI, true);
    ctx.lineTo(inset + r, h - inset);
    ctx.arc(inset, h - inset, r, 0, -Math.PI / 2, true);
    ctx.lineTo(inset, inset + r);
    ctx.arc(inset, inset, r, Math.PI / 2, 0, true);
    ctx.stroke();
  };
  const lw = w * 0.0035;
  for (const [ctx, style] of [
    [ctxs.col, PALETTE.gold],
    [ctxs.hei, 'rgba(255,255,255,0.7)'],
    [ctxs.metal, '#ffffff'],
    [ctxs.rough, '#303030'],
  ] as const) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = style;
    path(ctx);
    ctx.lineWidth = lw * 0.5;
    ctx.save();
    ctx.translate(w * 0.012, w * 0.012);
    ctx.scale((w - w * 0.024) / w, (h - w * 0.024) / h);
    path(ctx);
    ctx.restore();
  }
}

function newCardCanvases(w: number, h: number, seed: number) {
  const col = canvas(w, h);
  const hei = canvas(w, h);
  const metal = canvas(w, h);
  const rough = canvas(w, h);
  col.ctx.fillStyle = '#fbf9f5';
  col.ctx.fillRect(0, 0, w, h);
  const g = col.ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, h * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(232,224,210,0.35)');
  col.ctx.fillStyle = g;
  col.ctx.fillRect(0, 0, w, h);
  hei.ctx.fillStyle = '#808080';
  hei.ctx.fillRect(0, 0, w, h);
  metal.ctx.fillStyle = '#000';
  metal.ctx.fillRect(0, 0, w, h);
  rough.ctx.fillStyle = '#c8c8c8';
  rough.ctx.fillRect(0, 0, w, h);
  paperGrain(col.ctx, hei.ctx, w, h, seed);
  return { col, hei, metal, rough };
}

function foilText(
  c: ReturnType<typeof newCardCanvases>,
  text: string,
  font: string,
  x: number,
  y: number,
  opts: { ink?: string; foil?: boolean; letterSpacing?: number } = {},
) {
  const all: [CanvasRenderingContext2D, string][] = [
    [c.col.ctx, opts.foil ? PALETTE.gold : (opts.ink ?? PALETTE.ink)],
    [c.hei.ctx, opts.foil ? '#ffffff' : '#9a9a9a'],
  ];
  if (opts.foil) {
    all.push([c.metal.ctx, '#ffffff'], [c.rough.ctx, '#2a2a2a']);
  }
  for (const [ctx, style] of all) {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (opts.letterSpacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${opts.letterSpacing}px`;
    ctx.fillStyle = style;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

function sprig(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, style: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.strokeStyle = style;
  ctx.fillStyle = style;
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.5, -s * 0.12, s, 0);
  ctx.stroke();
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const px = t * s;
    const py = -Math.sin(t * Math.PI) * s * 0.06;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(side * 0.7 - 0.2);
      ctx.beginPath();
      ctx.ellipse(s * 0.05, 0, s * 0.06, s * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Inside of the bi-fold card (both halves). The name is drawn on a separate reveal layer. */
export function cardInside(size: number, aspect: number, serif: string): SurfaceSet {
  const w = size;
  const h = size * aspect;
  const c = newCardCanvases(w, h, 41);
  foilFrame({ col: c.col.ctx, hei: c.hei.ctx, metal: c.metal.ctx, rough: c.rough.ctx }, w, h, w * 0.05);
  // fold crease across the middle
  c.hei.ctx.fillStyle = 'rgba(0,0,0,0.35)';
  c.hei.ctx.fillRect(0, h / 2 - 1, w, 2);
  c.col.ctx.fillStyle = 'rgba(120,110,100,0.08)';
  c.col.ctx.fillRect(0, h / 2 - w * 0.004, w, w * 0.008);

  foilText(c, 'КЫЗ УЗАТУУ', `600 ${Math.round(w * 0.05)}px ${serif}`, w / 2, h * 0.2, { foil: true, letterSpacing: w * 0.012 });
  sprig(c.col.ctx, w / 2 - w * 0.06, h * 0.255, w * 0.22, -1, PALETTE.gold);
  sprig(c.col.ctx, w / 2 + w * 0.06, h * 0.255, w * 0.22, 1, PALETTE.gold);
  sprig(c.metal.ctx, w / 2 - w * 0.06, h * 0.255, w * 0.22, -1, '#fff');
  sprig(c.metal.ctx, w / 2 + w * 0.06, h * 0.255, w * 0.22, 1, '#fff');
  foilText(c, 'Сиздерди кыз узатуу тоюна', `600 ${Math.round(w * 0.054)}px ${serif}`, w / 2, h * 0.615, { ink: PALETTE.ink });
  foilText(c, 'чакырабыз', `600 ${Math.round(w * 0.054)}px ${serif}`, w / 2, h * 0.658, { ink: PALETTE.ink });
  foilText(c, '12 · 12 · 2026', `600 ${Math.round(w * 0.08)}px ${serif}`, w / 2, h * 0.75, { foil: true, letterSpacing: w * 0.006 });
  foilText(c, 'ИШЕМБИ · 16:00 · РЕСТОРАН «АДЕМ»', `600 ${Math.round(w * 0.038)}px ${serif}`, w / 2, h * 0.81, { ink: PALETTE.ink, letterSpacing: w * 0.006 });
  // small heart ornament
  const heart = (ctx: CanvasRenderingContext2D, style: string) => {
    ctx.save();
    ctx.translate(w / 2, h * 0.88);
    ctx.scale(w * 0.0011, w * 0.0011);
    ctx.fillStyle = style;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-14, -6, -6, -18, 0, -8);
    ctx.bezierCurveTo(6, -18, 14, -6, 0, 6);
    ctx.fill();
    ctx.restore();
  };
  heart(c.col.ctx, PALETTE.gold);
  heart(c.metal.ctx, '#fff');
  return surface(c.col.c, c.hei.c, c.rough.c, c.metal.c);
}

/** Cover of the folded card – drawn rotated 180° because the panel is flipped about X. */
export function cardCover(size: number, aspect: number, script: string, serif: string): SurfaceSet {
  const w = size;
  const h = size * aspect;
  const c = newCardCanvases(w, h, 77);
  for (const ctx of [c.col.ctx, c.hei.ctx, c.metal.ctx, c.rough.ctx]) {
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
  }
  damaskField(c.hei.ctx, w, h, w * 0.22, 'rgba(255,255,255,0.35)', w * 0.004);
  foilFrame({ col: c.col.ctx, hei: c.hei.ctx, metal: c.metal.ctx, rough: c.rough.ctx }, w, h, w * 0.06);
  foilText(c, 'А', `${Math.round(h * 0.55)}px ${script}`, w / 2, h * 0.5, { foil: true });
  foilText(c, 'КЫЗ УЗАТУУ · 2026', `500 ${Math.round(w * 0.032)}px ${serif}`, w / 2, h * 0.86, { foil: true, letterSpacing: w * 0.01 });
  return surface(c.col.c, c.hei.c, c.rough.c, c.metal.c);
}

/** The bride's name as an RGBA layer (ink + soft gold shadow), revealed with an alpha sweep. */
export function nameLayer(size: number, script: string): { map: THREE.Texture; aspect: number } {
  const w = size;
  const h = Math.round(size * 0.42);
  const { c, ctx } = canvas(w, h);
  ctx.font = `${Math.round(h * 0.6)}px ${script}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.8);
  grad.addColorStop(0, '#3a4c8e');
  grad.addColorStop(1, '#26346a');
  ctx.shadowColor = 'rgba(201,165,92,0.45)';
  ctx.shadowBlur = h * 0.03;
  ctx.shadowOffsetY = h * 0.01;
  ctx.fillStyle = grad;
  ctx.fillText('Айчолпон', w / 2, h * 0.52);
  return { map: toTexture(c, true), aspect: h / w };
}

/** Horizontal ramp used as an animated alphaMap (offset.x sweeps the reveal). */
export function revealRamp(): THREE.Texture {
  const { c, ctx } = canvas(256, 4);
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.45, '#fff');
  g.addColorStop(0.55, '#000');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 4);
  const t = toTexture(c, false, 1);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

/** Silk-like table surface the envelope rests on. Tiled. */
export function backdrop(size: number): SurfaceSet {
  const w = size;
  const col = canvas(w, w);
  const hei = canvas(w, w);
  col.ctx.fillStyle = '#c8d1df';
  col.ctx.fillRect(0, 0, w, w);
  hei.ctx.fillStyle = '#808080';
  hei.ctx.fillRect(0, 0, w, w);
  const r = rng(99);
  // gentle silk waves
  for (let i = 0; i < 26; i++) {
    const y = r() * w;
    const amp = w * (0.01 + r() * 0.03);
    for (const [ctx, style] of [
      [col.ctx, `rgba(255,255,255,${0.08 + r() * 0.12})`],
      [hei.ctx, `rgba(255,255,255,${0.05 + r() * 0.08})`],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w * (0.01 + r() * 0.03);
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += w / 32) {
        const yy = y + Math.sin((x / w) * Math.PI * 2 * 2 + i) * amp;
        if (x < 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
  paperGrain(col.ctx, hei.ctx, w, w, 7);
  const s = surface(col.c, hei.c);
  for (const t of [s.map, s.bumpMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  return s;
}

/** Soft round sprite for particles and glows. */
export function glowSprite(): THREE.Texture {
  const { c, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,240,200,0.7)');
  g.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c, true, 1);
}
