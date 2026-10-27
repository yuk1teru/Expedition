// Bosses: stats and attack tables. Behaviour functions live in src/systems/bosses/.

export type BossParams = Record<string, number>;

export interface BossAttackDef {
  id: string;
  /** Relative chance among ready attacks. */
  weight: number;
  /** Ready attacks with priority are used before weighted ones (periodic summons). */
  priority?: boolean;
  /** Phases where the attack is available. */
  phases: (1 | 2)[];
  /** Cooldown per phase [phase 1, phase 2], s. */
  cooldown: [number, number];
  /** Cooldown at fight start, s. */
  initialCooldown: number;
  /** Parameters per phase [phase 1, phase 2]. */
  params: [BossParams, BossParams];
  /** Summoned enemy id for summon attacks. */
  enemyId?: string;
  /** Combo: with `chance`, attack `id` follows right after this one (no pause, ignores its cooldown). */
  followUp?: { id: string; chance: number };
}

export interface BossDef {
  id: string;
  name: string;
  biome: string;
  hp: number;
  damage: number;
  armor: number;
  speed: number;
  radius: number;
  mass: number;
  xp: number;
  gold: number;
  /** Boss walks towards the hero until this distance, px. */
  keepDistance: number;
  /** Telegraph wind-up before damage, s. */
  telegraphDelay: number;
  /** Minimal pause between two attacks, s. */
  minPause: number;
  /** Minibosses guard ordinary locations; bosses own the lair. */
  miniboss?: boolean;
  phase2?: { hpFraction: number; speedMult: number };
  /** Contact melee: damage × boss damage every `interval` s within `reach` px. */
  melee?: { damage: number; interval: number; reach: number };
  /** The hero is slowed within `radius` (from `phase` on). */
  coldAura?: { radius: number; slow: number; phase: 1 | 2 };
  attacks: BossAttackDef[];
}

