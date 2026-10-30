// The warrior's frame animation (rework, VISION §10). One sheet generated as one picture
// (docs/art/warrior-full.png: 3 columns × 6 rows — standing, walk, vertical slash, horizontal
// slash, sword lunge, shield dash), cut, aligned by the feet and packed into a grid of equal cells
// by scripts/pack-frames.py (COLS=3, "0-2:xy,3-5:xy75"). Every cell has the feet of the figure at
// `anchor`; the figure faces right.

import type { ReworkSkillId } from './reworkSkills';

export type HeroAnimId = 'idle' | 'walk' | 'slashV' | 'slashH' | 'lunge' | 'cast' | 'dash' | 'hurt';

export const WARRIOR_ANIM = {
  sheet: {
    src: 'sprites/anim/warrior.png',
    columns: 3,
    /** One cell of the grid and the feet inside it, px of the sheet. */
    cell: [200, 168] as [number, number],
    anchor: [86, 164] as [number, number],
    /** A standing figure on the sheet is this tall; on screen it is `height`. */
    frameHeight: 139,
  },
  fxSheet: 'sprites/anim/fx.png',
  height: 84,
  /** Frames of each animation (cell numbers, row by row). */
  frames: {
    idle: [0],
    /** Step → legs together → the other step → legs together. */
    walk: [3, 4, 5, 4],
    /** Start, middle, end. */
    slashV: [6, 7, 8],
    slashH: [9, 10, 11],
    lunge: [12, 13, 14],
    /** A skill: the sword raised overhead (the vertical slash's start), held while the sign flares. */
    cast: [6, 6],
    dash: [15, 16, 17],
    /** No frames of its own: the standing frame tilted back by code. */
    hurt: [0],
  } satisfies Record<HeroAnimId, number[]>,
  /** Seconds per frame of the one-shot animations: the wind-up longer, the strike short. */
  durations: {
    slashV: [0.15, 0.08, 0.18],
    slashH: [0.14, 0.08, 0.18],
    lunge: [0.13, 0.08, 0.2],
    cast: [0.12, 0.3],
    dash: [0.05, 0.08, 0.3],
    hurt: [0.18],
  },
  /** World px walked per full walk cycle (two steps) and the lift between steps (sheet px). */
  stride: 96,
  walkBob: 2,
  /** Standing: the chest rises by this share of the height over this many seconds. */
  breathScale: 0.018,
  breathPeriod: 2.6,
  /** A hit shows the recoil at most this often (s): contact hits come many per second. */
  hurtEvery: 0.9,
  /** The recoil: tilted back this much (radians). */
  hurtTilt: 0.14,
  /** Which strike a skill plays; any other skill raises the sword (`cast`). */
  skillAnim: { groundSlam: 'slashV', axeThrow: 'slashH', whirlwind: 'slashH' } as Partial<Record<ReworkSkillId, HeroAnimId>>,
  /** The sign on the chest relative to the feet in the raised-sword frame, sheet px (the skill flare). */
  chest: [4, -90] as [number, number],
  /** Effects on the effects sheet (original 1536×1024 px; the file is half that). */
  fxScale: 0.5,
  fx: {
    signFlare: [996, 51, 1506, 561],
    dust: [36, 750, 450, 948],
  },
  /** Dust behind a dash: a puff every N s, living this long. */
  dustEvery: 0.05,
  dustLife: 0.35,
};
