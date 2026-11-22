'use client';

import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { chime, paperSwish } from '@/lib/client/audio';
import type { QualityProfile } from '@/lib/client/quality';
import {
  backPanelGeometry,
  ENV,
  flapGeometry,
  flapLinerGeometry,
  linerGeometry,
  pocketGeometry,
  sealGeometry,
  sealHalfGeometry,
} from './geometry';
import { CARD_FINAL, introTarget, type Rig } from './rig';
import {
  cardCover,
  cardInside,
  envelopeFlap,
  envelopePocket,
  ensureFonts,
  liner,
  nameLayer,
  revealRamp,
  sealRelief,
  type SurfaceSet,
} from './textures';
import type { SparkBurst } from './Particles';

export interface EnvelopeApi {
  open(): Promise<void>;
  hurry(): void;
  /** Jump straight to the opened state (used when the page is restored mid-scroll). */
  finish(): void;
  /** Debug only: pause the opening timeline at t seconds (deterministic screenshots). */
  seek(t: number): void;
}

interface Built {
  pocket: SurfaceSet;
  flap: SurfaceSet & { liner: SurfaceSet };
  inner: SurfaceSet;
  seal: SurfaceSet;
  inside: SurfaceSet;
  cover: SurfaceSet;
  name: { map: THREE.Texture; aspect: number };
  ramp: THREE.Texture;
}

const FLAP_Z = ENV.POCKET_Z + ENV.PANEL + 0.0065;
const CARD_Z = 0.0205;
const CARD_START_Y = 0.35;
const HALF_H = ENV.CARD_H / 2;

/** Card half: a thin box whose front (+z) face samples only its half of the shared inside texture. */
function cardHalfGeometry(top: boolean) {
  const g = new THREE.BoxGeometry(ENV.CARD_W, HALF_H, 0.006);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const group = g.groups[4]!; // +z face
  const verts = new Set<number>();
  for (let i = group.start; i < group.start + group.count; i++) verts.add(g.index!.getX(i));
  verts.forEach((idx) => uv.setY(idx, (top ? 0.5 : 0) + uv.getY(idx) * 0.5));
  return g;
}

