'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import * as THREE from 'three';
import { glowSprite } from './textures';

export interface SparkBurst {
  fire(origin: THREE.Vector3): void;
}

const sparkVertex = /* glsl */ `
  uniform float uT;
  uniform float uScale;
  attribute vec3 aVel;
  attribute float aDelay;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    float t = max(uT - aDelay, 0.0);
    float k = 2.4;
    vec3 p = position + aVel * (1.0 - exp(-k * t)) / k + vec3(0.0, 0.16 * t * t, 0.0);
    float life = clamp(t / 2.2, 0.0, 1.0);
    float on = step(aDelay, uT) * step(0.0001, uT);
    vAlpha = on * pow(1.0 - life, 1.6) * (0.65 + 0.35 * sin(t * 24.0 + aSize * 40.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uScale * (1.0 - 0.4 * life) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  attribute float aSize;
  attribute float aPhase;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.21 + aPhase) * 0.25;
    p.y += mod(uTime * 0.05 + aPhase, 1.0) * 0.6 - 0.3;
    p.z += cos(uTime * 0.17 + aPhase * 1.7) * 0.15;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAlpha = 0.35 + 0.35 * sin(uTime * 1.3 + aPhase * 6.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor * tex.rgb, tex.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/** Golden spark burst used when the seal breaks. */
export function Sparks({ count, apiRef }: { count: number; apiRef: Ref<SparkBurst | null> }) {
  const points = useRef<THREE.Points>(null);
  const state = useRef({ t: -1 });
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const delay = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      const speed = 0.6 + Math.random() * 1.6;
      vel[i * 3] = Math.cos(a) * speed * 0.8;
      vel[i * 3 + 1] = (up * 1.4 - 0.2) * speed;
      vel[i * 3 + 2] = 0.3 + Math.random() * 0.9;
      delay[i] = Math.random() * 0.35;
      size[i] = 0.012 + Math.random() * 0.035;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: fragment,
      uniforms: {
        uT: { value: 0 },
        uScale: { value: 1 },
        uMap: { value: glowSprite() },
        uColor: { value: new THREE.Color('#ffd27a') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      (material.uniforms.uMap!.value as THREE.Texture).dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useImperativeHandle(apiRef, () => ({
    fire(origin) {
      points.current?.position.copy(origin);
      state.current.t = 0;
      if (points.current) points.current.visible = true;
    },
  }));

  useFrame(({ size, viewport }, dt) => {
    material.uniforms.uScale!.value = (size.height * viewport.dpr) / 0.5735;
    if (state.current.t < 0) return;
    state.current.t += Math.min(dt, 0.05);
    material.uniforms.uT!.value = state.current.t;
    if (state.current.t > 3 && points.current) {
      points.current.visible = false;
      state.current.t = -1;
    }
  });

  return <points ref={points} geometry={geometry} material={material} visible={false} frustumCulled={false} />;
}

/** Slowly floating golden motes that follow the camera. */
export function Dust({ count }: { count: number }) {
  const group = useRef<THREE.Points>(null);
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = 0.2 + Math.random() * 1.6;
      size[i] = 0.006 + Math.random() * 0.012;
      phase[i] = Math.random() * 10;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
        uMap: { value: glowSprite() },
        uColor: { value: new THREE.Color('#f3d9a0') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      (material.uniforms.uMap!.value as THREE.Texture).dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ camera, clock, size, viewport }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
    material.uniforms.uScale!.value = (size.height * viewport.dpr) / 0.5735;
    if (group.current) group.current.position.y = camera.position.y;
  });

  return <points ref={group} geometry={geometry} material={material} frustumCulled={false} />;
}

const bokehVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uCamY;
  uniform float uHalfW;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec3 p = position;
    // wraps around the camera and slides ~1.6x faster than the content → foreground depth
    p.y = uCamY + mod(position.y - uCamY * 0.6 + 3.0, 6.0) - 3.0;
    // x is stored as a fraction of the visible half-width → the layer frames any screen shape
    p.x = position.x * uHalfW + sin(uTime * 0.11 + aPhase) * 0.04;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAlpha = 0.11 + 0.07 * sin(uTime * 0.4 + aPhase * 3.0);
    vColor = aColor;
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const bokehFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    // soft lens disc with a faint brighter rim, like an out-of-focus highlight
    float disc = smoothstep(1.0, 0.82, d);
    float rim = smoothstep(0.72, 0.9, d) * smoothstep(1.0, 0.9, d);
    float a = (disc * 0.75 + rim * 0.5) * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

/** Out-of-focus foreground highlights close to the lens (a cinematic depth layer). */
export function Bokeh({ count }: { count: number }) {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const palette = [new THREE.Color('#c9d8f4'), new THREE.Color('#f4e3bf'), new THREE.Color('#ffffff'), new THREE.Color('#b9c4ee')];
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      pos[i * 3] = side * (0.6 + Math.random() * 0.45);
      pos[i * 3 + 1] = (i / count) * 6 - 3 + Math.random() * 0.4;
      pos[i * 3 + 2] = 0;
      size[i] = 0.07 + Math.random() * 0.14;
      phase[i] = Math.random() * 10;
      palette[i % palette.length]!.toArray(color, i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: bokehVertex,
      fragmentShader: bokehFragment,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uCamY: { value: 0 }, uHalfW: { value: 0.3 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    return { geometry: g, material: m };
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const ref = useRef<THREE.Points>(null);
  useFrame(({ camera, clock, size, viewport }) => {
    material.uniforms.uTime!.value = clock.elapsedTime;
    material.uniforms.uScale!.value = (size.height * viewport.dpr) / 0.5735;
    material.uniforms.uCamY!.value = camera.position.y;
    material.uniforms.uHalfW!.value = 2.3 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360) * (size.width / size.height);
    // the layer lives ~2.3 units in front of the lens; x is world-fixed so pointer/tilt parallax is strong
    if (ref.current) ref.current.position.z = camera.position.z - 2.3;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />;
}
