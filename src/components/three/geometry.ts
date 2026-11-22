import * as THREE from 'three';

/** Envelope dimensions in world units (portrait, like the reference). */
export const ENV = {
  W: 1.5,
  H: 2.1,
  FLAP: 1.18,
  NOTCH: 0.36,
  PANEL: 0.012,
  POCKET_Z: 0.034,
  CARD_W: 1.3,
  CARD_H: 1.9,
  SEAL_R: 0.2,
} as const;

/** Planar UVs over the geometry's XY bounding box (caps map 0..1 exactly once). */
export function planarUV(geo: THREE.BufferGeometry, box?: { minX: number; maxX: number; minY: number; maxY: number }) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const minX = box?.minX ?? bb.min.x;
  const maxX = box?.maxX ?? bb.max.x;
  const minY = box?.minY ?? bb.min.y;
  const maxY = box?.maxY ?? bb.max.y;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - minX) / (maxX - minX);
    uv[i * 2 + 1] = (pos.getY(i) - minY) / (maxY - minY);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const bevel = (t: number) => ({
  bevelEnabled: true,
  bevelThickness: t * 0.35,
  bevelSize: t * 0.35,
  bevelSegments: 2,
  curveSegments: 10,
});

export function backPanelGeometry() {
  const g = new THREE.ExtrudeGeometry(roundedRect(ENV.W, ENV.H, 0.035), { depth: ENV.PANEL, ...bevel(0.008) });
  return planarUV(g);
}

/** Front pocket: full rectangle with a shallow V-notch at the top (where the liner shows). */
export function pocketGeometry() {
  const { W, H, NOTCH } = ENV;
  const s = new THREE.Shape();
  const r = 0.035;
  s.moveTo(-W / 2 + r, -H / 2);
  s.lineTo(W / 2 - r, -H / 2);
  s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r);
  s.lineTo(W / 2, H / 2 - 0.03);
  s.quadraticCurveTo(W * 0.25, H / 2 - NOTCH * 0.45, 0.04, H / 2 - NOTCH);
  s.quadraticCurveTo(0, H / 2 - NOTCH - 0.012, -0.04, H / 2 - NOTCH);
  s.quadraticCurveTo(-W * 0.25, H / 2 - NOTCH * 0.45, -W / 2, H / 2 - 0.03);
  s.lineTo(-W / 2, -H / 2 + r);
  s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: ENV.PANEL, ...bevel(0.008) });
  return planarUV(g, { minX: -W / 2, maxX: W / 2, minY: -H / 2, maxY: H / 2 });
}

/** Liner visible inside the envelope through the notch (a plane on the back panel's inner face). */
export function linerGeometry() {
  const g = new THREE.PlaneGeometry(ENV.W - 0.04, ENV.H * 0.5);
  g.translate(0, ENV.H * 0.25 - 0.02, 0);
  return g;
}

/** Flap shape: hinge on y=0, tip at y=-FLAP, softly curved sides and rounded tip. */
export function flapShape() {
  const { W, FLAP } = ENV;
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(W / 2, 0);
  s.quadraticCurveTo(W * 0.3, -FLAP * 0.55, 0.11, -FLAP + 0.05);
  s.quadraticCurveTo(0, -FLAP - 0.01, -0.11, -FLAP + 0.05);
  s.quadraticCurveTo(-W * 0.3, -FLAP * 0.55, -W / 2, 0);
  return s;
}

export function flapGeometry() {
  const g = new THREE.ExtrudeGeometry(flapShape(), { depth: 0.004, ...bevel(0.006) });
  return planarUV(g, { minX: -ENV.W / 2, maxX: ENV.W / 2, minY: -ENV.FLAP, maxY: 0 });
}

export function flapLinerGeometry() {
  const g = new THREE.ShapeGeometry(flapShape(), 10);
  return planarUV(g, { minX: -ENV.W / 2, maxX: ENV.W / 2, minY: -ENV.FLAP, maxY: 0 });
}

/* ------------------------------------------------------------------ */
/* Wax seal                                                            */
/* ------------------------------------------------------------------ */

