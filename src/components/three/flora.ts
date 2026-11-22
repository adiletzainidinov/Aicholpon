import * as THREE from 'three';

export type FlowerKind = 'hydrangea' | 'wisteria';
export type Tone = 'blue' | 'sky' | 'lilac' | 'pearl';

export interface ClusterSpec {
  kind: FlowerKind;
  x: number;
  y: number;
  z: number;
  r: number;
  tone: Tone;
  leaves?: number;
  /** leaf fan direction in radians (0 = right) */
  leafDir?: number;
  seed: number;
}

const TONES: Record<Tone, [string, string, string]> = {
  blue: ['#5f7fc8', '#86a3df', '#b7c9ee'],
  sky: ['#8fb0e3', '#b5cbef', '#e3ecf9'],
  lilac: ['#8d8fd0', '#aeb0e4', '#d9dbf5'],
  pearl: ['#c9d6ee', '#e4ebf7', '#fbfbfd'],
};

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

export interface FloraBuffers {
  florets: { matrices: Float32Array; colors: Float32Array; count: number };
  leaves: { matrices: Float32Array; colors: Float32Array; count: number };
  cores: { matrices: Float32Array; colors: Float32Array; count: number };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _n = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();
const _c2 = new THREE.Color();

/** Generates instance transforms/colours for a set of clusters. Deterministic per seed. */
export function buildFlora(clusters: ClusterSpec[], floretsPerCluster: number): FloraBuffers {
  const fl: number[] = [];
  const flc: number[] = [];
  const lv: number[] = [];
  const lvc: number[] = [];
  const co: number[] = [];
  const coc: number[] = [];

  const push = (arr: number[], carr: number[], m: THREE.Matrix4, c: THREE.Color) => {
    arr.push(...m.elements);
    carr.push(c.r, c.g, c.b);
  };

  for (const cl of clusters) {
    const r = rng(cl.seed);
    const [c0, c1, c2] = TONES[cl.tone];
    if (cl.kind === 'hydrangea') {
      // inner core hides gaps between florets
      _m.compose(_p.set(cl.x, cl.y, cl.z - cl.r * 0.1), _q.identity(), _s.setScalar(cl.r * 0.86));
      push(co, coc, _m, _c.set(c0).multiplyScalar(0.55));
      const n = floretsPerCluster;
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        // fibonacci dome, biased to the camera-facing hemisphere
        const y = 1 - (i / (n - 1)) * 1.55;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const th = golden * i;
        _n.set(Math.cos(th) * rad, Math.sin(th) * rad, y).normalize();
        // swap so the dome faces +Z
        const nx = _n.x;
        const ny = _n.y;
        const nz = _n.z;
        _n.set(nx, ny, nz);
        const jitter = 0.94 + r() * 0.1;
        _p.set(cl.x + _n.x * cl.r * jitter, cl.y + _n.y * cl.r * jitter * 0.92, cl.z + _n.z * cl.r * 0.8 * jitter);
        _q.setFromUnitVectors(_z, _n);
        _q2.setFromAxisAngle(_z, r() * Math.PI * 2);
        _q.multiply(_q2);
        const sc = cl.r * (0.25 + r() * 0.08);
        // every floret is cupped a little differently
        _m.compose(_p, _q, _s.set(sc, sc * (0.92 + r() * 0.16), sc * (0.65 + r() * 0.8)));
        const t = r();
        _c.set(t < 0.45 ? c0 : t < 0.85 ? c1 : c2);
        _c2.set(c2);
        _c.lerp(_c2, r() * 0.3);
        // fake ambient occlusion: florets on the rim / back are darker
        _c.multiplyScalar(0.72 + 0.32 * Math.max(0, _n.z));
        push(fl, flc, _m, _c);
      }
    } else {
      // wisteria raceme hanging down from (x,y)
      const n = Math.round(floretsPerCluster * 0.55);
      const len = cl.r * 4;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const radius = cl.r * 0.42 * (1 - t * 0.75);
        const a = i * 2.39996;
        _p.set(cl.x + Math.cos(a) * radius + Math.sin(t * 3) * cl.r * 0.1, cl.y - t * len, cl.z + Math.sin(a) * radius * 0.7);
        _n.set(Math.cos(a), -0.35, Math.abs(Math.sin(a)) + 0.4).normalize();
        _q.setFromUnitVectors(_z, _n);
        _q2.setFromAxisAngle(_z, r() * Math.PI * 2);
        _q.multiply(_q2);
        _m.compose(_p, _q, _s.setScalar(cl.r * (0.16 - t * 0.07) * (0.85 + r() * 0.3)));
        _c.set(t < 0.4 ? c0 : t < 0.75 ? c1 : c2);
        _c.lerp(_c2.set('#ffffff'), t * 0.25);
        push(fl, flc, _m, _c);
      }
    }

