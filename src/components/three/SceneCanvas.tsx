'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { QualityProfile } from '@/lib/client/quality';
import Envelope3D, { type EnvelopeApi } from './Envelope3D';
import FloralScene, { columnClusters } from './FloralScene';
import { Dust, Sparks, type SparkBurst } from './Particles';
import { CARD_FINAL, createRig, FOV, introTarget, layoutRig, scrollTarget, viewHeightAt, type Rig } from './rig';
import { backdrop } from './textures';

export interface SceneApi {
  open(): Promise<void>;
  hurry(): void;
  finish(): void;
  seek(t: number): void;
  /** Debug: renderer statistics (draw calls, triangles, GPU resources). */
  stats(): { calls: number; triangles: number; textures: number; geometries: number; programs: number };
  setScroll(px: number, viewportPx: number): void;
  setPointer(x: number, y: number): void;
}

interface Props {
  profile: QualityProfile;
  onReady: (api: SceneApi) => void;
  onFailure: () => void;
  /** px width of the readable content column – flowers frame it on wide screens */
  contentWidth: number;
  screens: number;
}

/* ---------------- Camera rig ---------------- */

function CameraRig({ rig, continuous }: { rig: Rig; continuous: boolean }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const parallax = useRef(new THREE.Vector2());
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const lookCur = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const k = 1 - Math.exp(-d * 4);
    parallax.current.lerp(rig.pointer, k);
    if (rig.mode === 'scroll') {
      scrollTarget(rig, tmp);
      const ks = 1 - Math.exp(-d * 9);
      rig.pos.lerp(tmp.pos, ks);
      rig.look.lerp(tmp.look, ks);
    }
    const px = parallax.current.x;
    const py = parallax.current.y;
    const amp = rig.mode === 'scroll' ? 0.08 : 0.16;
    camera.position.set(rig.pos.x + px * amp, rig.pos.y + py * amp * 0.7, rig.pos.z);
    lookCur.current.set(rig.look.x + px * amp * 0.25, rig.look.y + py * amp * 0.2, rig.look.z);
    camera.lookAt(lookCur.current);

    // keep rendering on demand until the camera settles
    if (!continuous) {
      const moving =
        rig.mode !== 'scroll' ||
        rig.pos.distanceToSquared(tmp.pos) > 1e-7 ||
        parallax.current.distanceToSquared(rig.pointer) > 1e-6;
      if (moving) invalidate();
    }
  });
  return null;
}

/* ---------------- Lighting ---------------- */

