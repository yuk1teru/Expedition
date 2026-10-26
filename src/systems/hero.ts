// Hero creation and derived stats.

import { HERO, PROGRESSION } from '../data/balance';
import { getClass } from '../data/classes';
import { getPassive } from '../data/skills';
import type { Hero, HeroSkill, HeroStats } from './entities';
import { equippedStat } from './items';

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
    equipment: {},
    bag: [],
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
    cooldownMult: 1,
  };
}

/** Level-3 class choice: sets the class and grants its starting skill. */
export function assignClass(hero: Hero, classId: string): void {
  const c = getClass(classId);
  if (c.locked) throw new Error(`Class ${classId} is locked`);
  hero.classId = c.id;
  hero.skills = [{ id: c.startingSkill, rank: 1, cooldown: 0, slot: 0 }];
  recomputeHeroStats(hero);
}

/**
 * Recomputes derived stats from level, class and passives.
 * Max HP growth also heals by the same amount.
 */
export function recomputeHeroStats(hero: Hero): void {
  const prevMax = hero.maxHp;
  const s = baseStats(hero.level);
  if (hero.classId) {
    const c = getClass(hero.classId);
    s.maxHp *= c.hpMult;
    s.attackSpeed *= c.attackSpeedMult;
    s.skillDamageMult *= c.skillDamageMult;
    s.ranged = c.ranged;
    s.range = c.range;
  }
  let hpPct = 0;
  for (const [id, stacks] of Object.entries(hero.passives)) {
    const p = getPassive(id);
    const v = p.value * stacks;
    switch (p.stat) {
      case 'armor':
        s.armor += v;
        break;
      case 'lifesteal':
        s.lifesteal += v;
        break;
      case 'thorns':
        s.thorns += v;
        break;
      case 'critChance':
        s.critChance += v;
        break;
      case 'attackSpeedPct':
        s.attackSpeed *= 1 + v;
        break;
      case 'hpPct':
        hpPct += v;
        break;
      case 'skillDamagePct':
        s.skillDamageMult *= 1 + v;
        break;
      case 'cooldownPct':
        s.cooldownMult *= 1 - v;
        break;
    }
  }
  // Equipment.
  s.attack += equippedStat(hero, 'attack');
  s.critChance += equippedStat(hero, 'critChance');
  s.armor += equippedStat(hero, 'armor');
  s.attackSpeed *= 1 + equippedStat(hero, 'attackSpeedPct');
  s.moveSpeed *= 1 + equippedStat(hero, 'moveSpeedPct');
  hpPct += equippedStat(hero, 'hpPct');
  s.maxHp *= 1 + hpPct;
  hero.stats = s;
  hero.maxHp = Math.round(s.maxHp);
  if (hero.maxHp > prevMax) hero.hp += hero.maxHp - prevMax;
  hero.hp = Math.min(hero.hp, hero.maxHp);
}

export function healFull(hero: Hero): void {
  hero.hp = hero.maxHp;
}

/** Skill in a skill-bar slot (0-based), if any. */
export function skillInSlot(hero: Hero, slot: number): HeroSkill | undefined {
  return hero.skills.find((s) => s.slot === slot);
}

/** First empty skill-bar slot, or -1 when all are taken. */
export function firstFreeSlot(hero: Hero): number {
  for (let i = 0; i < PROGRESSION.skillSlots; i++) if (!skillInSlot(hero, i)) return i;
  return -1;
}

/** Moves a skill to another slot; swaps if that slot is occupied. */
export function moveSkill(hero: Hero, from: number, to: number): void {
  if (from === to || to < 0 || to >= PROGRESSION.skillSlots) return;
  const a = skillInSlot(hero, from);
  if (!a) return;
  const b = skillInSlot(hero, to);
  if (b) b.slot = from;
  a.slot = to;
}
