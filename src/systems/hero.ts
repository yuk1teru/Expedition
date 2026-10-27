// Hero creation and derived stats.

import { giftStat } from './gifts';
import { TALENT_TREES } from '../data/talents';
import type { SkillDef } from '../data/skills';
import type { Element } from '../data/elements';
import { HERO, PROGRESSION } from '../data/balance';
import { type BasicAttackDef, NOVICE_ATTACK, getClass } from '../data/classes';
import { getPromotion } from '../data/promotions';
import { getPassive, chosenFork } from '../data/skills';
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
    consumables: { magnifier: 0, herbGreen: 0, herbRed: 0, herbWhite: 0, potionSmall: 0, potionMedium: 0, potionLarge: 0 },
    quickSlots: [null, null, null],
    healCooldown: 0,
    dodgeCooldown: 0,
    pendingBuffs: [],
    promotion: null,
    promoTimer: 0,
    companionTimer: 0,
    mana: 0,
    arrowElement: 'neutral',
    arrows: [],
    freeSkills: [],
    gifts: [],
    promotion2: false,
    castMult: 1,
  };
  recomputeHeroStats(hero);
  hero.hp = hero.maxHp;
  return hero;
}

function baseStats(level: number): HeroStats {
  return {
    maxHp: Math.round(HERO.hp + HERO.perLevel.hp * (level - 1)),
    attack: HERO.attack + HERO.perLevel.attack * (level - 1),
    attackSpeed: HERO.attackSpeed,
    moveSpeed: HERO.moveSpeed,
    armor: HERO.armor,
    critChance: HERO.critChance,
    critMult: HERO.critMult,
    lifesteal: 0,
    hpRegen: HERO.hpRegen,
    thorns: 0,
    range: HERO.meleeRange,
    ranged: false,
    skillDamageMult: 1,
    cooldownMult: 1,
    killCdr: 0,
    pierce: 0,
    petDamageMult: 1,
    combatRegenPct: 0,
    dodgeMelee: 0,
    manaMax: 0,
    manaAbsorb: 0,
  };
}

/** The hero's auto-attack: the class one, or the novice one before the class choice. */
/** Element of the hero's basic attack: the archer's arrows, otherwise neutral (a soul stone — stage 14). */
export function basicElement(hero: Hero): Element {
  if (hero.classId === 'archer') return hero.arrowElement;
  // Paladin: while the branch barrier holds, the blows are holy.
  if (hero.promotion === 'paladin' && hero.buffs.some((b) => b.id === 'aegis' && (b.shield ?? 0) > 0)) return 'holy';
  return 'neutral';
}

/** Archer (Q): the next learned arrow type (plain arrows included). */
export function cycleArrows(hero: Hero): Element {
  const all: Element[] = ['neutral', ...hero.arrows];
  const i = all.indexOf(hero.arrowElement);
  hero.arrowElement = all[(i + 1) % all.length]!;
  return hero.arrowElement;
}

/** Element of a skill's damage for this hero ('arrows' — the arrows in use; a fork may change it). */
export function skillElement(hero: Hero, def: SkillDef): Element {
  const s = hero.skills.find((x) => x.id === def.id);
  const fork = s ? (chosenFork(def.id, s.rank, s.forks, 5)?.element ?? chosenFork(def.id, s.rank, s.forks, 3)?.element) : undefined;
  const e = fork ?? def.element ?? 'neutral';
  return e === 'arrows' ? hero.arrowElement : e;
}

export function basicAttackOf(hero: Hero): BasicAttackDef {
  return hero.classId ? getClass(hero.classId).basicAttack : NOVICE_ATTACK;
}

