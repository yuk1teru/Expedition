// The warrior's frame animation (rework, VISION §10). Each sheet is generated as one picture,
// cut, aligned by the feet and packed into a grid of equal cells by scripts/pack-frames.py:
// - the main sheet (docs/art/warrior-anim.png, 6 × 3; "0-5:xy,6-7:x") — idle, attack, skill,
//   dash, hit (its first row, an older walk, is not used);
// - the walk (docs/art/warrior-walk.png, 4 × 2, COLS=4; "0-7:xy75" — the generator drew the
//   body rising and dipping 18 px, which shakes; three quarters of it are taken out).
// Every cell has the feet of the figure at `anchor`; the figure faces right.

export type HeroAnimId = 'walk' | 'idle' | 'attack' | 'cast' | 'dash' | 'hurt';

export const WARRIOR_ANIM = {
  fxSheet: 'sprites/anim/fx.png',
  /** A standing figure is `height` px tall on screen. */
  height: 84,
  sheets: {
    main: {
      src: 'sprites/anim/warrior.png',
      columns: 6,
      /** One cell of the grid and the feet inside it, px of the sheet. */
      cell: [165, 157] as [number, number],
      anchor: [67, 154] as [number, number],
      /** A standing figure on this sheet is this tall. */
      frameHeight: 136,
    },
    walk: {
      src: 'sprites/anim/warrior-walk.png',
      columns: 4,
      cell: [168, 199] as [number, number],
      anchor: [88, 196] as [number, number],
      frameHeight: 189,
    },
  },
  /** The sheet of each animation (the main one if not listed). */
  sheetOf: { walk: 'walk' } as Partial<Record<HeroAnimId, 'main' | 'walk'>>,
  /** Frames of each animation (cell numbers on its sheet, row by row). */
  frames: {
    walk: [0, 1, 2, 3, 4, 5, 6, 7],
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
  /** World px walked per full walk cycle (two steps). */
  stride: 120,
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