export default function Envelope3D({
  profile,
  rig,
  sparks,
  register,
  onBuilt,
}: {
  profile: QualityProfile;
  rig: Rig;
  sparks: React.RefObject<SparkBurst | null>;
  register: (api: EnvelopeApi) => void;
  onBuilt: () => void;
}) {
  const [built, setBuilt] = useState<Built | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);

  // ---- textures (need the web fonts for monogram / name) ----
  useEffect(() => {
    let cancelled = false;
    let result: Built | null = null;
    // Generate textures in small slices, yielding to the main thread between them so taps stay responsive.
    const step = async <T,>(fn: () => T): Promise<T> => {
      await yieldToMain();
      if (cancelled) throw new Error('cancelled');
      return fn();
    };
    void (async () => {
      const { script, serif } = await ensureFonts();
      const S = profile.textureSize;
      const pocket = await step(() => envelopePocket(S, ENV.H / ENV.W));
      const flap = await step(() => envelopeFlap(S, ENV.FLAP / ENV.W));
      const inner = await step(() => liner(Math.round(S * 0.6), (ENV.H * 0.5) / ENV.W, 8));
      const seal = await step(() => sealRelief(Math.min(512, S / 2), script));
      const inside = await step(() => cardInside(S, ENV.CARD_H / ENV.CARD_W, serif));
      const cover = await step(() => cardCover(S, ENV.CARD_H / 2 / ENV.CARD_W, script, serif));
      const name = await step(() => nameLayer(S, script));
      // upload to the GPU one texture per task instead of all at once on the first frame
      for (const set of [pocket, flap, flap.liner, inner, seal, inside, cover]) {
        for (const t of [set.map, set.bumpMap, set.roughnessMap, set.metalnessMap]) {
          if (!t) continue;
          await yieldToMain();
          if (cancelled) return;
          gl.initTexture(t);
        }
      }
      gl.initTexture(name.map);
      await yieldToMain();
      if (cancelled) return;
      result = {
        pocket,
        flap,
        inner,
        seal,
        inside,
        cover,
        name,
        ramp: revealRamp(),
      };
      setBuilt(result);
    })().catch(() => {});
    return () => {
      cancelled = true;
      if (result) {
        const r = result;
        [r.pocket, r.flap, r.flap.liner, r.inner, r.seal, r.inside, r.cover].forEach((s) => s.dispose());
        [r.name.map, r.ramp].forEach((t) => t.dispose());
      }
    };
  }, [profile.textureSize, gl]);

  // ---- geometry (static, shared) ----
  const geo = useMemo(
    () => ({
      back: backPanelGeometry(),
      pocket: pocketGeometry(),
      liner: linerGeometry(),
      flap: flapGeometry(),
      flapLiner: flapLinerGeometry(),
      seal: sealGeometry(),
      sealL: sealHalfGeometry(-1),
      sealR: sealHalfGeometry(1),
      cardTop: cardHalfGeometry(true),
      cardBottom: cardHalfGeometry(false),
      side: new THREE.BoxGeometry(1, 1, 1),
      name: new THREE.PlaneGeometry(1, 1),
      glow: new THREE.PlaneGeometry(1, 1),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  // ---- materials ----
  const mats = useMemo(() => {
    if (!built) return null;
    const paper = (s: SurfaceSet, bump = 1.1, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({
        map: s.map,
        bumpMap: s.bumpMap,
        bumpScale: bump,
        roughness: s.roughnessMap ? 1 : 0.82,
        metalness: s.metalnessMap ? 1 : 0,
        roughnessMap: s.roughnessMap ?? null,
        metalnessMap: s.metalnessMap ?? null,
        ...extra,
      });
    const edge = new THREE.MeshStandardMaterial({ color: '#f1ece4', roughness: 0.9 });
    const goldParams = {
      color: new THREE.Color('#d9b86e'),
      metalness: 1,
      roughness: 1,
      map: built.seal.map,
      bumpMap: built.seal.bumpMap,
      bumpScale: 3.2,
      roughnessMap: built.seal.roughnessMap ?? null,
      emissive: new THREE.Color('#ffcf7a'),
      emissiveIntensity: 0,
    };
    const seal = profile.physical
      ? new THREE.MeshPhysicalMaterial({ ...goldParams, clearcoat: 0.6, clearcoatRoughness: 0.25 })
      : new THREE.MeshStandardMaterial(goldParams);
    const half = seal.clone();
    half.transparent = true;
    const ins = built.inside;
    const inside = new THREE.MeshStandardMaterial({
      map: ins.map,
      bumpMap: ins.bumpMap,
      bumpScale: 0.9,
      roughness: 1,
      metalness: 1,
      roughnessMap: ins.roughnessMap ?? null,
      metalnessMap: ins.metalnessMap ?? null,
    });
    const name = new THREE.MeshBasicMaterial({
      map: built.name.map,
      alphaMap: built.ramp,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    built.ramp.repeat.set(0.5, 1);
    built.ramp.offset.set(0.56, 0);
    const glow = new THREE.MeshBasicMaterial({
      color: '#ffd98a',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: makeGlow(),
    });
    return {
      back: [paper(built.pocket, 0.8), edge],
      pocket: [paper(built.pocket, 1.2), edge],
      liner: new THREE.MeshStandardMaterial({ map: built.inner.map, bumpMap: built.inner.bumpMap, bumpScale: 0.6, roughness: 0.9 }),
      flap: [paper(built.flap, 1.4), edge],
      flapLiner: new THREE.MeshStandardMaterial({ map: built.flap.liner.map, roughness: 0.9, side: THREE.BackSide }),
      edge,
      seal,
      half,
      cardUpper: [edge, edge, edge, edge, inside, paper(built.cover, 1, { roughness: 1, metalness: 1 })],
      cardLower: [edge, edge, edge, edge, inside, edge],
      name,
      glow,
    };
  }, [built, profile.physical]);

  useEffect(
    () => () => {
      if (!mats) return;
      const all = new Set<THREE.Material>();
      Object.values(mats).forEach((m) => (Array.isArray(m) ? m : [m]).forEach((x) => all.add(x)));
      all.forEach((m) => {
        if (m instanceof THREE.MeshBasicMaterial && m.map && m === mats.glow) m.map.dispose();
        m.dispose();
      });
    },
    [mats],
  );

  // ---- refs ----
  const flapPivot = useRef<THREE.Group>(null);
  const sealGroup = useRef<THREE.Group>(null);
  const sealWhole = useRef<THREE.Mesh>(null);
  const sealL = useRef<THREE.Mesh>(null);
  const sealR = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const card = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const name = useRef<THREE.Mesh>(null);
  const sweep = useRef<THREE.PointLight>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const idle = useRef(0);

  // gentle "breathing" of the closed envelope + seal shimmer
  const envelope = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!envelope.current || rig.mode !== 'intro') return;
    idle.current += dt;
    const t = idle.current;
    envelope.current.position.z = Math.sin(t * 1.1) * 0.012;
    envelope.current.rotation.x = Math.sin(t * 0.7) * 0.025;
    envelope.current.rotation.y = Math.sin(t * 0.5) * 0.03;
    if (mats) mats.seal.emissiveIntensity = 0.04 + Math.max(0, Math.sin(t * 2.2)) * 0.06;
  });

  // ---- API ----
  useEffect(() => {
    if (!built || !mats) return;
    onBuilt();
    const api: EnvelopeApi = {
      open: () =>
        new Promise<void>((resolve) => {
          if (timeline.current) {
            resolve();
            return;
          }
          const f = flapPivot.current!;
          const sg = sealGroup.current!;
          const c = card.current!;
          const up = upper.current!;
          const nm = name.current!;
          const env = envelope.current!;
          rig.mode = 'opening';
          const start = introTarget(rig);
          rig.pos.copy(start.pos);
          rig.look.copy(start.look);
          const sealY = -ENV.FLAP + 0.12 + ENV.H / 2;
          const cardCam = { y: CARD_FINAL.y, z: CARD_FINAL.z + rig.cardDistance };

          const tl = gsap.timeline({
            defaults: { ease: 'power2.inOut' },
            onUpdate: invalidate,
            onComplete: () => {
              rig.mode = 'scroll';
              resolve();
            },
          });
          timeline.current = tl;
          // settle the idle wobble
          tl.to(env.position, { z: 0, duration: 0.4 }, 0).to(env.rotation, { x: 0, y: 0, duration: 0.4 }, 0);
          // 1. camera leans in towards the seal
          tl.to(rig.pos, { y: sealY * 0.7, z: rig.introDistance * 0.74, duration: 1.3 }, 0).to(rig.look, { y: sealY * 0.8, duration: 1.3 }, 0);
          // 2. seal reacts: press, glow, crack
          tl.to(sg.scale, { x: 0.93, y: 0.93, z: 0.85, duration: 0.14, ease: 'power2.out' }, 0.05)
            .to(sg.scale, { x: 1.06, y: 1.06, z: 1.06, duration: 0.3, ease: 'back.out(3)' }, 0.19)
            .to(mats.seal, { emissiveIntensity: 0.9, duration: 0.3, ease: 'power1.in' }, 0.1)
            .to(mats.glow, { opacity: 0.55, duration: 0.25 }, 0.3)
            .to(glow.current!.scale, { x: 0.9, y: 0.9, duration: 0.9, ease: 'power2.out' }, 0.3)
            .to(mats.glow, { opacity: 0, duration: 0.8 }, 0.6)
            .call(
              () => {
                sealWhole.current!.visible = false;
                // detach the halves from the flap so they fall freely while it opens
                for (const h of [sealL.current!, sealR.current!]) {
                  h.visible = true;
                  env.attach(h);
                }
                sparks.current?.fire(sg.getWorldPosition(new THREE.Vector3()));
                chime();
              },
              undefined,
              0.5,
            )
            .to(mats.half, { emissiveIntensity: 0.0, duration: 0.6 }, 0.5);
          for (const [ref, s] of [
            [sealL, -1],
            [sealR, 1],
          ] as const) {
            const m = ref.current!;
            tl.to(m.position, { x: () => m.position.x + s * 0.2, y: () => m.position.y + 0.02, z: () => m.position.z + 0.3, duration: 0.9, ease: 'power2.out' }, 0.52)
              .to(m.rotation, { z: -s * 0.55, y: s * 0.7, x: 0.3, duration: 0.9, ease: 'power2.out' }, 0.52)
              .to(m.position, { y: () => m.position.y - 0.9, duration: 0.7, ease: 'power2.in' }, 1.15);
          }
          tl.to(mats.half, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 1.25);
          // 3. flap opens (towards the camera, over the top), then tucks behind
          tl.call(() => paperSwish(0.9), undefined, 0.95)
            .to(f.rotation, { x: -Math.PI * 1.03, duration: 1.35, ease: 'power2.inOut' }, 0.95)
            .to(f.position, { z: -0.006, duration: 0.45, ease: 'power1.inOut' }, 1.75);
          // 4. card slides out, the camera follows it up
          tl.call(() => paperSwish(1.1, 0), undefined, 2.0)
            .to(c.position, { y: 2.2, duration: 1.4, ease: 'power2.inOut' }, 2.0)
            .to(rig.pos, { y: 1.35, z: rig.introDistance * 0.95, duration: 1.5 }, 2.0)
            .to(rig.look, { y: 1.45, duration: 1.5 }, 2.0);
          // 5. card lifts towards the viewer and centres
          tl.to(c.position, { y: CARD_FINAL.y, z: CARD_FINAL.z, duration: 1.2, ease: 'power3.inOut' }, 3.3)
            .fromTo(c.rotation, { x: 0 }, { x: -0.22, duration: 0.6, ease: 'power2.out' }, 3.3)
            .to(c.rotation, { x: 0, duration: 0.8, ease: 'power2.inOut' }, 3.9)
            .to(rig.pos, { y: cardCam.y, z: cardCam.z, duration: 1.5, ease: 'power3.inOut' }, 3.3)
            .to(rig.look, { y: CARD_FINAL.y, z: CARD_FINAL.z, duration: 1.5, ease: 'power3.inOut' }, 3.3);
          // 6. the card unfolds; petals are already drifting around it
          tl.call(() => paperSwish(0.7), undefined, 4.3)
            .to(up.rotation, { x: 0, duration: 1.25, ease: 'power2.inOut' }, 4.3);
          // 7. a warm light sweeps across the gold foil, the name is "written"
          tl.fromTo(sweep.current!.position, { x: -1.4 }, { x: 1.4, duration: 1.8, ease: 'sine.inOut' }, 5.1)
            .fromTo(sweep.current!, { intensity: 0 }, { intensity: 2.4, duration: 0.6, yoyo: true, repeat: 1, repeatDelay: 0.6 }, 5.1)
            .call(() => void (nm.visible = true), undefined, 5.25)
            .to(built.ramp.offset, { x: -0.06, duration: 1.7, ease: 'power1.inOut' }, 5.25);
        }),
      hurry: () => timeline.current?.timeScale(3.2),
      seek: (t: number) => {
        if (!timeline.current) void api.open();
        timeline.current?.pause();
        timeline.current?.seek(t, false);
        invalidate();
      },
      finish: () => {
        if (!timeline.current) void api.open();
        timeline.current?.progress(1);
      },
    };
    register(api);
  }, [built, mats, register, onBuilt, rig, sparks, invalidate]);

  if (!built || !mats) return null;

  const { W, H, PANEL, POCKET_Z } = ENV;
  const sideDepth = POCKET_Z + PANEL;
  return (
    <group ref={envelope}>
      {/* back panel + liner */}
      <mesh geometry={geo.back} material={mats.back} castShadow receiveShadow />
      <mesh geometry={geo.liner} material={mats.liner} position={[0, 0, PANEL + 0.004]} />
      {/* side walls give the envelope real thickness */}
      <mesh geometry={geo.side} material={mats.edge} position={[-W / 2 + 0.006, 0, sideDepth / 2]} scale={[0.012, H - 0.06, sideDepth]} castShadow />
      <mesh geometry={geo.side} material={mats.edge} position={[W / 2 - 0.006, 0, sideDepth / 2]} scale={[0.012, H - 0.06, sideDepth]} castShadow />
      <mesh geometry={geo.side} material={mats.edge} position={[0, -H / 2 + 0.006, sideDepth / 2]} scale={[W - 0.06, 0.012, sideDepth]} castShadow />

      {/* card (bi-fold) – starts inside the envelope */}
      <group ref={card} position={[0, CARD_START_Y, CARD_Z]}>
        <mesh geometry={geo.cardBottom} material={mats.cardLower} position={[0, -HALF_H / 2, 0]} castShadow receiveShadow />
        <group ref={upper} rotation={[Math.PI, 0, 0]}>
          <mesh geometry={geo.cardTop} material={mats.cardUpper} position={[0, HALF_H / 2, -0.0068]} castShadow receiveShadow />
          <mesh
            ref={name}
            geometry={geo.name}
            material={mats.name}
            visible={false}
            position={[0, HALF_H * 0.2, -0.0036]}
            scale={[ENV.CARD_W * 0.86, ENV.CARD_W * 0.86 * built.name.aspect, 1]}
          />
        </group>
        <pointLight ref={sweep} position={[-1.4, 0.2, 0.8]} intensity={0} distance={3} decay={1.6} color="#ffe2a8" />
      </group>

      {/* front pocket */}
      <mesh geometry={geo.pocket} material={mats.pocket} position={[0, 0, POCKET_Z]} castShadow receiveShadow />

      {/* flap, hinged on the top edge, with the seal at its tip */}
      <group ref={flapPivot} position={[0, H / 2, FLAP_Z]}>
        <mesh geometry={geo.flap} material={mats.flap} castShadow receiveShadow />
        <mesh geometry={geo.flapLiner} material={mats.flapLiner} position={[0, 0, -0.0045]} />
        <group ref={sealGroup} position={[0, -ENV.FLAP + 0.12, 0.028]}>
          <mesh ref={sealWhole} geometry={geo.seal} material={mats.seal} castShadow />
          <mesh ref={sealL} geometry={geo.sealL} material={mats.half} visible={false} castShadow />
          <mesh ref={sealR} geometry={geo.sealR} material={mats.half} visible={false} castShadow />
          <mesh ref={glow} geometry={geo.glow} material={mats.glow} position={[0, 0, 0.09]} scale={0.4} />
        </group>
      </group>
    </group>
  );
}

function yieldToMain() {
  const s = (globalThis as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return s?.yield ? s.yield() : new Promise<void>((r) => setTimeout(r, 0));
}

function makeGlow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,225,160,0.6)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
