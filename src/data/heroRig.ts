// The warrior's cut-out rig (rework, VISION §10): painted parts on one sheet, moved by code.
// Coordinates are in pixels of the original 1254×1254 sheet; the file in `public` is scaled by
// `sheetScale`. Each part has a pivot (the joint to its parent) and, for limbs, a tip (the joint
// to its child). Pose angles are radians added to the part as it is drawn on the sheet.

export type RigPart = 'head' | 'torso' | 'cloak' | 'armU' | 'armF' | 'hand' | 'shieldU' | 'shieldF' | 'legBack' | 'legFront' | 'sword' | 'shield';

export interface RigPartDef {
  /** Box on the sheet: x0, y0, x1, y1. */
  rect: [number, number, number, number];
  /** The joint to the parent, inside the box. */
  pivot: [number, number];
  /** The joint to the child (limbs). */
  tip?: [number, number];
}

/** A pose: angle offsets of the parts, the body lean, the body lift (sheet px, negative is up). */
export type RigPose = Partial<Record<RigPart | 'lean' | 'lift', number>>;

export type RigFx = 'slash' | 'bladeGlow' | 'signFlare' | 'impact' | 'ring' | 'dust';

export const WARRIOR_RIG = {
  sheet: 'sprites/rig/warrior.png',
  fxSheet: 'sprites/rig/fx.png',
  /** The files are half the size of the original sheets. */
  sheetScale: 0.5,
  /** Height of the whole figure on screen, px. */
  height: 74,
  /** From the head top to the ground in sheet px (sets the scale). */
  sheetHeight: 1030,
  /** The ground under the feet, relative to the hips (sheet px). */
  ground: 380,
  parts: {
    head: { rect: [42, 90, 312, 384], pivot: [140, 272] },
    torso: { rect: [351, 39, 711, 501], pivot: [180, 395] },
    cloak: { rect: [744, 27, 1242, 528], pivot: [255, 90] },
    armU: { rect: [42, 528, 213, 777], pivot: [128, 28], tip: [52, 222] },
    armF: { rect: [282, 534, 429, 774], pivot: [32, 28], tip: [100, 212] },
    hand: { rect: [510, 606, 657, 768], pivot: [45, 28], tip: [85, 98] },
    shieldU: { rect: [732, 534, 900, 774], pivot: [45, 28], tip: [118, 218] },
    shieldF: { rect: [939, 531, 1215, 783], pivot: [38, 30], tip: [228, 150] },
    legBack: { rect: [45, 795, 237, 1206], pivot: [130, 32] },
    legFront: { rect: [360, 801, 570, 1164], pivot: [72, 32] },
    sword: { rect: [576, 840, 966, 1212], pivot: [68, 68] },
    shield: { rect: [966, 816, 1209, 1209], pivot: [150, 195] },
  } satisfies Record<RigPart, RigPartDef>,
  /** Joints on the torso, relative to its pivot (the hips). */
  joints: {
    neck: [-2, -373],
    swordShoulder: [-125, -290],
    shieldShoulder: [120, -300],
    hipBack: [-100, 0],
    hipFront: [100, 0],
    clasp: [-30, -345],
    chest: [35, -245],
  },
  /** Effects on the effects sheet (original px, 1536×1024). */
  fx: {
    slash: [18, 126, 552, 537],
    bladeGlow: [555, 126, 1014, 540],
    signFlare: [996, 51, 1506, 561],
    impact: [648, 735, 846, 933],
    ring: [960, 624, 1524, 987],
    dust: [36, 750, 450, 948],
  } satisfies Record<RigFx, [number, number, number, number]>,
  poses: {
    idle: { sword: -0.4, shieldU: 0.35, shieldF: -0.35 },
    /** Two extremes of a step; walking swings between them. */
    stepA: { legFront: 0.4, legBack: -0.4, armU: -0.25, cloak: -0.08, lift: -20 },
    stepB: { legFront: -0.4, legBack: 0.4, armU: 0.2, cloak: -0.08, lift: -20 },
    windup: { armU: 2.4, armF: -1.2, hand: -0.2, sword: -0.6, shieldU: 0.2, shieldF: -0.2, lean: -0.08 },
    swing: { armU: -1.1, armF: -0.4, hand: 0, sword: -0.2, shieldU: 0.4, shieldF: -0.3, lean: 0.15 },
    cast: { armU: 2.9, armF: -0.6, hand: 0.3, sword: 0.6, shieldU: 0.3, shieldF: -0.3, lean: -0.05, legFront: 0.15, legBack: -0.1 },
    dash: { armU: 0.6, armF: 0.3, sword: -0.6, shieldU: -0.5, shieldF: -0.4, lean: 0.35, legFront: -0.5, legBack: 0.6, cloak: -0.3, lift: -10 },
    hurt: { lean: -0.22, head: -0.15, armU: 0.4, shieldU: -0.3, cloak: 0.1 },
  } satisfies Record<string, RigPose>,
  timing: {
    /** Basic attack: wind-up ends, swing ends, back to rest (s). */
    windup: 0.07,
    swing: 0.16,
    attackEnd: 0.32,
    /** A skill: raise the sword, hold it glowing, lower it (s). */
    castRise: 0.12,
    castHold: 0.35,
    castEnd: 0.5,
    /** Recoil after a hit (s). */
    hurt: 0.2,
    /** World px per full step cycle. */
    stride: 46,
    /** Breathing at rest: cycles per second and lift (sheet px). */
    breath: 1.6,
    breathLift: 6,
    /** A dust puff behind a dash every N s; it lives this long. */
    dustEvery: 0.05,
    dustLife: 0.35,
  },
};
