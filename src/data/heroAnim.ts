// The warrior's frame animation (rework, VISION §10). Each sheet is generated as one picture,
// cut, aligned by the feet and packed into a grid of equal cells by scripts/pack-frames.py:
// - the main sheet (docs/art/warrior-anim.png, 6 × 3; "0-5:xy,6-7:x") — attack, skill, dash,
//   hit (its first row, an older walk, and the idle frames are not used);
// - the idle (docs/art/warrior-idle.png, 4 in a row, COLS=4; "0-3:xy") — drawn to the walk's
//   proportions; one frame, the breathing is done by code (the four frames came out alike);
// - the walk (docs/art/warrior-walk.png, 4 × 2, COLS=4; "0-7:xy75" — the generator drew the
//   body rising and dipping up to 20 px, which shakes; three quarters of it are taken out). The
//   boots are told apart by colour (near — light, far — dark); two of the eight frames repeat
//   the first step and are left out, so the cycle has six distinct poses.
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
      cell: [177, 210] as [number, number],
      anchor: [89, 206] as [number, number],
      frameHeight: 198,
    },
    idle: {
      src: 'sprites/anim/warrior-idle.png',
      columns: 4,
      cell: [281, 339] as [number, number],
      anchor: [155, 336] as [number, number],
      frameHeight: 331,
    },
    /** The earlier walk with both boots alike (docs/art/warrior-walk-plain.png, packed the same way). */
    walkPlain: {
      src: 'sprites/anim/warrior-walk-plain.png',
      columns: 4,
      cell: [168, 199] as [number, number],
      anchor: [88, 196] as [number, number],
      frameHeight: 189,
    },
  },
  /** The sheet of each animation (the main one if not listed). */
  sheetOf: { walk: 'walk', idle: 'idle' } as Partial<Record<HeroAnimId, 'main' | 'walk' | 'walkPlain' | 'idle'>>,
  /** Frames of each animation (cell numbers on its sheet, row by row). */
  frames: {
    /** Light boot ahead → it carries → the dark one passes → dark ahead → it carries → the light one passes. */
    walk: [0, 1, 2, 3, 5, 6],
    idle: [0],
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
  stride: 96,
  /**
   * Ways to play the walk, to compare in play (key V in the rework mode): the frames of the walk
   * sheet, the stride, and a lift (sheet px) the code adds between steps.
   */
  walkStyles: [
    // The first three frames of the plain walk (wide step → legs closer → legs crossing), played
    // there and back: the boots look alike, so it reads as one long walk with no jump.
    { name: '3 кадри старої ходьби, туди й назад', sheet: 'walkPlain', frames: [0, 1, 2, 1], stride: 96, bob: 3 },
    // The two steps (light boot ahead, dark boot ahead) and one pose between them, played
    // step → between → step → between.
    { name: '3 кадри: крайні й проміжний', sheet: 'walk', frames: [0, 5, 3, 5], stride: 96, bob: 4 },
    { name: '6 кадрів', sheet: 'walk', frames: [0, 1, 2, 3, 5, 6], stride: 96, bob: 0 },
    { name: '4 кадри, без задраного коліна', sheet: 'walk', frames: [0, 1, 3, 5], stride: 96, bob: 3 },
    { name: '2 кадри + підстрибування', sheet: 'walk', frames: [0, 3], stride: 84, bob: 6 },
  ] as { name: string; sheet: 'walk' | 'walkPlain'; frames: number[]; stride: number; bob: number }[],
  /** Seconds per breath frame (with one idle frame — unused) and the breathing done by code:
   *  the chest rises by this share of the height over this many seconds. */
  breath: 0.7,
  breathScale: 0.018,
  breathPeriod: 2.6,
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
