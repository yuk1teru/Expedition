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
  phase2: { hpFraction: number; speedMult: number };
  attacks: BossAttackDef[];
}

export const BOSSES: Record<string, BossDef> = {
  enat: {
    id: 'enat',
    name: 'Старий Енат',
    biome: 'forest',
    hp: 1900,
    damage: 6,
    armor: 15,
    speed: 34,
    radius: 38,
    mass: 30,
    xp: 400,
    gold: 150,
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
};

export function getBoss(id: string): BossDef {
  const b = BOSSES[id];
  if (!b) throw new Error(`Unknown boss: ${id}`);
  return b;
}
