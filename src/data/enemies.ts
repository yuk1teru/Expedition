// Regular enemies and the Elite modifier. Stats are tier-1 bases;
// scaling.ts multiplies HP and damage by tier.

import type { Archetype } from '../systems/entities';

export interface EnemyDef {
  id: string;
  name: string;
  archetype: Archetype;
  hp: number;
  damage: number;
  /** px/s */
  speed: number;
  radius: number;
  armor: number;
  /** Seconds between melee attacks (or shots for shooters). */
  attackInterval: number;
  xp: number;
  mass: number;
  /** Relative chance to appear in a wave. */
  spawnWeight: number;
  /** Shooter archetype: preferred distance, range and projectile speed. */
  shooter?: { keepDistance: number; range: number; projectileSpeed: number; retreatSpeedMult: number };
  /** Fast archetype: dash every `interval` s when the hero is within `trigger` px. */
  dash?: { interval: number; trigger: number; speedMult: number; duration: number };
}

export const ENEMIES: Record<string, EnemyDef> = {
  wolf: {
    id: 'wolf',
    name: 'Вовк',
    archetype: 'fast',
    hp: 9,
    damage: 1.2,
    speed: 105,
    radius: 11,
    armor: 0,
    attackInterval: 2,
    xp: 2.5,
    mass: 1,
    spawnWeight: 4,
    dash: { interval: 3, trigger: 200, speedMult: 3, duration: 0.3 },
  },
  mushroom: {
    id: 'mushroom',
    name: 'Гриб-плювака',
    archetype: 'shooter',
    hp: 8,
    damage: 1.2,
    speed: 60,
    radius: 12,
    armor: 0,
    attackInterval: 3,
    xp: 3,
    mass: 1,
    spawnWeight: 3,
    shooter: { keepDistance: 220, range: 380, projectileSpeed: 220, retreatSpeedMult: 0.4 },
  },
  stump: {
    id: 'stump',
    name: 'Пеньок',
    archetype: 'tank',
    hp: 22,
    damage: 2,
    speed: 42,
    radius: 17,
    armor: 10,
    attackInterval: 2.5,
    xp: 5,
    mass: 4,
    spawnWeight: 2,
  },
};

export function getEnemyDef(id: string): EnemyDef {
  const d = ENEMIES[id];
  if (!d) throw new Error(`Unknown enemy: ${id}`);
  return d;
}
