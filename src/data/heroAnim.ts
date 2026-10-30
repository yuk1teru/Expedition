// The warrior's frame animation (rework, VISION §10): 18 frames generated as one sheet
// (docs/art/warrior-anim.png), cut, aligned by the feet and packed into a 6 × 3 grid of equal
// cells (scripts/pack-frames.py … "0-5:xy,6-7:x": the walk and idle frames are steadied by the
// sign on the chest). Every cell has the feet of the figure at `anchor`; the figure faces right.

export type HeroAnimId = 'walk' | 'idle' | 'attack' | 'cast' | 'dash' | 'hurt';

export const WARRIOR_ANIM = {
  sheet: 'sprites/anim/warrior.png',
  fxSheet: 'sprites/anim/fx.png',
  columns: 6,
  /** One cell of the grid and the feet inside it, px of the sheet. */
  cell: [165, 157] as [number, number],
  anchor: [67, 154] as [number, number],
  /** A standing figure on the sheet is this tall; on screen it is `height`. */
  frameHeight: 136,
  height: 84,
  /** Frames of each animation (cell numbers, row by row). */
  frames: {
    walk: [0, 1, 2, 3, 4, 5],
    idle: [6, 7],
    attack: [8, 9, 10, 11],
    cast: [12, 13],
    dash: [14, 15],
    hurt: [16, 17],
  } satisfies Record<HeroAnimId, number[]>,
  /** Seconds per frame of the one-shot animations. */
  durations: {
    attack: [0.05, 0.07, 0.09, 0.09],
    cast: [0.1, 0.32],
    dash: [0.08, 0.3],
    hurt: [0.1, 0.12],
  },
  /** World px walked per full walk cycle. */
  stride: 64,
  /** The body dips this much (sheet px) on each foot landing (frames 1 and 4 of the walk). */
  walkBob: 4,
  /** Seconds per breath frame. */
  breath: 0.7,
  /** A hit shows the recoil at most this often (s): contact hits come many per second. */
  hurtEvery: 0.9,
  /** The sign on the chest relative to the feet, sheet px (for the skill flare). */
  chest: [8, -78] as [number, number],
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
