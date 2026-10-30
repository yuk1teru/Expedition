// The rework's new core (ROADMAP stage 20, VISION.md): numbers of the "Реворк: Ліс" mode.
// Starting numbers, to be tuned in play.

export const REWORK_FIELD = {
  /** The location: about 4 × 4 screens, world px. */
  width: 3840,
  height: 2160,
  /** Grass patches on the ground (so walking is visible). */
  patches: 900,
  hero: {
    radius: 14,
  },
};

/** 20.2 — what stands in the Forest. Every obstacle is a circle on the ground (its foot). */
export const REWORK_MAP = {
  /** Count of each kind; they never stand closer than `gap` to each other or to the start. */
  trees: 110,
  bushes: 70,
  stones: 45,
  gap: 26,
  startClear: 260,
  tree: { radius: [16, 24], height: [90, 130] },
  bush: { radius: [14, 22] },
  stone: { radius: [10, 20] },
  /** Big landmarks, one of each (radius of the blocking circle). */
  landmarks: [
    { kind: 'oak', radius: 46, name: 'Старий дуб' },
    { kind: 'stoneRing', radius: 70, name: 'Кам’яне коло' },
    { kind: 'log', radius: 40, name: 'Повалена сосна' },
  ],
  /** A tree crown fades when the hero walks behind it. */
  crownFade: 0.45,
  /** Static obstacle lookup grid, world px. */
  cell: 128,
} as const;

export type ReworkEnemyId = 'wolf' | 'mushroom' | 'stump';

export interface ReworkEnemyDef {
  id: ReworkEnemyId;
  name: string;
  hp: number;
  /** Touch damage, dealt at most once per `touchEvery` s. */
  damage: number;
  touchEvery: number;
  speed: number;
  radius: number;
  xp: number;
  /** Share in the spawn mix. */
  weight: number;
  /** Wolf: crouches (the line shows), then leaps along it. */
  leap?: { every: number; trigger: number; windup: number; speedMult: number; time: number };
  /** Mushroom: keeps away and spits spores; every N-th shot is a fan. */
  spit?: { every: number; keep: number; range: number; windup: number; speed: number; damage: number; fanEvery: number; fanCount: number; fanDeg: number };
  /** Stump: stomps — a ring around it hurts after a delay. */
  stomp?: { every: number; trigger: number; reach: number; delay: number; damage: number };
}

/** 20.3 — the Forest's three beasts (traits from the old game). */
export const REWORK_ENEMIES: Record<ReworkEnemyId, ReworkEnemyDef> = {
  wolf: {
    id: 'wolf',
    name: 'Вовк',
    hp: 10,
    damage: 3,
    touchEvery: 1,
    speed: 100,
    radius: 11,
    xp: 2,
    weight: 5,
    leap: { every: 4, trigger: 220, windup: 0.45, speedMult: 3.2, time: 0.32 },
  },
  mushroom: {
    id: 'mushroom',
    name: 'Гриб-плювака',
    hp: 10,
    damage: 3,
    touchEvery: 1,
    speed: 55,
    radius: 12,
    xp: 3,
    weight: 2,
    spit: { every: 3.5, keep: 230, range: 420, windup: 0.45, speed: 230, damage: 4, fanEvery: 3, fanCount: 3, fanDeg: 22 },
  },
  stump: {
    id: 'stump',
    name: 'Пеньок',
    hp: 30,
    damage: 5,
    touchEvery: 1.2,
    speed: 40,
    radius: 17,
    xp: 5,
    weight: 2,
    stomp: { every: 3.5, trigger: 70, reach: 46, delay: 0.7, damage: 9 },
  },
};

/** 20.3 — the flood: never stops, starts thin, grows thicker, every beast a bit stronger. */
export const REWORK_FLOOD = {
  /** Seconds between spawns at the start and after `rampTime`; in between — eased. */
  intervalStart: 1.4,
  intervalEnd: 0.12,
  rampTime: 420,
  /** Several at once later on. */
  groupEnd: 3,
  maxAlive: 280,
  /** Per minute: HP and damage multipliers grow by this. */
  hpPerMinute: 0.16,
  damagePerMinute: 0.08,
  /** Spawn just outside the view: this far from the hero (world px). */
  spawnDistance: [640, 760] as [number, number],
  /** The mix: the stump joins after this many seconds, the mushroom after that. */
  mushroomFrom: 30,
  stumpFrom: 75,
  /** The location's timer (s); the boss comes at 6:30 later (step 20.12). */
  runTime: 480,
};

