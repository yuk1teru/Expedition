// Regular enemies and the Elite modifier. Stats are tier-1 bases;
// scaling.ts multiplies HP and damage by tier, waves.ts by the wave.
// Every enemy has one readable trait (a visible tell before it matters).

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
  /** Short trait description (help, tooltips). */
  trait: string;
  /** Shooter archetype: preferred distance, range and projectile speed. */
  shooter?: { keepDistance: number; range: number; projectileSpeed: number; retreatSpeedMult: number };
  /** Every `every`-th shot is a fan of `count` projectiles `spreadDeg` apart. */
  volley?: { every: number; count: number; spreadDeg: number };
  /**
   * Fast archetype: crouches for `windup` s (visible), then dashes every `interval` s when the
   * hero is within `trigger` px.
   */
  dash?: { interval: number; trigger: number; speedMult: number; duration: number; windup: number };
  /** A bite slows the hero by `slow` for `time` s. */
  cripple?: { slow: number; time: number };
  /**
   * Instead of a plain hit: a telegraphed stomp around itself (radius = body + `reach`),
   * `delay` s of red circle, damage × `damage`. The hero can step out.
   */
  stomp?: { reach: number; delay: number; damage: number };
}

export const ENEMIES: Record<string, EnemyDef> = {
  wolf: {
    id: 'wolf',
    name: 'Вовк',
    archetype: 'fast',
    hp: 9,
    damage: 1.8,
    speed: 105,
    radius: 11,
    armor: 0,
    attackInterval: 2,
    xp: 2.5,
    mass: 1,
    spawnWeight: 4,
    trait: 'Припадає до землі й стрибає; укус сповільнює.',
    dash: { interval: 3, trigger: 200, speedMult: 3, duration: 0.3, windup: 0.35 },
    cripple: { slow: 0.3, time: 1.5 },
  },
  mushroom: {
    id: 'mushroom',
    name: 'Гриб-плювака',
    archetype: 'shooter',
    hp: 8,
    damage: 1.8,
    speed: 60,
    radius: 12,
    armor: 0,
    attackInterval: 3,
    xp: 3,
    mass: 1,
    spawnWeight: 3,
    trait: 'Світиться перед пострілом; кожен 3-й постріл — віяло з 3 спор.',
    shooter: { keepDistance: 220, range: 380, projectileSpeed: 220, retreatSpeedMult: 0.4 },
    volley: { every: 3, count: 3, spreadDeg: 22 },
  },
  stump: {
    id: 'stump',
    name: 'Пеньок',
    archetype: 'tank',
    hp: 22,
    damage: 3.2,
    speed: 42,
    radius: 17,
    armor: 10,
    attackInterval: 2.5,
    xp: 5,
    mass: 4,
    spawnWeight: 2,
    trait: 'Тупотить: червоне коло навколо себе — відійдіть.',
    stomp: { reach: 34, delay: 0.6, damage: 1 },
  },
};

export function getEnemyDef(id: string): EnemyDef {
  const d = ENEMIES[id];
  if (!d) throw new Error(`Unknown enemy: ${id}`);
  return d;
}
