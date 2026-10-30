// The Forest's beasts drawn from generated frames (rework, VISION §10), like the heroes: each sheet
// was generated as one picture (docs/art/mobs/<beast>/poses.png, the boss's in docs/art/bosses/),
// cut, aligned by the feet and packed into a grid of equal cells by scripts/pack-frames.py
// (GRID=3x3, the alpha 3x4, the spirit 3x2). Every cell has the feet at `anchor`; the beast faces
// right.

import type { ReworkEnemyId } from './rework';

/** Poses a beast can show; which of them it has depends on the beast. */
export type BeastPose =
  | 'walk' | 'stand' | 'hurt' | 'die'
  /** Wolf: crouch before a leap, in the air, landing. */
  | 'crouch' | 'leap' | 'land'
  /** Mushroom: swelling before a spit, spitting, the recoil after it. */
  | 'swell' | 'spit' | 'recoil'
  /** Stump: arms up before a stomp, the stomp, standing in the cracked ground after it. */
  | 'raise' | 'stomp' | 'after'
  /** Spirit: gathering the fog, letting it out, running away. */
  | 'cast' | 'release' | 'flee'
  /** Alpha: dash, leap and its landing, the rest after it, the howl. */
  | 'dashWind' | 'dash' | 'skid' | 'leapWind' | 'leapAir' | 'slam' | 'rest' | 'howl';

export interface BeastSheet {
  src: string;
  columns: number;
  /** One cell of the grid and the feet inside it, px of the sheet. */
  cell: [number, number];
  anchor: [number, number];
  /** Sheet px → world px for a beast of the base radius (an elite, being bigger, is drawn bigger). */
  scale: number;
  /** Frames of each pose (cell numbers, row by row); the walk loops, `die` plays once. */
  frames: Partial<Record<BeastPose, number[]>>;
  /** Walk frames a second. */
  walkFps: number;
  /** Frames that face left on the sheet (drawn mirrored the other way). */
  facesLeft?: number[];
  /** Hovers this high over its shadow (the spirit). */
  hover?: number;
  /** Shadow radius, world px. */
  shadow: number;
  /** Height of the drawn body over the feet (hp bar, the frozen shell), world px. */
  height: number;
}

export const BEAST_SHEETS: Partial<Record<ReworkEnemyId, BeastSheet>> = {
  wolf: {
    src: 'sprites/anim/wolf.png',
    columns: 3,
    cell: [264, 155],
    anchor: [144, 152],
    scale: 0.34,
    frames: { walk: [0, 1, 2], stand: [3], crouch: [3], leap: [4], land: [5], hurt: [6], die: [7, 8] },
    walkFps: 9,
    shadow: 20,
    height: 40,
  },
  mushroom: {
    src: 'sprites/anim/mushroom.png',
    columns: 3,
    cell: [296, 168],
    anchor: [132, 164],
    scale: 0.29,
    frames: { walk: [0, 1, 2, 1], stand: [1], swell: [3], spit: [4], recoil: [5], hurt: [6], die: [7, 8] },
    walkFps: 6,
    shadow: 15,
    height: 46,
  },
  stump: {
    src: 'sprites/anim/stump.png',
    columns: 3,
    cell: [212, 224],
    anchor: [108, 222],
    scale: 0.33,
    frames: { walk: [0, 1, 2, 1], stand: [1], raise: [3], stomp: [4], after: [5], hurt: [6], die: [7, 8] },
    walkFps: 5,
    shadow: 22,
    height: 54,
  },
  alpha: {
    src: 'sprites/anim/alpha.png',
    columns: 3,
    cell: [290, 168],
    anchor: [152, 165],
    scale: 0.62,
    frames: { walk: [0, 1, 2], stand: [10], dashWind: [3], dash: [4], skid: [5], leapWind: [6], leapAir: [7], slam: [8], rest: [10], howl: [9], hurt: [11], die: [11] },
    walkFps: 12,
    shadow: 44,
    height: 72,
  },
  spirit: {
    src: 'sprites/anim/spirit.png',
    columns: 3,
    cell: [290, 248],
    anchor: [140, 244],
    scale: 0.4,
    frames: { walk: [0, 1, 2, 1], stand: [1], cast: [3], release: [4], flee: [5], die: [5] },
    walkFps: 5,
    facesLeft: [5],
    hover: 22,
    shadow: 18,
    height: 80,
  },
};

export const BEAST_ANIM = {
  /** A hit shows the hurt frame this long (only while walking: it would break a move). */
  hurtTime: 0.12,
  /** The wolf lands (the bite frame) in the last part of its leap. */
  landAt: 0.6,
  /** The mushroom spits in the last part of its wind-up and recoils this long after. */
  spitAt: 0.65,
  recoilTime: 0.2,
  /** The stump slams the ground in the last part of its stomp and stands in the cracks this long after. */
  stompAt: 0.8,
  afterTime: 0.3,
  /** The spirit lets the fog out in the last part of its cast. */
  releaseAt: 0.7,
  /** The alpha skids in the last part of its dash, slams the ground at the start of its rest, howls this long. */
  skidAt: 0.7,
  slamTime: 0.22,
  howlTime: 0.9,
  /** A dead beast: each death frame this long, the last one lies and fades. */
  dieFrame: 0.14,
  corpseTime: 0.9,
  corpseFade: 0.4,
  /** The boss falls slower. */
  bossCorpseTime: 2.4,
  /** At most this many dead bodies lie at once (a skill can kill a crowd). */
  maxCorpses: 160,
};