export const BOSSES: Record<string, BossDef> = {
  enat: {
    id: 'enat',
    name: 'Старий Енат',
    biome: 'forest',
    hp: 3000,
    damage: 32,
    armor: 15,
    speed: 34,
    radius: 38,
    mass: 30,
    xp: 400,
    gold: 100,
    keepDistance: 90,
    telegraphDelay: 0.8,
    minPause: 1.2,
    phase2: { hpFraction: 0.5, speedMult: 1.3 },
    attacks: [
      {
        id: 'roots',
        weight: 3,
        phases: [1, 2],
        cooldown: [3.5, 3],
        initialCooldown: 1.5,
        // `count` circles of `radius`: one under the hero, the rest `spreadMin`–`spread` px around.
        params: [
          { count: 3, radius: 48, spreadMin: 80, spread: 130, damage: 0.6 },
          { count: 5, radius: 48, spreadMin: 80, spread: 150, damage: 0.6 },
        ],
      },
      {
        id: 'summon',
        weight: 1,
        priority: true,
        phases: [1, 2],
        cooldown: [12, 8],
        initialCooldown: 6,
        enemyId: 'wolf',
        params: [
          { count: 4, ring: 70 },
          { count: 4, ring: 70 },
        ],
      },
      {
        id: 'slam',
        weight: 4,
        phases: [1, 2],
        cooldown: [8, 6],
        initialCooldown: 3,
        // Circle of `radius` around the boss, used when the hero is closer than `trigger`.
        params: [
          { radius: 120, trigger: 100, damage: 1.2 },
          { radius: 120, trigger: 100, damage: 1.2 },
        ],
      },
    ],
  },
  alpha: {
    id: 'alpha',
    name: 'Ватажок зграї',
    biome: 'forest',
    miniboss: true,
    hp: 190,
    damage: 3.5,
    armor: 5,
    speed: 80,
    radius: 20,
    mass: 6,
    xp: 40,
    gold: 8,
    keepDistance: 0,
    telegraphDelay: 0.7,
    minPause: 1.2,
    melee: { damage: 1.3, interval: 1.3, reach: 6 },
    attacks: [
      {
        id: 'lunge',
        weight: 2,
        phases: [1],
        cooldown: [5, 5],
        initialCooldown: 1.5,
        // Line telegraph of `length` × `width` towards the hero, then a dash along it.
        params: [
          { length: 300, width: 46, damage: 4, speed: 950, minRange: 40 },
          { length: 300, width: 46, damage: 4, speed: 950, minRange: 40 },
        ],
        followUp: { id: 'leap', chance: 0.2 },
      },
      {
        id: 'leap',
        weight: 1,
        phases: [1],
        cooldown: [7, 7],
        initialCooldown: 4,
        // Circle of `radius` under the hero; the boss jumps in and lands when it strikes.
        params: [
          { radius: 64, damage: 3.5, minRange: 90, maxRange: 340 },
          { radius: 64, damage: 3.5, minRange: 90, maxRange: 340 },
        ],
        followUp: { id: 'lunge', chance: 0.15 },
      },
      {
        id: 'howl',
        weight: 1,
        priority: true,
        phases: [1],
        cooldown: [11, 11],
        initialCooldown: 5,
        enemyId: 'wolf',
        params: [
          { count: 2, ring: 45 },
          { count: 2, ring: 45 },
        ],
      },
    ],
  },
  galeSpirit: {
    id: 'galeSpirit',
    name: 'Дух бурі',
    biome: 'forest',
    miniboss: true,
    // Fragile sniper: dies quickly once reached; its bolts only slow.
    hp: 110,
    damage: 2.2,
    armor: 0,
    speed: 60,
    radius: 22,
    mass: 5,
    xp: 60,
    gold: 12,
    keepDistance: 400,
    telegraphDelay: 0.6,
    minPause: 0.9,
    attacks: [
      {
        id: 'volley',
        weight: 3,
        phases: [1],
        cooldown: [3.6, 3.6],
        initialCooldown: 2,
        // `count` fast bolts `spreadDeg` apart, no damage: each hit slows the hero by `slow` for `slowTime` s.
        params: [
          { count: 3, spreadDeg: 10, speed: 520, range: 820, slow: 0.35, slowTime: 2 },
          { count: 3, spreadDeg: 10, speed: 520, range: 820, slow: 0.35, slowTime: 2 },
        ],
      },
      {
        id: 'blink',
        weight: 5,
        phases: [1],
        cooldown: [30, 30],
        initialCooldown: 0,
        // Hero closer than `trigger`: a gust circle where it stood and a jump `distance` px away. Once per 30 s.
        params: [
          { trigger: 110, distance: 300, radius: 80, damage: 1.5 },
          { trigger: 110, distance: 300, radius: 80, damage: 1.5 },
        ],
      },
    ],
  },

  // ---------------- Desert ----------------
  sandWorm: {
    id: 'sandWorm',
    name: 'Піщаний Хробак',
    biome: 'desert',
    hp: 3000,
    damage: 30,
    armor: 10,
    speed: 40,
    radius: 36,
    mass: 30,
    xp: 400,
    gold: 100,
    keepDistance: 120,
    telegraphDelay: 0.8,
    minPause: 1.2,
    phase2: { hpFraction: 0.5, speedMult: 1.25 },
    attacks: [
      {
        id: 'burrow',
        weight: 3,
        phases: [1, 2],
        cooldown: [9, 5.5],
        initialCooldown: 3,
        // Hides for `hideTime` s (untouchable), a circle of `radius` under the hero, then bursts out of it.
        params: [
          { hideTime: 1.5, radius: 90, damage: 1.4 },
          { hideTime: 1.2, radius: 90, damage: 1.4 },
        ],
      },
      {
        id: 'acid',
        weight: 3,
        phases: [1, 2],
        cooldown: [4, 3.5],
        initialCooldown: 1.5,
        // `count` globs in a fan; each leaves an acid puddle where it lands (and where it hits the hero).
        params: [
          { count: 3, spreadDeg: 22, speed: 300, range: 420, damage: 0.6, puddleRadius: 45, puddleTime: 3, puddleDps: 0.25 },
          { count: 3, spreadDeg: 22, speed: 320, range: 420, damage: 0.6, puddleRadius: 45, puddleTime: 3, puddleDps: 0.25 },
        ],
      },
      {
        id: 'sandstorm',
        weight: 2,
        phases: [2],
        cooldown: [12, 12],
        initialCooldown: 0,
        params: [
          { slow: 0.3, time: 4 },
          { slow: 0.3, time: 4 },
        ],
      },
    ],
  },
  scorpionKing: {
    id: 'scorpionKing',
    name: 'Королівський скорпіон',
    biome: 'desert',
    miniboss: true,
    hp: 200,
    damage: 3.5,
    armor: 8,
    speed: 75,
    radius: 20,
    mass: 6,
    xp: 40,
    gold: 8,
    keepDistance: 0,
    telegraphDelay: 0.7,
    minPause: 1.2,
    melee: { damage: 1.2, interval: 1.3, reach: 6 },
    attacks: [
      {
        id: 'sting',
        weight: 2,
        phases: [1],
        cooldown: [5, 5],
        initialCooldown: 2,
        // Short line telegraph, then a dash; the sting poisons (`poisonDps` × damage per s for `poisonTime` s).
        params: [
          { length: 170, width: 40, damage: 3.5, speed: 900, minRange: 40, poisonDps: 0.4, poisonTime: 3 },
          { length: 170, width: 40, damage: 3.5, speed: 900, minRange: 40, poisonDps: 0.4, poisonTime: 3 },
        ],
      },
      {
        id: 'tailSweep',
        weight: 2,
        phases: [1],
        cooldown: [6, 6],
        initialCooldown: 3,
        params: [
          { radius: 95, trigger: 80, damage: 3 },
          { radius: 95, trigger: 80, damage: 3 },
        ],
      },
      {
        id: 'brood',
        weight: 1,
        priority: true,
        phases: [1],
        cooldown: [12, 12],
        initialCooldown: 5,
        enemyId: 'scorpion',
        params: [
          { count: 2, ring: 45 },
          { count: 2, ring: 45 },
        ],
      },
    ],
  },
  // ---------------- Swamp ----------------
  poisonMother: {
    id: 'poisonMother',
    name: 'Отруйна Мати',
    biome: 'swamp',
    hp: 3200,
    damage: 28,
    armor: 8,
    speed: 32,
    radius: 38,
    mass: 30,
    xp: 400,
    gold: 100,
    keepDistance: 150,
    telegraphDelay: 0.8,
    minPause: 1.2,
    phase2: { hpFraction: 0.5, speedMult: 1.3 },
    attacks: [
      {
        id: 'puddles',
        weight: 3,
        phases: [1, 2],
        cooldown: [5, 4],
        initialCooldown: 2,
        // `count` globs along an arc of `arcDeg` around the hero; poison puddles for `puddleTime` s.
        params: [
          { count: 4, arcDeg: 70, speed: 260, range: 360, damage: 0.5, puddleRadius: 55, puddleTime: 6, puddleDps: 0.3 },
          { count: 5, arcDeg: 90, speed: 280, range: 380, damage: 0.5, puddleRadius: 55, puddleTime: 6, puddleDps: 0.3 },
        ],
      },
      {
        id: 'summon',
        weight: 1,
        priority: true,
        phases: [1, 2],
        cooldown: [12, 9],
        initialCooldown: 6,
        enemyId: 'slime',
        params: [
          { count: 3, ring: 70 },
          { count: 3, ring: 70 },
        ],
      },
      {
        id: 'toxicWave',
        weight: 3,
        phases: [2],
        cooldown: [9, 7],
        initialCooldown: 0,
        // A ring growing from the boss: walking away is too slow — dodge with a skill (dash, teleport) or invulnerability.
        params: [
          { speed: 230, width: 26, damage: 1.5, maxRadius: 760 },
          { speed: 230, width: 26, damage: 1.5, maxRadius: 760 },
        ],
      },
    ],
  },
  bigToad: {
    id: 'bigToad',
    name: 'Стара Жаба',
    biome: 'swamp',
    miniboss: true,
    hp: 210,
    damage: 3.5,
    armor: 4,
    speed: 70,
    radius: 22,
    mass: 7,
    xp: 40,
    gold: 8,
    keepDistance: 0,
    telegraphDelay: 0.7,
    minPause: 1.2,
    melee: { damage: 1.2, interval: 1.4, reach: 6 },
    attacks: [
      {
        id: 'leap',
        weight: 2,
        phases: [1],
        cooldown: [6, 6],
        initialCooldown: 2,
        params: [
          { radius: 70, damage: 3.5, minRange: 90, maxRange: 360 },
          { radius: 70, damage: 3.5, minRange: 90, maxRange: 360 },
        ],
      },
      {
        id: 'tongue',
        weight: 2,
        phases: [1],
        cooldown: [5, 5],
        initialCooldown: 3,
        // Line telegraph towards the hero; a hit pulls the hero `pull` px towards the toad.
        params: [
          { length: 300, width: 30, damage: 2.5, pull: 140, minRange: 60 },
          { length: 300, width: 30, damage: 2.5, pull: 140, minRange: 60 },
        ],
      },
      {
        id: 'croak',
        weight: 1,
        priority: true,
        phases: [1],
        cooldown: [12, 12],
        initialCooldown: 5,
        enemyId: 'frog',
        params: [
          { count: 2, ring: 45 },
          { count: 2, ring: 45 },
        ],
      },
    ],
  },
  // ---------------- Ice ----------------
  iceKnight: {
    id: 'iceKnight',
    name: 'Крижаний Лицар',
    biome: 'ice',
    hp: 3100,
    damage: 32,
    armor: 20,
    speed: 45,
    radius: 32,
    mass: 30,
    xp: 400,
    gold: 100,
    keepDistance: 60,
    telegraphDelay: 1,
    minPause: 1.2,
    phase2: { hpFraction: 0.5, speedMult: 1.2 },
    melee: { damage: 1, interval: 1.5, reach: 8 },
    /** Phase 2: everything around the knight slows the hero. */
    coldAura: { radius: 200, slow: 0.25, phase: 2 },
    attacks: [
      {
        id: 'ram',
        weight: 3,
        phases: [1, 2],
        cooldown: [6, 5],
        initialCooldown: 2,
        // Line telegraph of `width` to the wall in the hero's direction (1 s), then a charge along it.
        // Phase 2: two rams in a row.
        params: [
          { width: 60, damage: 1.5, speed: 900 },
          { width: 60, damage: 1.5, speed: 950 },
        ],
      },
      {
        id: 'spikeRing',
        weight: 2,
        phases: [1, 2],
        cooldown: [8, 6.5],
        initialCooldown: 4,
        // A ring of ice spikes grows from the knight with `gaps` openings of `gapDeg` — step into a gap.
        params: [
          { speed: 180, width: 22, damage: 1.2, gaps: 2, gapDeg: 34, maxRadius: 760 },
          { speed: 200, width: 22, damage: 1.2, gaps: 2, gapDeg: 30, maxRadius: 760 },
        ],
      },
    ],
  },
  frostWarden: {
    id: 'frostWarden',
    name: 'Морозний вартовий',
    biome: 'ice',
    miniboss: true,
    hp: 220,
    damage: 3.5,
    armor: 15,
    speed: 60,
    radius: 22,
    mass: 7,
    xp: 40,
    gold: 8,
    keepDistance: 0,
    telegraphDelay: 0.7,
    minPause: 1.2,
    melee: { damage: 1.2, interval: 1.4, reach: 6 },
    attacks: [
      {
        id: 'iceSpikes',
        weight: 2,
        phases: [1],
        cooldown: [5, 5],
        initialCooldown: 2,
        params: [
          { count: 3, radius: 44, spreadMin: 60, spread: 120, damage: 2.5 },
          { count: 3, radius: 44, spreadMin: 60, spread: 120, damage: 2.5 },
        ],
      },
      {
        id: 'shardVolley',
        weight: 2,
        phases: [1],
        cooldown: [4, 4],
        initialCooldown: 3,
        params: [
          { count: 5, spreadDeg: 14, speed: 330, range: 460, damage: 0.8, slow: 0.3, slowTime: 1.5 },
          { count: 5, spreadDeg: 14, speed: 330, range: 460, damage: 0.8, slow: 0.3, slowTime: 1.5 },
        ],
      },
      {
        id: 'frostNova',
        weight: 2,
        phases: [1],
        cooldown: [7, 7],
        initialCooldown: 4,
        params: [
          { radius: 110, trigger: 90, damage: 2.5 },
          { radius: 110, trigger: 90, damage: 2.5 },
        ],
      },
    ],
  },
};

/** Ground hazards made by bosses (src/systems/hazards.ts). */
export const HAZARDS = {
  /** Puddles hurt the hero every this many seconds. */
  tick: 0.5,
} as const;

export function getBoss(id: string): BossDef {
  const b = BOSSES[id];
  if (!b) throw new Error(`Unknown boss: ${id}`);
  return b;
}
