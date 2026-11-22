'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { QualityProfile } from '@/lib/client/quality';
import { addSway, buildFlora, petalMap, type ClusterSpec, type Tone } from './flora';
import { floretGeometry, leafGeometry, petalGeometry } from './geometry';
import { CARD_FINAL } from './rig';

/** Bouquet arranged around the envelope, like a flat-lay photograph. */
export const INTRO_CLUSTERS: ClusterSpec[] = [
  { kind: 'hydrangea', x: -0.88, y: 1.1, z: 0.26, r: 0.3, tone: 'blue', leaves: 4, leafDir: Math.PI * 0.8, seed: 1 },
  { kind: 'hydrangea', x: -0.52, y: 1.32, z: 0.18, r: 0.16, tone: 'sky', seed: 2 },
  { kind: 'hydrangea', x: 0.88, y: -1.1, z: 0.28, r: 0.34, tone: 'sky', leaves: 5, leafDir: -Math.PI * 0.25, seed: 3 },
  { kind: 'hydrangea', x: 0.46, y: -1.34, z: 0.2, r: 0.19, tone: 'blue', seed: 4 },
  { kind: 'hydrangea', x: -0.92, y: -0.86, z: 0.16, r: 0.19, tone: 'lilac', leaves: 2, leafDir: Math.PI * 1.1, seed: 5 },
  { kind: 'hydrangea', x: 0.9, y: 0.3, z: 0.12, r: 0.15, tone: 'pearl', leaves: 2, leafDir: 0, seed: 6 },
  { kind: 'wisteria', x: 0.6, y: 1.32, z: 0.32, r: 0.19, tone: 'lilac', leaves: 2, leafDir: Math.PI / 2, seed: 7 },
  { kind: 'wisteria', x: 0.84, y: 1.24, z: 0.22, r: 0.15, tone: 'blue', seed: 8 },
];

const TONES: Tone[] = ['blue', 'sky', 'lilac', 'pearl', 'blue', 'sky'];

/** Columns of flowers framing the content while scrolling (both sides, varying depth → parallax). */
export function columnClusters(viewH: number, halfW: number, screens: number): ClusterSpec[] {
  const out: ClusterSpec[] = [];
  const step = viewH * 0.5;
  const n = Math.ceil((screens * viewH) / step) + 2;
  const narrow = halfW < 1.2;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const y = CARD_FINAL.y + viewH * 0.3 - i * step - (side > 0 ? step * 0.35 : 0);
    const depth = (i * 37) % 5;
    const z = 0.05 + depth * 0.14;
    const r = (narrow ? 0.29 : 0.34) * (0.85 + ((i * 13) % 7) * 0.05);
    const kind = i % 5 === 3 ? 'wisteria' : 'hydrangea';
    // the envelope's own bouquet owns this band – keep the first frame uncluttered
    if (Math.abs(y) < 1.75) continue;
    out.push({
      kind,
      x: side * (halfW + (narrow ? -0.02 : -0.05) + (kind === 'wisteria' ? -0.12 : 0)),
      y: kind === 'wisteria' ? y + r * 2 : y,
      z,
      r,
      tone: TONES[i % TONES.length]!,
      leaves: 3,
      leafDir: side > 0 ? Math.PI * 0.1 : Math.PI * 0.9,
      seed: 100 + i,
    });
    if (i % 2 === 0) {
      out.push({ kind: 'hydrangea', x: side * (halfW - 0.05), y: y - r * 1.3, z: z + 0.1, r: r * 0.5, tone: 'pearl', seed: 300 + i });
    }
  }
  return out;
}

function useInstanced(mesh: React.RefObject<THREE.InstancedMesh | null>, data: { matrices: Float32Array; colors: Float32Array; count: number }) {
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.instanceMatrix.array.set(data.matrices);
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor = new THREE.InstancedBufferAttribute(data.colors, 3);
    m.computeBoundingSphere();
  }, [mesh, data]);
}