function Lighting({ profile, rig }: { profile: QualityProfile; rig: Rig }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    scene.background = new THREE.Color('#cdd5e2');
    pmrem.dispose();
    return () => {
      env.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);

  useFrame(() => {
    const l = key.current;
    if (!l) return;
    // the key light (and its shadow frustum) travels with the camera
    const y = rig.pos.y;
    l.position.set(-2.4, y + 3.2, 5.5);
    l.target.position.set(0.3, y - 0.2, 0);
    l.target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={['#f3f5ff', '#d9cfbf', 0.4]} />
      <directionalLight
        ref={key}
        color="#fff3e2"
        intensity={1.75}
        castShadow={profile.shadows}
        shadow-mapSize={[profile.shadowMapSize, profile.shadowMapSize]}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={2.8}
        shadow-camera-bottom={-2.8}
        shadow-camera-near={1}
        shadow-camera-far={14}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
      />
      <directionalLight color="#d4e2ff" intensity={0.55} position={[3, -1.5, 3]} />
    </>
  );
}

/* ---------------- Backdrop (the table the envelope lies on) ---------------- */

function Backdrop({ size }: { size: number }) {
  const set = useMemo(() => backdrop(size), [size]);
  useEffect(() => () => set.dispose(), [set]);
  const H = 60;
  const W = 14;
  useEffect(() => {
    set.map.repeat.set(W / 4, H / 4);
    set.bumpMap.repeat.set(W / 4, H / 4);
  }, [set]);
  return (
    <mesh position={[0, CARD_FINAL.y - H / 2 + 6, -0.03]} receiveShadow>
      <planeGeometry args={[W, H]} />
      <meshStandardMaterial map={set.map} bumpMap={set.bumpMap} bumpScale={0.6} roughness={0.75} metalness={0} />
    </mesh>
  );
}

/* ---------------- Runtime performance guard ---------------- */

function PerfGuard({ profile, onDegrade }: { profile: QualityProfile; onDegrade: (level: number) => void }) {
  const acc = useRef({ frames: 0, time: 0, level: 0, warm: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.warm += dt;
    if (a.warm < 1.5 || dt > 0.5) return; // skip shader compile / tab switches
    a.frames++;
    a.time += dt;
    if (a.time >= 2) {
      const fps = a.frames / a.time;
      a.frames = 0;
      a.time = 0;
      if (fps < 42 && a.level < 2) {
        a.level++;
        onDegrade(a.level);
      }
    }
  });
  void profile;
  return null;
}

/* ---------------- Stage ---------------- */

function Stage({
  profile,
  onReady,
  contentWidth,
  screens,
  onDegrade,
  setLoop,
}: Omit<Props, 'onFailure'> & { onDegrade: (l: number) => void; setLoop: (l: 'always' | 'demand' | 'never') => void }) {
  const rig = useMemo(createRig, []);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const sparks = useRef<SparkBurst>(null);
  const envelopeApi = useRef<EnvelopeApi | null>(null);
  const time = useMemo(() => ({ value: 0 }), []);
  const [built, setBuilt] = useState(false);

  // layout on resize
  const aspect = size.width / Math.max(1, size.height);
  layoutRig(rig, aspect, size.height);
  useEffect(() => {
    if (rig.mode === 'intro') {
      const t = introTarget(rig);
      rig.pos.copy(t.pos);
      rig.look.copy(t.look);
    }
    invalidate();
  }, [rig, aspect, size.height, invalidate]);

  const viewH = viewHeightAt(rig.cardDistance);
  const halfW = (viewH * aspect) / 2;
  const contentHalf = ((contentWidth / 2) / Math.max(1, size.height)) * viewH;
  const frameHalf = Math.min(halfW * 0.98, contentHalf + 0.5);
  // quantise so tiny resizes (mobile URL bar) don't rebuild the instances
  const qHalf = Math.round(frameHalf * 10) / 10;
  const qView = Math.round(viewH * 10) / 10;
  const columns = useMemo(() => columnClusters(qView, qHalf, screens), [qView, qHalf, screens]);

  useFrame((_, dt) => {
    time.value += Math.min(dt, 0.05);
  });

  const register = useCallback((api: EnvelopeApi) => {
    envelopeApi.current = api;
  }, []);
  const onBuilt = useCallback(() => setBuilt(true), []);

  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!built) return;
    let raf = 0;
    let cancelled = false;
    // Compile every shader off the main thread where supported (KHR_parallel_shader_compile),
    // then start the render loop and reveal the canvas after two fully rendered frames.
    void gl
      .compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        setLoop('always');
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() =>
        onReady({
          open: async () => {
            setLoop('always');
            await envelopeApi.current?.open();
            if (!profile.continuousScroll) setLoop('demand');
          },
          hurry: () => envelopeApi.current?.hurry(),
          stats: () => ({
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
            textures: gl.info.memory.textures,
            geometries: gl.info.memory.geometries,
            programs: gl.info.programs?.length ?? 0,
          }),
          seek: (t: number) => {
            setLoop('always');
            envelopeApi.current?.seek(t);
          },
          finish: () => {
            envelopeApi.current?.finish();
            if (!profile.continuousScroll) setLoop('demand');
          },
          setScroll: (px, vp) => {
            rig.scrollPx = px;
            rig.viewportPx = Math.max(1, vp);
            invalidate();
          },
          setPointer: (x, y) => {
            rig.pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
            invalidate();
          },
        }),
          );
        });
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [built, onReady, rig, invalidate, setLoop, profile.continuousScroll, gl, scene, camera]);

  return (
    <>
      <CameraRig rig={rig} continuous={profile.continuousScroll} />
      <Lighting profile={profile} rig={rig} />
      <Backdrop size={profile.tier === 'high' ? 512 : 256} />
      <Envelope3D profile={profile} rig={rig} sparks={sparks} register={register} onBuilt={onBuilt} />
      <FloralScene profile={profile} columns={columns} time={time} />
      <Sparks count={profile.tier === 'high' ? 160 : 90} apiRef={sparks} />
      <Dust count={profile.particles} />
      <PerfGuard profile={profile} onDegrade={onDegrade} />
    </>
  );
}

export default function SceneCanvas({ profile, onReady, onFailure, contentWidth, screens }: Props) {
  const [dpr, setDpr] = useState<number>(() =>
    Math.min(profile.dpr[1], Math.max(profile.dpr[0], typeof window === 'undefined' ? 1 : window.devicePixelRatio)),
  );
  const [shadows, setShadows] = useState(profile.shadows);
  const [hidden, setHidden] = useState(false);
  // 'never' until shaders are compiled asynchronously; nothing is visible before that anyway
  const [loop, setLoop] = useState<'always' | 'demand' | 'never'>('never');

  // pause completely while the tab is hidden
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const onDegrade = useCallback(
    (level: number) => {
      if (level === 1) setDpr((d) => Math.max(1, Math.round((d - 0.5) * 4) / 4));
      if (level === 2) {
        setDpr(1);
        setShadows(false);
      }
    },
    [],
  );

  return (
    <Canvas
      dpr={dpr}
      shadows={shadows}
      frameloop={hidden ? 'never' : loop}
      camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 0, 8] }}
      gl={{ antialias: profile.tier === 'high', alpha: false, stencil: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.92;
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onFailure();
        });
      }}
      aria-hidden
    >
      <Stage profile={profile} onReady={onReady} contentWidth={contentWidth} screens={screens} onDegrade={onDegrade} setLoop={setLoop} />
    </Canvas>
  );
}
