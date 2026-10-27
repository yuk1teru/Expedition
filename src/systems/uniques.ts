// Items with effects (ROADMAP 14.5): giving a rolled item its legendary power, skill affix or
// set; what the worn ones do — effects like the gifts' (added in gifts.ts), skill ranks and
// cooldowns; and the lines for the tooltips.

import type { Rng } from '../core/rng';
import { RANKS } from '../data/balance';
import { CLASSES } from '../data/classes';
import type { GiftEffect } from '../data/gifts';
import { getSkill, SKILLS } from '../data/skills';
import { AFFIXES, ITEM_SETS, LEGENDARIES, type LegendaryDef } from '../data/uniques';
import type { Hero } from './entities';
import type { Item } from './items';

/** Skill ids a class can have on an affix (its own skills, not the branch ones). */
function classSkills(classId: string): string[] {
  return (CLASSES[classId]?.skills ?? []).filter((id) => SKILLS[id]);
}

/**
 * A freshly rolled item gets its special part: a legendary — the power of one of its slot (most
 * often of the hero's class); a rare or epic one — maybe a skill affix of the hero's class.
 */
export function applyUniques(rng: Rng, item: Item, classId: string | null | undefined): void {
  if (item.rarity === 'legendary') {
    const l = item.legendary ? LEGENDARIES[item.legendary] : pickLegendary(rng, Object.values(LEGENDARIES).filter((x) => x.slot === item.slot), classId);
    if (l) {
      item.legendary = l.id;
      item.name = l.name;
    }
    return;
  }
  const chance = AFFIXES.chance[item.rarity] ?? 0;
  if (!classId || !rng.chance(chance)) return;
  const skills = classSkills(classId);
  if (skills.length === 0) return;
  const skill = rng.pick(skills);
  item.affix = rng.chance(AFFIXES.rankShare)
    ? { kind: 'rank', skill, value: 1 }
    : { kind: 'cooldown', skill, value: Math.round(rng.float(AFFIXES.cooldown[0], AFFIXES.cooldown[1]) * 100) / 100 };
}

/** One of these legendaries: of the hero's class with AFFIXES.legendaryOwnClass, else any. */
export function pickLegendary(rng: Rng, from: LegendaryDef[], classId: string | null | undefined): LegendaryDef | undefined {
  if (from.length === 0) return undefined;
  const own = from.filter((l) => l.classId === classId);
  return rng.pick(own.length > 0 && rng.chance(AFFIXES.legendaryOwnClass) ? own : from);
}

/** A miniboss / boss item of the set's region may be a set piece (keeps its rarity and stats). */
export function maybeSetPiece(rng: Rng, item: Item, region: string): void {
  if (item.rarity === 'legendary') return;
  for (const set of Object.values(ITEM_SETS)) {
    if (set.region !== region || !rng.chance(set.chance)) continue;
    item.set = set.id;
    item.name = set.pieces[item.slot];
    item.affix = undefined;
    return;
  }
}

const worn = (hero: Hero): Item[] => Object.values(hero.equipment).filter((x): x is Item => !!x);

/** Worn pieces of each set. */
export function setCounts(hero: Hero): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of worn(hero)) if (it.set) out[it.set] = (out[it.set] ?? 0) + 1;
  return out;
}

/** Effects of the worn legendaries and of the set bonuses (they act like gifts). */
export function itemEffects(hero: Hero): GiftEffect[] {
  const out: GiftEffect[] = [];
  for (const it of worn(hero)) if (it.legendary) out.push(...(LEGENDARIES[it.legendary]?.effects ?? []));
  for (const [id, n] of Object.entries(setCounts(hero))) {
    const set = ITEM_SETS[id];
    if (!set) continue;
    if (n >= 2) out.push(...set.bonus2.effects);
    if (n >= 4) out.push(...set.bonus4.effects);
  }
  return out;
}

/** The rank a skill works at: its own plus the worn "+1 до рангу" affixes (up to the max). */
export function effectiveRank(hero: Hero, skillId: string, rank: number): number {
  let bonus = 0;
  for (const it of worn(hero)) if (it.affix?.kind === 'rank' && it.affix.skill === skillId) bonus += it.affix.value;
  return Math.min(RANKS.max, rank + bonus);
}

/** Cooldown multiplier of a skill from the worn "−X% перезарядки" affixes. */
export function affixCooldownMult(hero: Hero, skillId: string): number {
  let cut = 0;
  for (const it of worn(hero)) if (it.affix?.kind === 'cooldown' && it.affix.skill === skillId) cut += it.affix.value;
  return Math.max(0.5, 1 - cut);
}

/** Tooltip lines of an item's special part. */
export function uniqueLines(item: Item): string[] {
  const out: string[] = [];
  if (item.legendary) {
    const l = LEGENDARIES[item.legendary];
    if (l) out.push(`Легендарна сила: ${l.text}`);
  }
  if (item.affix) {
    const name = getSkill(item.affix.skill).name;
    out.push(item.affix.kind === 'rank' ? `+1 до рангу «${name}»` : `−${Math.round(item.affix.value * 100)}% перезарядки «${name}»`);
  }
  if (item.set) {
    const set = ITEM_SETS[item.set];
    if (set) out.push(`${set.name}: 2 речі — ${set.bonus2.text}; 4 — ${set.bonus4.text}`);
  }
  return out;
}
