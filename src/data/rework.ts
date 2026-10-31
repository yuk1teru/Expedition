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
  /** The camera sits this far above the hero (he stands a little low on screen). */
  camLift: 30,
  /** The hero and his skills aim only at beasts this far inside the screen's edges. */
  aimInset: 24,
};

/** 20.2 — what stands in the Forest. Every obstacle is a circle on the ground (its foot). */
export const REWORK_MAP = {
  /** Obstacles never stand closer than `gap` to each other or to the start (their counts — per location, REWORK_LOCATIONS). */
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

/**
 * The flood's beasts and the special ones: the weather spirit, a wolf den, the pack leader; in the
 * second location (20.14) the spider, the cocoon it hatches from and the spinner.
 */
export type ReworkEnemyId = 'wolf' | 'mushroom' | 'stump' | 'spider' | 'spirit' | 'nest' | 'cocoon' | 'alpha' | 'spinner' | 'enat';

/** The beasts the flood sends (the stress test's mix). */
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
  /**
   * Wolf: crouches (the line shows), then leaps along it. Not every wolf leaps alike: each has its
   * temper (0 — timid, 1 — bold) — the timid never leap; the bolder try more often and aim where
   * the hero is going. When ready and in reach a wolf leaps only with `chance` (higher for bolder),
   * else waits `retry` s; the pack has at most `atOnce` wolves crouching or leaping, `gap` s apart.
   * The cooldown varies by ±`jitter`. Away from the hero wolves come from the side (`flank` — the
   * widest angle off the straight way), so a pack spreads around the hero instead of a line.
   */
  leap?: {
    every: number;
    trigger: number;
    windup: number;
    speedMult: number;
    time: number;
    timid: number;
    chance: [number, number];
    retry: [number, number];
    atOnce: number;
    gap: number;
    jitter: number;
    lead: number;
    flank: number;
    flankFrom: number;
  };
  /** Mushroom: keeps away and spits spores; every N-th shot is a fan. */
  spit?: { every: number; keep: number; range: number; windup: number; speed: number; damage: number; fanEvery: number; fanCount: number; fanDeg: number };
  /** Spider: stops and spits a web at the hero's place; where it lands, a sticky patch slows him. */
  web?: { every: number; trigger: number; windup: number; speed: number; range: number };
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
    leap: { every: 4.5, trigger: 220, windup: 0.45, speedMult: 3.2, time: 0.32, timid: 0.3, chance: [0.25, 0.7], retry: [0.5, 1.4], atOnce: 2, gap: 0.6, jitter: 0.35, lead: 0.35, flank: 55, flankFrom: 150 },
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
  spider: {
    id: 'spider',
    name: 'Павук',
    hp: 12,
    damage: 3,
    touchEvery: 1,
    speed: 135,
    radius: 11,
    xp: 3,
    weight: 3,
    web: { every: 5, trigger: 340, windup: 0.4, speed: 320, range: 380 },
  },
  // The special ones walk by their own code (spirit.ts, task.ts, boss.ts, spinner.ts); these are their bodies.
  spirit: { id: 'spirit', name: 'Дух занепаду', hp: 260, damage: 4, touchEvery: 1, speed: 95, radius: 16, xp: 30, weight: 0 },
  nest: { id: 'nest', name: 'Вовче лігво', hp: 110, damage: 0, touchEvery: 1, speed: 0, radius: 26, xp: 8, weight: 0 },
  cocoon: { id: 'cocoon', name: 'Кокон', hp: 120, damage: 0, touchEvery: 1, speed: 0, radius: 22, xp: 8, weight: 0 },
  alpha: { id: 'alpha', name: 'Ватажок зграї', hp: 2600, damage: 10, touchEvery: 0.8, speed: 125, radius: 24, xp: 120, weight: 0 },
  spinner: { id: 'spinner', name: 'Прядуха', hp: 3200, damage: 12, touchEvery: 0.8, speed: 190, radius: 30, xp: 160, weight: 0 },
  enat: { id: 'enat', name: 'Старий Енат', hp: 7000, damage: 0, touchEvery: 1, speed: 0, radius: 46, xp: 0, weight: 0 },
};

/** A spider's web on the ground: this wide, this long, the hero in it walks at this share of his speed. */
export const REWORK_WEB = {
  patchRadius: 48,
  patchTime: 5,
  slow: 0.5,
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
  /** The mix (first location): the mushroom joins after this many seconds, the stump after that. */
  mushroomFrom: 30,
  stumpFrom: 75,
  /** The location's timer (s); the boss comes at 6:30 later (step 20.12). */
  runTime: 480,
};

