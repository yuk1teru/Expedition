// Hero creation and derived stats.

import { HERO } from '../data/balance';
import type { Hero, HeroStats } from './entities';

export function createHero(id: number): Hero {
  const hero: Hero = {
    id,
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: HERO.radius,
    hp: HERO.hp,
    maxHp: HERO.hp,
    team: 'hero',
    statuses: {},
    knockback: { x: 0, y: 0 },
    facing: -Math.PI / 2,
    mass: HERO.mass,
    hitAt: -Infinity,
    spawnedAt: 0,
    dead: false,
    level: 1,
    xp: 0,
    classId: null,
    skills: [],
    passives: {},
    stats: baseStats(1),
    attackTimer: 0,
    buffs: [],
    dash: null,
    invulnerable: 0,
    immortal: false,
  };
  recomputeHeroStats(hero);
  hero.hp = hero.maxHp;
  return hero;
}

function baseStats(level: number): HeroStats {
  return {
    maxHp: HERO.hp + HERO.perLevel.hp * (level - 1),
    attack: HERO.attack + HERO.perLevel.attack * (level - 1),
    attackSpeed: HERO.attackSpeed,
    moveSpeed: HERO.moveSpeed,
    armor: HERO.armor,
    critChance: HERO.critChance,
    critMult: HERO.critMult,
    lifesteal: 0,
    thorns: 0,
    range: HERO.meleeRange,
    ranged: false,
    skillDamageMult: 1,
  };
}

/**
 * Recomputes derived stats from level, class and passives.
 * Keeps the current HP fraction-independent: max HP growth also heals by the same amount.
 */
export function recomputeHeroStats(hero: Hero): void {
  const prevMax = hero.maxHp;
  const s = baseStats(hero.level);
  hero.stats = s;
  hero.maxHp = Math.round(s.maxHp);
  if (hero.maxHp > prevMax) hero.hp += hero.maxHp - prevMax;
  hero.hp = Math.min(hero.hp, hero.maxHp);
}

export function healFull(hero: Hero): void {
  hero.hp = hero.maxHp;
}