function Flora({
  clusters,
  profile,
  materials,
  geometries,
}: {
  clusters: ClusterSpec[];
  profile: QualityProfile;
  materials: { floret: THREE.Material; leaf: THREE.Material; core: THREE.Material };
  geometries: { floret: THREE.BufferGeometry; leaf: THREE.BufferGeometry; core: THREE.BufferGeometry };
}) {
  const data = useMemo(() => buildFlora(clusters, profile.floretsPerCluster), [clusters, profile.floretsPerCluster]);
  const florets = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const cores = useRef<THREE.InstancedMesh>(null);
  useInstanced(florets, data.florets);
  useInstanced(leaves, data.leaves);
  useInstanced(cores, data.cores);
  return (
    <>
      <instancedMesh key={`c${data.cores.count}`} ref={cores} args={[geometries.core, materials.core, data.cores.count]} castShadow />
      <instancedMesh key={`l${data.leaves.count}`} ref={leaves} args={[geometries.leaf, materials.leaf, data.leaves.count]} castShadow receiveShadow />
      <instancedMesh key={`f${data.florets.count}`} ref={florets} args={[geometries.floret, materials.floret, data.florets.count]} castShadow />
    </>
  );
}

/** Loose petals drifting through the frame (CPU-animated, a few dozen instances). */
function Petals({ count, material, geometry }: { count: number; material: THREE.Material; geometry: THREE.BufferGeometry }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const state = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * 3,
        y: (Math.random() - 0.5) * 4,
        z: 0.3 + Math.random() * 1.4,
        rx: Math.random() * 6,
        ry: Math.random() * 6,
        speed: 0.08 + Math.random() * 0.12,
        sway: 0.4 + Math.random() * 0.6,
        phase: i * 1.7,
        s: 0.045 + Math.random() * 0.03,
        color: new THREE.Color(['#b4c7ee', '#d5e0f6', '#ffffff', '#c9caf0'][i % 4]!),
      })),
    [count],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    state.forEach((p, i) => m.setColorAt(i, p.color));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [state]);
  useFrame(({ camera, clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const d = Math.min(dt, 0.05);
    state.forEach((p, i) => {
      p.y -= p.speed * d;
      p.rx += d * 0.6;
      p.ry += d * 0.4;
      const rel = p.y - camera.position.y;
      if (rel < -2.4) p.y = camera.position.y + 2.4;
      if (rel > 2.6) p.y = camera.position.y - 2.3;
      dummy.position.set(p.x + Math.sin(t * p.sway + p.phase) * 0.25, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, Math.sin(t + p.phase));
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} castShadow />;
}

function bands<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default function FloralScene({
  profile,
  columns,
  time,
}: {
  profile: QualityProfile;
  columns: ClusterSpec[];
  time: { value: number };
}) {
  const geometries = useMemo(
    () => ({
      floret: floretGeometry(),
      leaf: leafGeometry(),
      core: new THREE.IcosahedronGeometry(1, 1),
      petal: petalGeometry(),
    }),
    [],
  );
  const materials = useMemo(() => {
    const map = petalMap();
    const floret = profile.physical
      ? new THREE.MeshPhysicalMaterial({ map, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ map, roughness: 0.6, side: THREE.DoubleSide });
    const uniforms = { uTime: time };
    addSway(floret, uniforms, 0.012);
    const leaf = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
    addSway(leaf, uniforms, 0.008);
    const core = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const petal = new THREE.MeshStandardMaterial({ map, roughness: 0.6, side: THREE.DoubleSide });
    return { floret, leaf, core, petal, map };
  }, [profile.physical, time]);

  useEffect(
    () => () => {
      Object.values(geometries).forEach((g) => g.dispose());
      materials.map.dispose();
      [materials.floret, materials.leaf, materials.core, materials.petal].forEach((m) => m.dispose());
    },
    [geometries, materials],
  );

  return (
    <>
      <Flora clusters={INTRO_CLUSTERS} profile={profile} materials={materials} geometries={geometries} />
      {/* columns are split into bands so off-screen flowers are frustum-culled (also in the shadow pass) */}
      {bands(columns, 4).map((band, i) => (
        <Flora key={i} clusters={band} profile={profile} materials={materials} geometries={geometries} />
      ))}
      <Petals count={profile.tier === 'high' ? 26 : 12} material={materials.petal} geometry={geometries.petal} />
    </>
  );
}