/**
 * 20.14 — the biome's locations in order: the run goes from one to the next and the hero keeps
 * his level, skills, passives and gold. The second is the deeper forest: denser, darker, with
 * cobwebs on the trees; its flood starts stronger and brings spiders; two tasks one after another;
 * the spinner instead of the pack leader.
 */
export interface ReworkLocation {
  name: string;
  /** Obstacles of each kind; trees with cobwebs (share); another set of props and ground than the Forest's. */
  map: { trees: number; bushes: number; stones: number; webbed: number; art?: 'lair' };
  /** Darker ground (0 — as is). */
  dark: number;
  /** Beasts from this many seconds (Infinity — not here); beasts this much stronger from the start. */
  from: { mushroom: number; stump: number; spider: number };
  power: number;
  /** Tasks: when each comes and which kinds it may be (the first by the seed, the next — another one). */
  tasks: { at: number; kinds: TaskKind[] }[];
  /** The boss and when he is announced (run seconds; the ring forms `REWORK_BOSS.warnTime` later). */
  boss: 'alpha' | 'spinner' | 'enat';
  bossAt: number;
  /** After the boss: the path's caption and the line that points to it. */
  path: { label: string; note: string } | null;
}

export const REWORK_LOCATIONS: ReworkLocation[] = [
  {
    name: 'Ліс',
    map: { trees: 110, bushes: 70, stones: 45, webbed: 0 },
    dark: 0,
    from: { mushroom: 30, stump: 75, spider: Infinity },
    power: 1,
    tasks: [{ at: 90, kinds: ['nests', 'rescue'] }],
    boss: 'alpha',
    bossAt: 390,
    path: { label: 'Глибше в ліс', note: 'Стежка веде глибше в ліс' },
  },
  {
    name: 'Глибина лісу',
    map: { trees: 150, bushes: 80, stones: 40, webbed: 0.35 },
    dark: 0.3,
    from: { mushroom: 20, stump: 60, spider: 15 },
    power: 1.6,
    tasks: [
      { at: 90, kinds: ['webs', 'rescue'] },
      { at: 300, kinds: ['webs', 'rescue'] },
    ],
    boss: 'spinner',
    bossAt: 390,
    path: { label: 'До лігва', note: 'Стежка веде до лігва Ената' },
  },
  {
    // 20.15 — the lair: a short strong flood, then the Old Enat.
    name: 'Лігво Ената',
    map: { trees: 100, bushes: 40, stones: 50, webbed: 0, art: 'lair' },
    dark: 0.4,
    from: { mushroom: 0, stump: 0, spider: 0 },
    power: 2.2,
    tasks: [],
    boss: 'enat',
    bossAt: 90,
    path: null,
  },
];

/** After a location's boss: the path to the next one at the field's edge (its caption — per location). */
export const REWORK_PATH = {
  radius: 70,
  /** The name of the new location shows this long. */
  bannerTime: 3,
};

/**
 * 20.16 — the biome as one run with lives (VISION §8). A life is the Berehynia's sign: a death
 * costs one and the biome starts again from its first location at level 1 (all won in that try is
 * lost); with no lives left — back to the last checkpoint (here: the expedition's start) and a
 * tombstone. Beating the biome's boss is a checkpoint: lives come back. Her voice in the sign is
 * heard at each of these moments (the mysterious set — hints at the dead world and the cracking seal).
 */
export const REWORK_LIVES = {
  max: 3,
  /** Her words after a death with 2 and 1 lives left, and when the last is lost. */
  death: ['Не туди… Мертві ще не кличуть тебе.', 'Чуєш, як тріщить? Вставай, поки тріщина мала.'],
  lost: 'Ти бачив їхній бік. Забудь і повертайся.',
  checkpoint: 'Він вільний. А десь глибоко щось ворухнулось.',
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
    attack: { kind: 'bolt', damage: 14, every: 0.9, range: 320, speed: 430, splash: 50, splashShare: 0.5 },
    dodge: { name: 'Блимання', kind: 'blink', distance: 130, time: 0.22, invuln: 0.26, cooldown: 3 },
  },
  archer: {
    id: 'archer',
    name: 'Лучник',
    hp: 120,
    speed: 128,
    color: '#5f9a4a',
    attack: { kind: 'arrow', damage: 10, every: 0.55, range: 350, speed: 620, pierce: 2 },
    dodge: { name: 'Відскок', kind: 'vault', distance: 110, time: 0.24, invuln: 0.28, cooldown: 3 },
  },
};