    const leaves = cl.leaves ?? 0;
    const dir = cl.leafDir ?? -Math.PI / 2;
    for (let i = 0; i < leaves; i++) {
      const a = dir + (i - (leaves - 1) / 2) * 0.55 + (r() - 0.5) * 0.25;
      const dist = cl.kind === 'hydrangea' ? cl.r * 0.55 : cl.r * 0.2;
      _p.set(cl.x + Math.cos(a) * dist, cl.y + Math.sin(a) * dist, cl.z - cl.r * 0.35);
      _q.setFromEuler(new THREE.Euler(0.25 + r() * 0.25, (r() - 0.5) * 0.4, a - Math.PI / 2));
      const sc = cl.r * (0.85 + r() * 0.35);
      _m.compose(_p, _q, _s.set(sc * 0.75, sc, sc));
      _c.set(r() > 0.5 ? '#8ea596' : '#a9baa9').lerp(_c2.set('#c9d2d6'), r() * 0.4);
      push(lv, lvc, _m, _c);
    }
  }

  return {
    florets: { matrices: new Float32Array(fl), colors: new Float32Array(flc), count: flc.length / 3 },
    leaves: { matrices: new Float32Array(lv), colors: new Float32Array(lvc), count: lvc.length / 3 },
    cores: { matrices: new Float32Array(co), colors: new Float32Array(coc), count: coc.length / 3 },
  };
}

/** Petal tint map: deeper at the centre, luminous at the rim, faint veins. */
export function petalMap(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, '#8d8fb0');
  g.addColorStop(0.18, '#c8d0e6');
  g.addColorStop(0.7, '#f4f6fb');
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(120,130,170,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 10, 64 + Math.sin(a) * 10);
    ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(64, 64, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#e9d9a8';
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface FloraUniforms {
  uTime: { value: number };
  /** 0..1 – intro bouquet steps aside while the envelope opens */
  uSpread: { value: number };
  /** camera height – column florets open up as they approach the centre of the view */
  uCamY: { value: number };
}

/**
 * GPU-only animation for instanced flora (no per-frame CPU work):
 * wind sway, optional "spread" away from the envelope, optional bloom-on-approach,
 * and a touch of light scattering so petals read as soft tissue rather than plastic.
 */
export function addFloraShader(
  material: THREE.Material,
  uniforms: FloraUniforms,
  opts: { sway: number; spread?: boolean; bloom?: boolean; scatter?: number },
) {
  const { sway, spread = false, bloom = false, scatter = 0 } = opts;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSpread = uniforms.uSpread;
    shader.uniforms.uCamY = uniforms.uCamY;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSpread;\nuniform float uCamY;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float sx = max(length(instanceMatrix[0].xyz), 0.0001);
  float sy = max(length(instanceMatrix[1].xyz), 0.0001);
  ${
    bloom
      ? `float openness = smoothstep(3.4, 1.1, abs(ip.y - uCamY));
  transformed.xy *= mix(0.62, 1.0, openness);
  transformed.z *= mix(1.7, 1.0, openness);`
      : ''
  }
  float ph = ip.x * 2.3 + ip.y * 1.7;
  transformed.x += sin(uTime * 0.9 + ph) * ${sway.toFixed(4)} / sx;
  transformed.y += cos(uTime * 0.7 + ph * 1.3) * ${(sway * 0.6).toFixed(4)} / sy;
  ${
    spread
      ? `// only the bouquet around the envelope (|y| < 1.9) steps aside
  vec2 away = ip.xy / max(length(ip.xy), 0.001);
  transformed.xy += away * uSpread * 0.12 * step(abs(ip.y), 1.9) / vec2(sx, sy);`
      : ''
  }
#endif`,
      );
    if (scatter > 0) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * ${scatter.toFixed(3)};`,
      );
    }
  };
  material.customProgramCacheKey = () => `flora-${sway}-${spread}-${bloom}-${scatter}`;
}
