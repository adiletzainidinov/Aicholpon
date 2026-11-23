'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { QualityProfile } from '@/lib/client/quality';
import Envelope3D, { type EnvelopeApi } from './Envelope3D';
import FloralScene, { columnClusters } from './FloralScene';
import { Bokeh, Dust, Sparks, type SparkBurst } from './Particles';
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
  /** Touch on the closed envelope (normalised to [-1, 1]) – it tilts towards the finger. */
  press(x: number, y: number): void;
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
  const idle = useRef(0);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const k = 1 - Math.exp(-d * 4);
    parallax.current.lerp(rig.pointer, k);
    if (rig.mode === 'intro') {
      // slow cinematic push-in towards the resting framing, with a barely-there orbit
      idle.current += d;
      const t = introTarget(rig);
      t.pos.x += Math.sin(idle.current * 0.23) * 0.05;
      t.pos.y += Math.sin(idle.current * 0.17) * 0.03;
      const ki = 1 - Math.exp(-d * 0.75);
      rig.pos.lerp(t.pos, ki);
      rig.look.lerp(t.look, ki);
    }
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
        Math.abs(tmp.pos.x - rig.pos.x) > 1e-4 ||
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
  const rake = useRef<THREE.DirectionalLight>(null);
  const clock = useRef(0);
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

  useFrame((_, dt) => {
    const l = key.current;
    const r = rake.current;
    if (!l || !r) return;
    clock.current += Math.min(dt, 0.05);
    // the key light (and its shadow frustum) travels with the camera
    const y = rig.pos.y;
    l.position.set(-2.4, y + 3.2, 5.5);
    l.target.position.set(0.3, y - 0.2, 0);
    l.target.updateMatrixWorld();
    // a low grazing light slowly sweeps across the paper so the embossing and foil come alive;
    // it is strongest on the closed envelope and settles to a soft accent afterwards
    const sweep = Math.sin(clock.current * 0.35);
    r.position.set(-3.2, y + 1.2 + sweep * 1.4, 0.75);
    r.target.position.set(0.4, y, 0);
    r.target.updateMatrixWorld();
    const want = rig.mode === 'intro' ? 1.15 : 0.45;
    r.intensity += (want - r.intensity) * Math.min(1, dt * 1.5);
    // warmer key towards the end of the invitation (subtle grading by scroll)
    const p = Math.min(1, rig.scrollPx / Math.max(1, rig.viewportPx) / 6);
    l.color.setRGB(1, 0.953 - p * 0.03, 0.886 - p * 0.06);
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
      <directionalLight ref={rake} color="#ffe6bf" intensity={1.15} />
    </>
  );
}

/* ---------------- Backdrop (the table the envelope lies on) ---------------- */

const TINTS = [new THREE.Color('#ffffff'), new THREE.Color('#eef3ff'), new THREE.Color('#f6f1ff'), new THREE.Color('#fff5e8')];

function Backdrop({ size, rig }: { size: number; rig: Rig }) {
  const set = useMemo(() => backdrop(size), [size]);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  // the "table" slowly changes mood from pearl → ice blue → lilac → champagne as the story unfolds
  useFrame(() => {
    const m = material.current;
    if (!m) return;
    const p = Math.min(TINTS.length - 1.001, Math.max(0, rig.scrollPx / Math.max(1, rig.viewportPx) / 2));
    const i = Math.floor(p);
    m.color.copy(TINTS[i]!).lerp(TINTS[i + 1]!, p - i);
  });
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
      <meshStandardMaterial ref={material} map={set.map} bumpMap={set.bumpMap} bumpScale={0.6} roughness={0.75} metalness={0} />
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
  const time = rig.flora.uTime;
  const [built, setBuilt] = useState(false);
  const [extras, setExtras] = useState(false);
  const placed = useRef(false);

  // layout on resize
  const aspect = size.width / Math.max(1, size.height);
  layoutRig(rig, aspect, size.height);
  useEffect(() => {
    if (rig.mode === 'intro' && !placed.current) {
      // start a little further and lower: the camera then glides in (see CameraRig)
      placed.current = true;
      const t = introTarget(rig);
      rig.pos.copy(t.pos).multiply(new THREE.Vector3(1, 1, 1.3));
      rig.pos.y -= 0.18;
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
        // secondary effects (dust, bokeh, drifting petals) come a moment after the hero frame
        window.setTimeout(() => !cancelled && setExtras(true), 900);
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
          press: (x, y) => {
            rig.press.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1), 1);
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
      <Backdrop size={profile.tier === 'high' ? 512 : 256} rig={rig} />
      <Envelope3D profile={profile} rig={rig} sparks={sparks} register={register} onBuilt={onBuilt} />
      <FloralScene profile={profile} columns={columns} uniforms={rig.flora} extras={extras} />
      <Sparks count={profile.tier === 'high' ? 160 : 90} apiRef={sparks} />
      {extras && <Dust count={profile.particles} />}
      {extras && <Bokeh count={profile.tier === 'high' ? 14 : 8} />}
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
