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

/** The flood's beasts and the special ones: the weather spirit, a wolf den, the pack leader. */
export type ReworkEnemyId = 'wolf' | 'mushroom' | 'stump' | 'spirit' | 'nest' | 'alpha';

/** The beasts the flood sends. */
export const FLOOD_BEASTS = ['wolf', 'mushroom', 'stump'] as const;

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
  // The special ones walk by their own code (spirit.ts, task.ts, boss.ts); these are their bodies.
  spirit: { id: 'spirit', name: 'Дух занепаду', hp: 260, damage: 4, touchEvery: 1, speed: 95, radius: 16, xp: 30, weight: 0 },
  nest: { id: 'nest', name: 'Вовче лігво', hp: 110, damage: 0, touchEvery: 1, speed: 0, radius: 26, xp: 8, weight: 0 },
  alpha: { id: 'alpha', name: 'Ватажок зграї', hp: 2600, damage: 10, touchEvery: 0.8, speed: 125, radius: 24, xp: 120, weight: 0 },
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
    dodge: { name: 'Ривок щитом', kind: 'dash', distance: 120, time: 0.24, invuln: 0.28, cooldown: 3 },
  },
  mage: {
    id: 'mage',
    name: 'Маг',
    hp: 110,
    speed: 118,
    color: '#5b7fd6',
    attack: { kind: 'bolt', damage: 14, every: 0.9, range: 380, speed: 430, splash: 50, splashShare: 0.5 },
    dodge: { name: 'Блимання', kind: 'blink', distance: 130, time: 0.22, invuln: 0.26, cooldown: 3 },
  },
  archer: {
    id: 'archer',
    name: 'Лучник',
    hp: 120,
    speed: 128,
    color: '#5f9a4a',
    attack: { kind: 'arrow', damage: 10, every: 0.55, range: 430, speed: 620, pierce: 2 },
    dodge: { name: 'Відскок', kind: 'vault', distance: 110, time: 0.24, invuln: 0.28, cooldown: 3 },
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

/** The shared passives (20.7, docs/SKILLS.md): the six open from the start of the game. */
export type ReworkCardId = 'amount' | 'area' | 'cooldown' | 'health' | 'swiftness' | 'magnet';

export const PASSIVE_SLOTS = 5;

/**
 * Each rank says what it gives. `value` is the share per rank (Кількість: extra shots on ranks
 * 1, 3 and 5, +10% damage of the skill on ranks 2 and 4).
 */
export const REWORK_CARDS: Record<ReworkCardId, { name: string; ranks: number; text: string; value: number }> = {
  amount: { name: 'Кількість', ranks: 5, text: 'ранги 1, 3, 5: +1 снаряд, стрибок чи пастка скілам; 2, 4: +10% їхньої шкоди', value: 10 },
  area: { name: 'Площа', ranks: 5, text: '+{v}% радіуса, дальності й ширини скілів і базової атаки', value: 10 },
  cooldown: { name: 'Перезарядка', ranks: 5, text: '−{v}% перезарядки скілів', value: 6 },
  health: { name: 'Здоров’я', ranks: 5, text: '+{v}% макс. HP (і лікує на стільки ж)', value: 10 },
  swiftness: { name: 'Прудкість', ranks: 5, text: '+{v}% швидкості руху, ухил далі', value: 8 },
  magnet: { name: 'Магніт', ranks: 5, text: '+{v}% радіуса, з якого летить досвід', value: 25 },
};

/** Extra shots from Кількість at a rank (ranks 1, 3, 5 add one each). */
export function amountExtra(rank: number): number {
  return Math.ceil(rank / 2);
}

/** 20.9 — elites: a stronger beast with one trait and a glow; it drops a chest. */
export type EliteTrait = 'swift' | 'explosive' | 'shield' | 'caller';

export const REWORK_ELITES = {
  /** Run seconds when an elite comes. */
  times: [70, 210, 330],
  hpMult: 7,
  damageMult: 1.6,
  sizeMult: 1.4,
  xp: 15,
  traits: {
    swift: { name: 'Прудкий', color: '#7fd8ff' },
    explosive: { name: 'Вибуховий', color: '#ff7a3a' },
    shield: { name: 'Щит', color: '#e6e6f0' },
    caller: { name: 'Кличе зграю', color: '#c58cff' },
  } satisfies Record<EliteTrait, { name: string; color: string }>,
  /** Explosive: blows up this long after death, this wide, this hard on the hero. */
  blast: { delay: 0.8, radius: 80, damage: 18 },
  /** Shield: takes this share of damage. */
  shieldTake: 0.5,
  /** Caller: two wolves every N s. */
  callEvery: 5,
};

/** 20.9 — what lies on the map. */
export const REWORK_PICKUPS = {
  /** Herbs: this many grow on the field, a new one every N s; a herb heals this share over this many s. */
  herbs: 30,
  herbRegrow: 15,
  herbHeal: 0.25,
  herbTime: 3,
  /** Shrines: stand by one this long — a buff for this long, then it rests. */
  shrines: 4,
  /** Shrines stand at least this far from each other (and from altars). */
  shrineApart: 900,
  shrineRadius: 46,
  shrineCharge: 1.5,
  shrineBuff: 15,
  shrineRest: 60,
  shrineKinds: {
    speed: { name: 'Святилище швидкості', text: '+30% швидкості', color: '#7fd8ff' },
    magnet: { name: 'Святилище магніту', text: 'досвід летить звідусіль', color: '#5fe0a0' },
    shield: { name: 'Святилище щита', text: 'щит на 40 шкоди', color: '#ffe08a' },
  },
  speedBonus: 0.3,
  magnetMult: 4,
  shieldHp: 40,
  /** Altars: press E nearby to buy one more card for gold, dearer each time. */
  altars: 2,
  altarRadius: 50,
  altarPrice: 30,
  altarStep: 20,
  /** A chest that lies unopened is picked up on touch. */
  chestRadius: 22,
};

export type ShrineKind = keyof typeof REWORK_PICKUPS.shrineKinds;

/** 20.10 — the weather monster of the Forest: the spirit of decay with its fog. */
export const REWORK_SPIRIT = {
  name: 'Дух занепаду',
  appearAt: 210,
  hp: 260,
  radius: 16,
  speed: 95,
  /** Keeps this far from the hero. */
  keep: 380,
  /** Casts fog every N s after a warning; each cast thickens it. */
  castEvery: 9,
  windup: 1.2,
  fogStep: 0.22,
  fogMax: 0.88,
  /** Seen radius around the hero at no fog and at the thickest fog (world px). */
  sightClear: 620,
  sightThick: 200,
  /** Runs away below this share of HP. */
  fleeAt: 0.3,
  fleeSpeed: 150,
  /** Running, it stops this far from the hero (keeps away, but can be caught) and stays this far inside the field. */
  fleeKeep: 560,
  edge: 80,
  /** The fog thins this fast once the spirit is dead (per second). */
  clearRate: 0.5,
  xp: 30,
};

/** 20.11 — tasks of the Forest's first location (one, picked by the seed). */
/** Arrows to what the hero should find (the task's goals, the spirit): a new one pulses big this long, then holds its size. */
export const REWORK_POINTERS = {
  pulseTime: 3,
  pulseScale: 0.9,
};

export const REWORK_TASKS = {
  startAt: 90,
  duration: 75,
  nests: {
    text: 'Знищте вовчі лігва',
    /** The arrow's caption over each den. */
    pointer: 'Лігво',
    count: 3,
    hp: 110,
    radius: 26,
    /** Each den sends a wolf every N s while the hero is near. */
    spawnEvery: 4,
    near: 700,
    distance: [500, 900] as [number, number],
  },
  rescue: {
    text: 'Виведіть лісоруба до краю лісу',
    /** The arrow's captions: to him, then (he follows) to the way out. */
    pointer: 'Лісоруб',
    pointerExit: 'Вихід з лісу',
    distance: [600, 900] as [number, number],
    /** He follows the hero once the hero comes this close; this fast. */
    follow: 70,
    speed: 115,
    /** The way out: this wide, on the field's nearest edge to him. */
    exitRadius: 90,
  },
  /** Success: a chest. Dens destroyed — the boss calls no wolves; the lumberjack saved — 30% HP back when the boss comes. */
  rescueHeal: 0.3,
};

export type TaskKind = 'nests' | 'rescue';

/** 20.12–20.13 — the boss comes, the beasts stand in a living ring; the pack leader. */
export const REWORK_BOSS = {
  /** Run seconds: the warning, then the ring and the boss. */
  warnAt: 390,
  warnTime: 5,
  ringRadius: 300,
  /** The ring is a wall: it pushes back and hurts this much per second of touch. */
  wallDamage: 6,
  /** The ring needs at least this many beasts (wolves come to fill it) and holds at most this many. */
  ringMin: 34,
  ringMax: 90,
  invuln: 2.5,
  zoom: 0.85,
  alpha: {
    name: 'Ватажок зграї',
    hp: 2600,
    radius: 24,
    speed: 175,
    /** Close to the hero it slows to this share of its speed (circles instead of ramming). */
    nearSpeed: 0.7,
    touch: 10,
    /** Dash along a shown line. */
    dash: { every: 2.8, windup: 0.5, length: 360, width: 34, speed: 1150, damage: 24 },
    /** Leap at the hero: the landing circle shows first. */
    leap: { windup: 0.45, time: 0.38, radius: 72, damage: 28 },
    /** After a dash it leaps where the hero went (the combo) this often. */
    combo: 0.7,
    /** After a leap it stands still (the window): takes this much more damage. */
    rest: 0.85,
    restTake: 1.5,
    /** Howl: this many wolves from the ring rush the hero, every N s. */
    howl: { every: 9, wolves: 3 },
    xp: 120,
  },
};

/** Stress test (20.1): the buttons put this many beasts on the field. */
export const REWORK_STRESS = {
  counts: [100, 300, 500],
};