/** The class choice (level 3): the class and its free starting skills — from the first row of its tree. */
export function assignClass(hero: Hero, classId: string, picks?: string[]): void {
  const c = getClass(classId);
  if (c.locked) throw new Error(`Class ${classId} is locked`);
  const row1 = TALENT_TREES[classId]?.[0]?.skills ?? [];
  const chosen = picks ?? c.defaultPicks;
  if (chosen.length !== PROGRESSION.startingSkillPicks || new Set(chosen).size !== chosen.length || !chosen.every((id) => row1.includes(id))) {
    throw new Error(`Pick ${PROGRESSION.startingSkillPicks} different ${classId} skills of the first row`);
  }
  hero.classId = c.id;
  hero.skills = chosen.map((id, slot) => ({ id, rank: 1, cooldown: 0, slot }));
  hero.freeSkills = [...chosen];
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
    const t = c.traits;
    s.combatRegenPct = t.combatRegenPct ?? 0;
    s.dodgeMelee = t.dodgeMelee ?? 0;
    s.moveSpeed *= t.moveSpeedMult ?? 1;
    if (t.mana) {
      s.manaMax = t.mana.base + t.mana.perLevel * (hero.level - 1);
      s.manaAbsorb = t.mana.absorb;
    }
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
      case 'killCdr':
        s.killCdr += v;
        break;
      case 'pierce':
        s.pierce += v;
        break;
      case 'petDamagePct':
        s.petDamageMult *= 1 + v;
        break;
    }
  }
  // Gifts (ROADMAP 12.8).
  s.attackSpeed *= 1 + giftStat(hero, 'attackSpeedPct');
  hpPct += giftStat(hero, 'hpPct');
  s.critChance += giftStat(hero, 'critChance');
  s.armor += giftStat(hero, 'armor');
  s.lifesteal += giftStat(hero, 'lifesteal');
  s.moveSpeed *= 1 + giftStat(hero, 'moveSpeedPct');
  s.cooldownMult *= 1 - giftStat(hero, 'cooldownPct');
  s.skillDamageMult *= 1 + giftStat(hero, 'skillDamagePct');
  // The second stage of the branch: its stat bonus.
  if (hero.promotion && hero.promotion2) {
    const b2 = getPromotion(hero.promotion).bonus2;
    if (b2.stat === 'attackSpeedPct') s.attackSpeed *= 1 + b2.value;
    else if (b2.stat === 'hpPct') hpPct += b2.value;
    else if (b2.stat === 'critChance') s.critChance += b2.value;
    else if (b2.stat === 'armor') s.armor += b2.value;
    else if (b2.stat === 'skillDamagePct') s.skillDamageMult *= 1 + b2.value;
    else if (b2.stat === 'lifesteal') s.lifesteal += b2.value;
    else if (b2.stat === 'moveSpeedPct') s.moveSpeed *= 1 + b2.value;
    else if (b2.stat === 'cooldownPct') s.cooldownMult *= 1 - b2.value;
  }
  if (hero.promotion) {
    const fx = getPromotion(hero.promotion).effect;
    if (fx.kind === 'marksman') {
      s.critChance += fx.crit;
      s.pierce += fx.pierce;
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
  const prevMana = hero.stats?.manaMax ?? 0;
  hero.stats = s;
  // Like max HP: a bigger pool fills up by the difference (the class choice fills it).
  if (s.manaMax > prevMana) hero.mana += s.manaMax - prevMana;
  hero.mana = Math.min(hero.mana, s.manaMax);
  hero.maxHp = Math.round(s.maxHp);
  if (hero.maxHp > prevMax) hero.hp += hero.maxHp - prevMax;
  hero.hp = Math.min(hero.hp, hero.maxHp);
}

/** Attack including temporary damage buffs and the Berserker's missing-HP bonus. */
export function heroAttack(hero: Hero): number {
  let a = hero.stats.attack;
  for (const b of hero.buffs) a *= b.damageMult ?? 1;
  if (hero.promotion) {
    const fx = getPromotion(hero.promotion).effect;
    if (fx.kind === 'berserk') a *= 1 + Math.min(fx.maxBonus, Math.max(0, 1 - hero.hp / hero.maxHp));
  }
  return a;
}

/** Lifesteal including temporary buffs (Rage). */
export function heroLifesteal(hero: Hero): number {
  let l = hero.stats.lifesteal;
  for (const b of hero.buffs) l += b.lifesteal ?? 0;
  return l;
}

/** Move speed including temporary buffs (statuses like slow are applied by the AI). */
export function heroMoveSpeed(hero: Hero): number {
  let v = hero.stats.moveSpeed;
  for (const b of hero.buffs) v *= b.moveSpeedMult ?? 1;
  return v;
}

/** Damage the hero's barriers can still absorb. */
export function heroShield(hero: Hero): number {
  let s = 0;
  for (const b of hero.buffs) s += b.shield && b.shield > 0 ? b.shield : 0;
  return s;
}

/** Regeneration per second including temporary buffs. */
export function heroRegen(hero: Hero): number {
  let r = hero.stats.hpRegen;
  for (const b of hero.buffs) r += b.regen ?? 0;
  return r;
}

export function healFull(hero: Hero): void {
  hero.hp = hero.maxHp;
  hero.mana = hero.stats.manaMax;
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

/** Moves a skill to another slot; swaps if that slot is occupied. The signature slot (R) stays put. */
export function moveSkill(hero: Hero, from: number, to: number): void {
  if (from === to || to < 0 || to >= PROGRESSION.skillSlots || from >= PROGRESSION.skillSlots) return;
  const a = skillInSlot(hero, from);
  if (!a) return;
  const b = skillInSlot(hero, to);
  if (b) b.slot = from;
  a.slot = to;
}
