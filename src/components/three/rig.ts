import * as THREE from 'three';
import { ENV } from './geometry';

export const FOV = 32;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/** Card's final resting place (hinge = centre of the opened card). */
export const CARD_FINAL = { y: 2.45, z: 0.42 } as const;

/** Distance from which a w×h rectangle fits the viewport. */
export function fitDistance(w: number, h: number, aspect: number) {
  return Math.max(h / 2 / TAN, w / 2 / (TAN * aspect));
}

export const viewHeightAt = (distance: number) => 2 * distance * TAN;

export type RigMode = 'intro' | 'opening' | 'scroll';

/** Mutable camera state shared by the camera rig, the timeline and the scroll handler. */
export interface Rig {
  mode: RigMode;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  /** pointer / gyro parallax in [-1, 1] */
  pointer: THREE.Vector2;
  scrollPx: number;
  viewportPx: number;
  aspect: number;
  introDistance: number;
  cardDistance: number;
}

export function createRig(): Rig {
  return {
    mode: 'intro',
    pos: new THREE.Vector3(0, 0, 8),
    look: new THREE.Vector3(),
    pointer: new THREE.Vector2(),
    scrollPx: 0,
    viewportPx: 1,
    aspect: 1,
    introDistance: 8,
    cardDistance: 6,
  };
}

export function layoutRig(rig: Rig, aspect: number, viewportPx: number) {
  rig.aspect = aspect;
  rig.viewportPx = Math.max(1, viewportPx);
  // landscape phones: leave room above/below for the title, the hint and the scroll cue
  const extra = aspect > 1.2 ? 0.95 : 0;
  rig.introDistance = fitDistance(ENV.W + 0.55, ENV.H + 0.75 + extra, aspect);
  rig.cardDistance = fitDistance(ENV.CARD_W + 0.32, ENV.CARD_H + 0.42 + extra * 1.25, aspect);
}

export function introTarget(rig: Rig) {
  return { pos: new THREE.Vector3(0, -0.04, rig.introDistance), look: new THREE.Vector3(0, -0.04, 0) };
}

/** World-space camera target while scrolling: objects at card depth move 1:1 with the page. */
export function scrollTarget(rig: Rig, out: { pos: THREE.Vector3; look: THREE.Vector3 }) {
  const viewH = viewHeightAt(rig.cardDistance);
  const y = CARD_FINAL.y - (rig.scrollPx / rig.viewportPx) * viewH;
  out.pos.set(0, y, CARD_FINAL.z + rig.cardDistance);
  out.look.set(0, y, CARD_FINAL.z);
  return out;
}
