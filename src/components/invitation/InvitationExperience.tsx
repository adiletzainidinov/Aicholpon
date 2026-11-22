'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { isMusicPlaying, pauseMusic, playMusic } from '@/lib/client/audio';
import { detectQuality, PROFILES, type Quality } from '@/lib/client/quality';
import { track } from '@/lib/client/track';
import { isValidToken } from '@/lib/shared/rsvp';
import type { SceneApi } from '../three/SceneCanvas';
import { GuestContext, type GuestState } from './GuestContext';
import { Envelope2D } from './Envelope2D';
import { RsvpShortcut } from './RsvpShortcut';

// The heavy 3D bundle (three.js, R3F, GSAP timeline) is split out and only fetched on capable devices.
const SceneCanvas = dynamic(() => import('../three/SceneCanvas'), { ssr: false });

type Phase = 'intro' | 'opening' | 'content';
const CONTENT_WIDTH = 560;

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function InvitationExperience({ children, liteDecor }: { children: ReactNode; liteDecor: ReactNode }) {
  const [quality, setQuality] = useState<Quality | null>(null);
  const [mount3D, setMount3D] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [open2D, setOpen2D] = useState(false);
  const [music, setMusic] = useState(false);
  const [guest, setGuest] = useState<GuestState>({ token: null, name: null, status: 'none' });
  const api = useRef<SceneApi | null>(null);
  const readyWaiters = useRef<(() => void)[]>([]);
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const musicWanted = useRef(false);

  // ---- boot: quality tier, guest, analytics ----
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('locked');
    // the intro always starts at the top; don't let the browser restore an old scroll position
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const q = detectQuality();
    setQuality(q);
    let idle = 0;
    if (q !== 'lite') {
      const start = () => setMount3D(true);
      const w = window as Window & { requestIdleCallback?: typeof requestIdleCallback };
      idle = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 250);
    }

    const token = new URLSearchParams(location.search).get('token');
    if (isValidToken(token)) {
      setGuest({ token, name: null, status: 'loading' });
      fetch(`/api/invitee?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        .then(async (r) => {
          if (r.status === 404) return setGuest({ token, name: null, status: 'not_found' });
          if (!r.ok) throw new Error();
          const j = (await r.json()) as { name?: string };
          setGuest({ token, name: j.name ?? null, status: 'ok' });
        })
        .catch(() => setGuest({ token, name: null, status: 'error' }));
    }
    track('view', isValidToken(token) ? token : null);
    return () => {
      (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(idle);
      clearTimeout(idle);
    };
  }, []);

  // ---- 3D scene lifecycle ----
  const onReady = useCallback((sceneApi: SceneApi) => {
    api.current = sceneApi;
    // 3D arrived after the guest already opened the 2D envelope (slow network): show the opened state
    if (phaseRef.current !== 'intro' && readyWaiters.current.length === 0) {
      sceneApi.finish();
      sceneApi.setScroll(window.scrollY, window.innerHeight);
    }
    if (new URLSearchParams(location.search).get('debug') === '1') {
      (window as unknown as { __scene?: SceneApi }).__scene = sceneApi;
    }
    setSceneReady(true);
    readyWaiters.current.splice(0).forEach((f) => f());
  }, []);
  const onFailure = useCallback(() => {
    api.current = null;
    setSceneReady(false);
    setMount3D(false);
    setQuality('lite');
  }, []);

  // scroll + pointer/gyro → camera
  useEffect(() => {
    if (!sceneReady) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => api.current?.setScroll(window.scrollY, window.innerHeight));
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      api.current?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    let base: { b: number; g: number } | null = null;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      base ??= { b: e.beta, g: e.gamma };
      api.current?.setPointer((e.gamma - base.g) / 25, -(e.beta - base.b) / 25);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [sceneReady]);

  const finishOpening = useCallback(() => {
    document.documentElement.classList.remove('locked');
    window.scrollTo(0, 0);
    setPhase('content');
  }, []);

  const open = useCallback(async () => {
    if (phase === 'opening') {
      api.current?.hurry();
      return;
    }
    if (phase !== 'intro') return;
    setPhase('opening');
    track('open', guest.token);
    musicWanted.current = true;
    void playMusic().then(setMusic);
    // iOS needs an explicit permission for motion parallax; ask within the gesture
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (DOE?.requestPermission) void DOE.requestPermission().catch(() => {});

    // if the 3D scene is still loading, give it a moment instead of falling back immediately
    if (!api.current && mount3D) {
      await Promise.race([new Promise<void>((r) => readyWaiters.current.push(r)), wait(1800)]);
      readyWaiters.current = [];
    }
    if (api.current) {
      await api.current.open();
    } else {
      setOpen2D(true);
      await wait(2300);
    }
    finishOpening();
  }, [phase, guest.token, mount3D, finishOpening]);

  // the button follows what the guest sees (and asked for), not the media element's transient state
  const toggleMusic = useCallback(async () => {
    if (musicWanted.current && (isMusicPlaying() || music)) {
      musicWanted.current = false;
      pauseMusic();
      setMusic(false);
    } else {
      musicWanted.current = true;
      setMusic(await playMusic());
    }
  }, [music]);

  // pause the music while the tab is in the background, resume when the guest returns
  useEffect(() => {
    const onVis = () => {
      if (!musicWanted.current) return;
      if (document.hidden) pauseMusic();
      else void playMusic().then(setMusic);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // the envelope leans towards the finger (3D), or the poster envelope tilts (2D / Lite)
  const onPress = useCallback(
    (e: React.PointerEvent) => {
      if (phase !== 'intro') return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      if (api.current) api.current.press(x, y);
      const env = document.querySelector<HTMLElement>('.env2d');
      if (env) {
        env.style.setProperty('--tx', String(x));
        env.style.setProperty('--ty', String(y));
        env.dataset.pressed = 'true';
        window.setTimeout(() => delete env.dataset.pressed, 260);
      }
    },
    [phase],
  );

  const is3D = quality !== null && quality !== 'lite';
  const profile = quality && quality !== 'lite' ? PROFILES[quality] : null;

  return (
    <GuestContext.Provider value={guest}>
      <div className="scene-bg lite-bg" aria-hidden />
      {quality === 'lite' && liteDecor}
      {mount3D && profile && (
        <div className="scene-bg" style={{ opacity: sceneReady ? 1 : 0, transition: 'opacity .9s ease' }}>
          <div className="grade" aria-hidden />
          <SceneBoundary onError={onFailure}>
            <SceneCanvas profile={profile} onReady={onReady} onFailure={onFailure} contentWidth={CONTENT_WIDTH} screens={8} />
          </SceneBoundary>
        </div>
      )}

      {/* Intro: server-rendered poster (instant LCP) that hands over to the 3D scene */}
      <div className="intro" data-state={phase === 'content' ? 'done' : phase}>
        <div className="poster" data-hidden={sceneReady ? 'true' : 'false'}>
          <Envelope2D open={open2D} />
        </div>
        <button
          type="button"
          onClick={open}
          onPointerDown={onPress}
          className="intro-btn absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-between border-0 bg-transparent px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(34px,env(safe-area-inset-top))]"
          aria-label="Чакырууну ачуу"
        >
          <span className="intro-title text-center transition-opacity duration-700" style={{ opacity: phase === 'intro' ? 1 : 0 }}>
            <span className="eyebrow block">Кыз узатуу · 2026</span>
            <span className="font-script halo mt-1 block text-[44px] leading-tight text-deep">Айчолпон</span>
          </span>
          <span className="transition-opacity duration-500" style={{ opacity: phase === 'intro' ? 1 : 0 }}>
            <span className="hint halo">Ачуу үчүн басыңыз</span>
          </span>
        </button>
      </div>

      <button type="button" className="music" onClick={toggleMusic} aria-pressed={music} aria-label={music ? 'Музыканы өчүрүү' : 'Музыканы күйгүзүү'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
          {!music && <path d="M3 3l18 18" />}
        </svg>
      </button>

      {phase === 'content' && <RsvpShortcut />}
      <main className="content" data-visible={phase === 'content'} data-mode={is3D && sceneReady ? '3d' : '2d'} aria-hidden={phase !== 'content'}>
        {children}
      </main>
    </GuestContext.Provider>
  );
}
