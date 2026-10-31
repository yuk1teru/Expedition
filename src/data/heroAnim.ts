// The heroes' frame animation (rework, VISION §10). Each class has one sheet generated as one
// picture (docs/art/heroes/<class>/poses.png: 3 columns × 6 rows — standing, walk and four moves of the
// class), cut, aligned by the feet and packed into a grid of equal cells by
// scripts/pack-frames.py (COLS=3 "0-2:xy,3-5:xy75"; GRID=3x6 when figures of neighbouring rows
// touch). Every cell has the feet of the figure at `anchor`; the figure faces right.

import type { ReworkSkillId } from './reworkSkills';

/** Moves a hero can show; `moveA`–`moveC` are the class's own three-frame moves. */
export type HeroAnimId = 'idle' | 'walk' | 'moveA' | 'moveB' | 'moveC' | 'cast' | 'dash' | 'hurt';

export interface HeroSheet {
  src: string;
  columns: number;
  /** One cell of the grid and the feet inside it, px of the sheet. */
  cell: [number, number];
  anchor: [number, number];
  /** A standing figure on the sheet is this tall; on screen it is `HERO_ANIM.height`. */
  frameHeight: number;
  /** Frames of each move (cell numbers, row by row). */
  frames: Record<HeroAnimId, number[]>;
  /** Seconds per frame of the one-shot moves: the wind-up longer, the strike short. */
  durations: Record<Exclude<HeroAnimId, 'idle' | 'walk'>, number[]>;
  /** The basic attack plays these moves in turn. */
  attacks: HeroAnimId[];
  /** Which move a skill plays; any other skill plays `cast`. */
  skillAnim: Partial<Record<ReworkSkillId, HeroAnimId>>;
  /** The sign on the chest relative to the feet in the `cast` frame, sheet px (the skill flare). */
  chest: [number, number];
  /**
   * Frames the generator drew smaller or larger than the rest: cell → scale from the feet.
   * Measured by the hood's top and the chest sign over the feet against the standing frame.
   */
  frameScale?: Partial<Record<number, number>>;
}

const STRIKE = [0.15, 0.08, 0.18];

export const HERO_SHEETS: Record<string, HeroSheet> = {
  // Rows: standing, walk, vertical slash, horizontal slash, sword lunge, shield dash.
  warrior: {
    src: 'sprites/anim/warrior.png',
    columns: 3,
    cell: [200, 168],
    anchor: [86, 164],
    frameHeight: 139,
    frames: {
      idle: [0],
      /** Step → legs together → the other step → legs together. */
      walk: [3, 4, 5, 4],
      moveA: [6, 7, 8],
      moveB: [9, 10, 11],
      moveC: [12, 13, 14],
      /** The sword raised overhead (the vertical slash's start), held while the sign flares. */
      cast: [6, 6],
      dash: [15, 16, 17],
      /** No frames of its own: the standing frame tilted back by code. */
      hurt: [0],
    },
    durations: { moveA: STRIKE, moveB: [0.14, 0.08, 0.18], moveC: [0.13, 0.08, 0.2], cast: [0.12, 0.3], dash: [0.05, 0.08, 0.12], hurt: [0.18] },
    attacks: ['moveA', 'moveB'],
    skillAnim: { groundSlam: 'moveA', axeThrow: 'moveB', whirlwind: 'moveB' },
    chest: [4, -90],
  },
  // Rows: standing, walk, cast forward, cast overhead, channel, blink. The standing row was drawn
  // larger than every move (and its first frames carry a crystal tip of the row below), so the
  // clean third standing frame is shrunk to the moves' size.
  mage: {
    src: 'sprites/anim/mage.png',
    columns: 3,
    cell: [194, 146],
    anchor: [82, 142],
    frameHeight: 120,
    frames: {
      idle: [2],
      walk: [3, 4, 5, 4],
      moveA: [6, 7, 8],
      moveB: [9, 10, 11],
      moveC: [12, 13, 14],
      cast: [9, 9],
      dash: [15, 16, 17],
      hurt: [2],
    },
    durations: { moveA: [0.12, 0.08, 0.16], moveB: STRIKE, moveC: [0.12, 0.1, 0.2], cast: [0.12, 0.3], dash: [0.05, 0.07, 0.12], hurt: [0.18] },
    attacks: ['moveA'],
    skillAnim: { fireball: 'moveA', magicMissiles: 'moveA', frostRing: 'moveB', chainLightning: 'moveC' },
    chest: [4, -80],
    frameScale: { 2: 0.92 },
  },
  // Rows: standing, walk, shoot forward, shoot upward, fan shot, vault back.
  archer: {
    src: 'sprites/anim/archer.png',
    columns: 3,
    cell: [160, 170],
    anchor: [79, 166],
    frameHeight: 132,
    frames: {
      idle: [0],
      walk: [3, 4, 5, 4],
      moveA: [6, 7, 8],
      moveB: [9, 10, 11],
      moveC: [12, 13, 14],
      cast: [7, 7],
      dash: [15, 16, 17],
      hurt: [0],
    },
    durations: { moveA: [0.1, 0.08, 0.12], moveB: [0.12, 0.08, 0.14], moveC: [0.1, 0.07, 0.14], cast: [0.12, 0.3], dash: [0.05, 0.07, 0.12], hurt: [0.18] },
    attacks: ['moveA'],
    skillAnim: { piercingShot: 'moveA', hunterTrap: 'moveA', arrowRain: 'moveB', multishot: 'moveC' },
    chest: [0, -78],
    frameScale: { 3: 1.03, 4: 1.03, 5: 1.03 },
  },
};

export const HERO_ANIM = {
  fxSheet: 'sprites/anim/fx.png',
  height: 84,
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

/**
 * Effects on the hero (docs/art/fx/common.png, cut along a grid by scripts/cut-grid.py): rows of
 * three frames — appearing, full, fading. Healing leaves while a herb heals, the golden shell
 * while a shrine's shield holds, the pillar of light on a new level. `anchor` — the hero's feet
 * in a frame (atlas px); `scale` — atlas px to world px.
 */
export const HERO_FX = {
  src: 'sprites/anim/fx-common.png',
  frames: [
    [0, 0, 202, 225],
    [202, 0, 208, 225],
    [410, 0, 217, 225],
    [0, 225, 202, 192],
    [202, 225, 208, 192],
    [410, 225, 217, 192],
    [0, 417, 202, 210],
    [202, 417, 208, 210],
    [410, 417, 217, 210],
  ] as [number, number, number, number][],
  heal: { frames: [0, 1, 2], anchor: [112, 215] as [number, number], scale: 0.52, alpha: 0.9 },
  shield: { frames: [3, 4, 5], anchor: [112, 188] as [number, number], scale: 0.56, alpha: 0.6 },
  level: { frames: [6, 7, 8], anchor: [112, 160] as [number, number], scale: 0.7, alpha: 0.9 },
  /** The level-up pillar: each frame this long. */
  levelTimes: [0.15, 0.5, 0.3],
  /** The shell appears and breaks over this long. */
  shieldEdge: 0.3,
};