/** 20.5 — experience, gold and the level-up choice. */
export const REWORK_PROGRESS = {
  /** Experience to go from level L to L + 1: base + perLevel · L + square · L². */
  xpBase: 5,
  xpPerLevel: 4,
  xpSquare: 0.6,
  /**
   * Gems and coins start flying to the hero inside this radius (world px) and are picked up on
   * touch. They start slow and speed up, so the flight is seen.
   */
  magnet: 70,
  pickup: 10,
  gemSpeed: 120,
  gemAccel: 700,
  gemMaxSpeed: 560,
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
  webs: {
    text: 'Знищте павутиння',
    pointer: 'Кокон',
    count: 3,
    /** Each cocoon hatches a spider every N s while the hero is near. */
    spawnEvery: 3.5,
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
    /** The way out: on the field's edge, this far from him (world px), this wide. */
    exitDistance: [1100, 1500] as [number, number],
    exitRadius: 90,
  },
  /** Success: a chest. Dens destroyed — the boss calls no wolves; the lumberjack saved — 30% HP back when the boss comes. */
  rescueHeal: 0.3,
};

export type TaskKind = 'nests' | 'webs' | 'rescue';

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
    /** Over him: a line by the hero, the victory screen's title. */
    defeated: 'Ватажка подолано!',
    victory: 'Ватажка зграї подолано!',
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
  /**
   * 20.14 — the spinner (docs/BOSSES.md): lays threads across the arena (touch — slowed), spits a
   * cocoon (hit — wrapped, a dodge breaks free), then pulls every thread to the hero: a ring of
   * web closing on him with one clear gap (two, if the lumberjack was saved). After the pull the
   * threads tear and she stands open. Calls spiderlings unless the cocoons were destroyed. Her
   * ring is sticky: touching it holds the hero.
   */
  spinner: {
    name: 'Прядуха',
    defeated: 'Прядуху подолано!',
    victory: 'Прядуху подолано!',
    hp: 3200,
    radius: 30,
    speed: 190,
    /** Keeps this far from the hero, skittering sideways. */
    keep: 210,
    touch: 12,
    threads: { every: 3, warn: 0.7, max: 5, slow: 0.5 },
    cocoon: { every: 6.5, windup: 0.55, speed: 430, radius: 10, root: 1 },
    /** The pull: starts this long after the spit, closes from this radius over this long. */
    pull: { delay: 0.35, time: 1.4, radius: 300, segments: 8, gapDeg: 45, damage: 22 },
    rest: 1.5,
    restTake: 1.5,
    brood: { every: 10, count: 3 },
    /** Touching her sticky ring holds the hero this long. */
    stick: 0.5,
  },
  /**
   * 20.15 — the Old Enat, the biome's boss (docs/BOSSES.md). He stands in the arena and does not
   * move. Phase 1: roots burst under the hero one after another, a slam around himself, roots push
   * ring beasts at the hero; the combo — a grab (always catches), the pull to him, a charged slam
   * (a dodge in the charge saves). Phase 2 (60%): the forest turns to stone (boulders in the
   * arena), thorns in 8 lines across it and a spike under the hero at once. Phase 3 (25%): his
   * bark cracks (takes more damage), thorns never stop, and only the moving shade of his crown is
   * safe from them. A ghost asks for help before the fight; freed, he speaks after it.
   */
  enat: {
    name: 'Старий Енат',
    defeated: 'Ената звільнено!',
    victory: 'Старого Ената звільнено!',
    /** His ghost at the lair's start; his true voice after the fight. */
    ghost: 'Звільни мене від звіра',
    ghostTime: 6,
    freed: 'Сьогодні вночі ліс не спатиме',
    hp: 7000,
    radius: 46,
    /** Phases begin at these shares of HP. */
    phases: [0.6, 0.25],
    roots: { every: 3.4, count: 3, gap: 0.5, warn: 0.9, radius: 55, damage: 20 },
    slam: { every: 6, warn: 1, radius: 190, damage: 30 },
    grab: { every: 12, warn: 0.6, pull: 0.45, charge: 1, radius: 165, damage: 34 },
    push: { every: 9, beasts: 4 },
    thorns: { every: 4.5, warn: 0.9, length: 900, width: 26, damage: 24, spike: 45 },
    stones: 6,
    shade: { radius: 70, speed: 55, every: 1.6 },
    sapTake: 1.5,
    touch: 8,
  },
};

/** Stress test (20.1): the buttons put this many beasts on the field. */
export const REWORK_STRESS = {
  counts: [100, 300, 500],
};
