// Gifts in play (ROADMAP 12.8): the offer (3 of a rarity, the skill ones only for learned
// skills), taking one, and what the taken gifts do — stats, skill parameters, damage of
// tags, elements and against statuses. Reroll for gold, skip for gold and a short buff.

import { itemEffects } from './uniques';
import type { Rng } from '../core/rng';
import { CARDS } from '../data/balance';
import type { Element } from '../data/elements';
import { GIFTS, GIFT_RULES, type GiftDef, type GiftRarity, type GiftStat, SKILL_TAGS } from '../data/gifts';
import type { SkillParams } from '../data/skills';
import { skillParams } from '../data/skills';
import type { Enemy, Hero, HeroBuff } from './entities';

/** Can the hero use this gift now (a skill gift needs the skill and must change something). */
function fits(hero: Hero, g: GiftDef): boolean {
  if (hero.gifts.includes(g.id)) return false;
  for (const e of g.effects) {
    if (e.kind !== 'skill') continue;
    const s = hero.skills.find((x) => x.id === e.skill);
    if (!s) return false;
    if ((skillParams(s.id, s.rank, s.forks)[e.param] ?? 0) >= e.value) return false;
  }
  return true;
}

/** A window of gifts of this rarity (falls back to lower rarities when the pool runs dry). */
export function offerGifts(hero: Hero, rng: Rng, rarity: GiftRarity, size = GIFT_RULES.offerSize): GiftDef[] {
  const order: GiftRarity[] = rarity === 'legendary' ? ['legendary', 'rare', 'common'] : rarity === 'rare' ? ['rare', 'common'] : ['common'];
  const out: GiftDef[] = [];
  for (const r of order) {
    const pool = Object.values(GIFTS).filter((g) => g.rarity === r && fits(hero, g) && !out.includes(g));
    // At most one cursed gift in a window, and not always.
    const cursed = pool.filter((g) => g.cursed);
    const clean = rng.shuffle(pool.filter((g) => !g.cursed));
    if (cursed.length > 0 && rng.chance(GIFT_RULES.cursedChance)) clean.splice(rng.int(0, Math.max(0, Math.min(size - 1, clean.length))), 0, rng.pick(cursed));
    for (const g of clean) if (out.length < size) out.push(g);
    if (out.length >= size) break;
  }
  return out;
}

export function takeGift(hero: Hero, id: string, recompute: (h: Hero) => void): void {
  if (!GIFTS[id] || hero.gifts.includes(id)) return;
  hero.gifts.push(id);
  recompute(hero);
}

/** The gifts' effects and those of the worn legendaries and sets (ROADMAP 14.5). */
function effects(hero: Hero): GiftDef['effects'] {
  return [...hero.gifts.flatMap((id) => GIFTS[id]?.effects ?? []), ...itemEffects(hero)];
}

/** Sum of the gifts' stat bonuses. */
export function giftStat(hero: Hero, stat: GiftStat): number {
  let sum = 0;
  for (const e of effects(hero)) if (e.kind === 'stat' && e.stat === stat) sum += e.value;
  return sum;
}

/** Skill params with the gifts that bring a modifier early. */
export function giftSkillParams(hero: Hero, skillId: string, p: SkillParams): SkillParams {
  let out = p;
  for (const e of effects(hero)) {
    if (e.kind !== 'skill' || e.skill !== skillId) continue;
    if ((out[e.param] ?? 0) < e.value) out = { ...out, [e.param]: e.value };
  }
  return out;
}

/** Damage multiplier of a skill from the tag gifts. */
export function giftTagMult(hero: Hero, skillId: string): number {
  const tags = SKILL_TAGS[skillId] ?? [];
  let sum = 0;
  for (const e of effects(hero)) if (e.kind === 'tag' && tags.includes(e.tag)) sum += e.value;
  return 1 + sum;
}

/** Damage multiplier of a hit from the element and status gifts. */
export function giftHitMult(hero: Hero, element: Element, e: Enemy): number {
  let sum = 0;
  for (const g of effects(hero)) {
    if (g.kind === 'element' && (g.element === element || (g.element === 'any' && element !== 'neutral'))) sum += g.value;
    else if (g.kind === 'status') {
      const st = e.statuses[g.status];
      if (st && st.time > 0) sum += g.value;
    }
  }
  return 1 + sum;
}

export function rerollPrice(rerolls: number): number {
  return CARDS.reroll.base + CARDS.reroll.step * rerolls;
}

export function skipGold(level: number): number {
  return Math.round(CARDS.skip.goldBase + CARDS.skip.goldPerLevel * level);
}

/** Buff for skipping a gift: regen, damage and move speed for a few seconds. */
export function skipBuff(): HeroBuff {
  const s = CARDS.skip.buff;
  return { id: 'skipGift', time: s.duration, attackSpeedMult: 1, damageTakenMult: 1, damageMult: s.damageMult, moveSpeedMult: s.moveSpeedMult, regen: s.regen };
}
