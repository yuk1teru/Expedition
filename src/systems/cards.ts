// Level-up card offers: new skill / skill upgrade / passive.

import { CARDS, PROGRESSION, RANKS } from '../data/balance';
import { getClass } from '../data/classes';
import { getPromotion } from '../data/promotions';
import { getPassive } from '../data/skills';
import type { Rng } from '../core/rng';
import type { Hero, HeroBuff } from './entities';
import { firstFreeSlot, recomputeHeroStats } from './hero';

export type Card =
  | { kind: 'newSkill'; skillId: string }
  | { kind: 'upgrade'; skillId: string; fromRank: number; toRank: number }
  | { kind: 'passive'; passiveId: string; stacks: number };

export type CardKind = Card['kind'];

function cardKey(c: Card): string {
  return c.kind === 'passive' ? `passive:${c.passiveId}` : `${c.kind}:${c.skillId}`;
}

/** Skill and passive ids the hero can draw from: the class pool, plus the branch after the promotion. */
export function cardPool(hero: Hero): { skills: string[]; passives: string[] } {
  if (!hero.classId) return { skills: [], passives: [] };
  const c = getClass(hero.classId);
  if (!hero.promotion) return { skills: c.skills, passives: c.passives };
  const p = getPromotion(hero.promotion);
  return { skills: [...c.skills, p.signature], passives: [...c.passives, ...p.passives] };
}

/** Branch cards weigh more after the promotion (PROGRESSION.branchCardWeight). */
function cardWeight(hero: Hero, c: Card): number {
  if (!hero.promotion) return 1;
  const p = getPromotion(hero.promotion);
  const branch = c.kind === 'passive' ? p.passives.includes(c.passiveId) : c.skillId === p.signature;
  return branch ? PROGRESSION.branchCardWeight : 1;
}

/** All valid cards for the hero right now, grouped by kind. */
export function availableCards(hero: Hero): Record<CardKind, Card[]> {
  const pool = cardPool(hero);
  const owned = new Map(hero.skills.map((s) => [s.id, s.rank]));
  const freeSlot = hero.skills.length < PROGRESSION.skillSlots;
  const out: Record<CardKind, Card[]> = { newSkill: [], upgrade: [], passive: [] };
  for (const id of pool.skills) {
    const rank = owned.get(id);
    if (rank === undefined) {
      if (freeSlot) out.newSkill.push({ kind: 'newSkill', skillId: id });
    } else if (rank < RANKS.max) {
      out.upgrade.push({ kind: 'upgrade', skillId: id, fromRank: rank, toRank: rank + 1 });
    }
  }
  for (const id of pool.passives) {
    const stacks = hero.passives[id] ?? 0;
    if (stacks < getPassive(id).maxStacks) out.passive.push({ kind: 'passive', passiveId: id, stacks });
  }
  return out;
}

/**
 * Offer of up to 3 different cards. Kinds are rolled by weight; if any upgrade
 * is possible, at least one upgrade is guaranteed.
 */
export function offerCards(hero: Hero, rng: Rng, size: number = CARDS.offerSize): Card[] {
  const avail = availableCards(hero);
  const remaining: Record<CardKind, Card[]> = {
    newSkill: rng.shuffle(avail.newSkill),
    upgrade: rng.shuffle(avail.upgrade),
    passive: rng.shuffle(avail.passive),
  };
  const offer: Card[] = [];
  const taken = new Set<string>();
  const take = (kind: CardKind): void => {
    const list = remaining[kind];
    if (list.length === 0) return;
    const card = rng.weighted(list.map((c) => ({ item: c, weight: cardWeight(hero, c) })));
    list.splice(list.indexOf(card), 1);
    if (!taken.has(cardKey(card))) {
      taken.add(cardKey(card));
      offer.push(card);
    }
  };
  if (remaining.upgrade.length > 0) take('upgrade');
  while (offer.length < size) {
    const kinds = (Object.keys(remaining) as CardKind[]).filter((k) => remaining[k].length > 0);
    if (kinds.length === 0) break;
    take(rng.weighted(kinds.map((k) => ({ item: k, weight: CARDS.weights[k] }))));
  }
  return rng.shuffle(offer);
}

export function rerollPrice(rerolls: number): number {
  return CARDS.reroll.base + CARDS.reroll.step * rerolls;
}

export function skipGold(level: number): number {
  return CARDS.skip.goldBase + CARDS.skip.goldPerLevel * level;
}

/** Buff for skipping a card choice: regen, damage and move speed for a few seconds. */
export function skipBuff(): HeroBuff {
  const s = CARDS.skip.buff;
  return { id: 'skipCard', time: s.duration, attackSpeedMult: 1, damageTakenMult: 1, damageMult: s.damageMult, moveSpeedMult: s.moveSpeedMult, regen: s.regen };
}

export function isCardValid(hero: Hero, card: Card): boolean {
  const avail = availableCards(hero);
  return avail[card.kind].some((c) => cardKey(c) === cardKey(card));
}

export function applyCard(hero: Hero, card: Card): void {
  if (!isCardValid(hero, card)) throw new Error(`Invalid card ${cardKey(card)}`);
  switch (card.kind) {
    case 'newSkill':
      hero.skills.push({ id: card.skillId, rank: 1, cooldown: 0, slot: firstFreeSlot(hero) });
      break;
    case 'upgrade': {
      const s = hero.skills.find((x) => x.id === card.skillId);
      if (s) s.rank = card.toRank;
      break;
    }
    case 'passive':
      hero.passives[card.passiveId] = (hero.passives[card.passiveId] ?? 0) + 1;
      break;
  }
  recomputeHeroStats(hero);
}
