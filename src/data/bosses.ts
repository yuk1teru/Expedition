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
  attacks: BossAttackDef[];
}

export const BOSSES: Record<string, BossDef> = {
  enat: {
    id: 'enat',
    name: 'Старий Енат',
    biome: 'forest',
    hp: 3200,
    damage: 35,
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
          { count: 3, radius: 60, spreadMin: 80, spread: 130, damage: 0.6 },
          { count: 5, radius: 60, spreadMin: 80, spread: 150, damage: 0.6 },
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
          { radius: 150, trigger: 120, damage: 1.2 },
          { radius: 150, trigger: 120, damage: 1.2 },
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
};

export function getBoss(id: string): BossDef {
  const b = BOSSES[id];
  if (!b) throw new Error(`Unknown boss: ${id}`);
  return b;
}