export type ReworkClassId = 'warrior' | 'mage' | 'archer';

export interface ReworkClassDef {
  id: ReworkClassId;
  name: string;
  hp: number;
  speed: number;
  color: string;
  /** The automatic basic attack at the nearest enemy in range. */
  attack:
    | { kind: 'arc'; damage: number; every: number; reach: number; arcDeg: number }
    | { kind: 'bolt'; damage: number; every: number; range: number; speed: number; splash: number; splashShare: number }
    | { kind: 'arrow'; damage: number; every: number; range: number; speed: number; pierce: number };
  /** The dodge on Space: no damage, a short invulnerability. */
  dodge: { name: string; kind: 'dash' | 'blink' | 'vault'; distance: number; time: number; invuln: number; cooldown: number };
}

/** 20.4 — the three classes in the new core. */
export const REWORK_CLASSES: Record<ReworkClassId, ReworkClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Воїн',
    hp: 150,
    speed: 120,
    color: '#c0563f',
    attack: { kind: 'arc', damage: 12, every: 0.8, reach: 78, arcDeg: 140 },
    dodge: { name: 'Ривок щитом', kind: 'dash', distance: 120, time: 0.18, invuln: 0.25, cooldown: 3 },
  },
  mage: {
    id: 'mage',
    name: 'Маг',
    hp: 110,
    speed: 118,
    color: '#5b7fd6',
    attack: { kind: 'bolt', damage: 14, every: 0.9, range: 380, speed: 430, splash: 50, splashShare: 0.5 },
    dodge: { name: 'Блимання', kind: 'blink', distance: 130, time: 0.14, invuln: 0.2, cooldown: 3 },
  },
  archer: {
    id: 'archer',
    name: 'Лучник',
    hp: 120,
    speed: 128,
    color: '#5f9a4a',
    attack: { kind: 'arrow', damage: 10, every: 0.55, range: 430, speed: 620, pierce: 2 },
    dodge: { name: 'Відскок', kind: 'vault', distance: 110, time: 0.16, invuln: 0.22, cooldown: 3 },
  },
};

/** 20.5 — experience, gold and the level-up choice. */
export const REWORK_PROGRESS = {
  /** Experience to go from level L to L + 1: base + perLevel · L + square · L². */
  xpBase: 5,
  xpPerLevel: 4,
  xpSquare: 0.6,
  /** Gems fly to the hero inside this radius (world px) and are picked up on touch. */
  magnet: 110,
  pickup: 18,
  gemSpeed: 420,
  /** A beast drops gold with this chance (1 coin each). */
  goldChance: 0.25,
  /** Re-rolling the cards: first price, then this much dearer each time in the run. */
  rerollCost: 10,
  rerollStep: 10,
};

export type ReworkCardId = 'health' | 'swiftness' | 'magnet' | 'area';

/**
 * 20.5 — the cards before skills arrive (20.6): four of the shared passives from
 * docs/SKILLS.md, five ranks each. The full pool with slots comes at 20.7.
 */
export const REWORK_CARDS: Record<ReworkCardId, { name: string; ranks: number; text: string; value: number }> = {
  health: { name: 'Здоров’я', ranks: 5, text: '+{v}% макс. HP (і лікує на стільки ж)', value: 10 },
  swiftness: { name: 'Прудкість', ranks: 5, text: '+{v}% швидкості руху, ухил далі', value: 8 },
  magnet: { name: 'Магніт', ranks: 5, text: '+{v}% радіуса, з якого летить досвід', value: 25 },
  area: { name: 'Площа', ranks: 5, text: '+{v}% зони базової атаки', value: 10 },
};

/** Stress test (20.1): the buttons put this many beasts on the field. */
export const REWORK_STRESS = {
  counts: [100, 300, 500],
};
