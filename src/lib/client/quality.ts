export type Quality = 'high' | 'balanced' | 'lite';

export interface QualityProfile {
  tier: Quality;
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  floretsPerCluster: number;
  particles: number;
  textureSize: number;
  physical: boolean;
  continuousScroll: boolean;
}

export const PROFILES: Record<Exclude<Quality, 'lite'>, QualityProfile> = {
  high: {
    tier: 'high',
    dpr: [1, 2],
    shadows: true,
    shadowMapSize: 1024,
    floretsPerCluster: 120,
    particles: 90,
    textureSize: 1024,
    physical: true,
    continuousScroll: true,
  },
  balanced: {
    tier: 'balanced',
    dpr: [1, 1.5],
    shadows: true,
    shadowMapSize: 512,
    floretsPerCluster: 70,
    particles: 40,
    textureSize: 768,
    physical: false,
    continuousScroll: false,
  },
};

/** 'none' – no WebGL; 'software' – CPU rasteriser (SwiftShader/llvmpipe): 3D would stutter. */
function webgl(): 'gpu' | 'software' | 'none' {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer) ? 'software' : 'gpu';
  } catch {
    return 'none';
  }
}

/** Picks a quality tier from cheap, synchronous device signals. Runtime FPS can lower it further. */
export function detectQuality(): Quality {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced === 'lite' || forced === 'balanced' || forced === 'high') return forced;

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  if (webgl() !== 'gpu') return 'lite';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'lite';
  if (nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? '')) return 'lite';

  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (mem <= 2 || cores <= 2) return 'lite';

  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  if (iOS) return 'high';
  const mobile = /Android|Mobi/i.test(ua);
  if (mobile) return cores >= 8 && mem >= 6 ? 'high' : 'balanced';
  return cores >= 4 ? 'high' : 'balanced';
}