function sealRadius(a: number) {
  // irregular poured-wax outline
  return ENV.SEAL_R * (1 + 0.035 * Math.sin(a * 5 + 0.7) + 0.025 * Math.sin(a * 9 + 2.1) + 0.015 * Math.sin(a * 17));
}

const crack = [
  [0.0, 1],
  [0.03, 0.62],
  [-0.025, 0.3],
  [0.02, 0.02],
  [-0.03, -0.32],
  [0.018, -0.66],
  [0.0, -1],
] as const;

const sealExtrude = (): THREE.ExtrudeGeometryOptions => ({
  depth: 0.022,
  bevelEnabled: true,
  bevelThickness: 0.026,
  bevelSize: 0.022,
  bevelSegments: 5,
  curveSegments: 6,
});

function sealUV(g: THREE.BufferGeometry) {
  const R = ENV.SEAL_R * 1.12;
  return planarUV(g, { minX: -R, maxX: R, minY: -R, maxY: R });
}

export function sealGeometry() {
  const s = new THREE.Shape();
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = sealRadius(a);
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return sealUV(new THREE.ExtrudeGeometry(s, sealExtrude()));
}

/** The two halves the seal breaks into (sharing the same jagged crack). */
export function sealHalfGeometry(side: 1 | -1) {
  const s = new THREE.Shape();
  const N = 36;
  const top = sealRadius(Math.PI / 2);
  s.moveTo(crack[0][0] * ENV.SEAL_R, top);
  for (let i = 1; i <= N; i++) {
    const a = Math.PI / 2 - side * (i / N) * Math.PI;
    const r = sealRadius(a);
    s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let i = crack.length - 2; i >= 1; i--) {
    const [x, y] = crack[i]!;
    s.lineTo(x * ENV.SEAL_R, y * sealRadius(y > 0 ? Math.PI / 2 : -Math.PI / 2));
  }
  return sealUV(new THREE.ExtrudeGeometry(s, { ...sealExtrude(), bevelSize: 0.012, bevelThickness: 0.02 }));
}

/* ------------------------------------------------------------------ */
/* Flora                                                               */
/* ------------------------------------------------------------------ */

/** Four-petal hydrangea floret, cupped, facing +Z. ~100 triangles. */
export function floretGeometry() {
  const s = new THREE.Shape();
  const petals = 4;
  const inner = 0.12;
  const at = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r] as const;
  for (let p = 0; p < petals; p++) {
    const a = (p / petals) * Math.PI * 2;
    const g1 = at(a - Math.PI / 4, inner);
    if (p === 0) s.moveTo(g1[0], g1[1]);
    const c1 = at(a - 0.6, 0.82);
    const c2 = at(a - 0.3, 1.1);
    const tip = at(a, 1);
    s.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], tip[0], tip[1]);
    const c3 = at(a + 0.3, 1.1);
    const c4 = at(a + 0.6, 0.82);
    const g2 = at(a + Math.PI / 4, inner);
    s.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], g2[0], g2[1]);
  }
  const g = new THREE.ShapeGeometry(s, 5);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r2 = x * x + y * y;
    // cupped petals with a slightly ruffled rim
    pos.setZ(i, r2 * 0.32 + Math.sin(Math.atan2(y, x) * 8) * 0.03 * r2);
  }
  g.computeVertexNormals();
  planarUV(g);
  return g;
}

/** Lanceolate leaf with a folded midrib, facing +Z, base at origin, pointing +Y. */
export function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.42, 0.25, 0.36, 0.8, 0, 1.25);
  s.bezierCurveTo(-0.36, 0.8, -0.42, 0.25, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -Math.abs(x) * 0.35 + Math.sin(y * 2.2) * 0.06 - y * y * 0.05);
  }
  g.computeVertexNormals();
  planarUV(g);
  return g;
}

/** Single loose petal for the drifting petals. */
export function petalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.5, 0.2, 0.55, 0.85, 0, 1);
  s.bezierCurveTo(-0.55, 0.85, -0.5, 0.2, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, x * x * 0.6 - y * 0.1);
  }
  g.computeVertexNormals();
  g.translate(0, -0.5, 0);
  return g;
}
