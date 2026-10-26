import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { PROGRESSION, RANKS } from '../src/data/balance';
import { getClass } from '../src/data/classes';
import { getPassive } from '../src/data/skills';
import { type Card, applyCard, availableCards, isCardValid, offerCards } from '../src/systems/cards';
import type { Hero } from '../src/systems/entities';
import { assignClass, createHero } from '../src/systems/hero';

function randomWarrior(rng: Rng): Hero {
  const hero = createHero(0);
  hero.level = 3;
  assignClass(hero, 'warrior');
  const picks = rng.int(0, 25);
  for (let i = 0; i < picks; i++) {
    const offer = offerCards(hero, rng);
    if (offer.length === 0) break;
    applyCard(hero, rng.pick(offer));
  }
  return hero;
}

function key(c: Card): string {
  return c.kind === 'passive' ? `p:${c.passiveId}` : `${c.kind}:${c.skillId}`;
}

describe('card offers', () => {
  it('never offers invalid cards across 1000 offers from random states', () => {
    const rng = new Rng(2024);
    for (let i = 0; i < 1000; i++) {
      const hero = randomWarrior(rng);
      const offer = offerCards(hero, rng);
      expect(offer.length).toBeLessThanOrEqual(3);
      expect(new Set(offer.map(key)).size).toBe(offer.length);
      for (const c of offer) expect(isCardValid(hero, c)).toBe(true);
      const avail = availableCards(hero);
      const total = avail.newSkill.length + avail.upgrade.length + avail.passive.length;
      expect(offer.length).toBe(Math.min(3, total));
      if (avail.upgrade.length > 0) expect(offer.some((c) => c.kind === 'upgrade')).toBe(true);
      // Applying any offered card keeps invariants.
      if (offer.length > 0) applyCard(hero, rng.pick(offer));
      expect(hero.skills.length).toBeLessThanOrEqual(PROGRESSION.skillSlots);
      for (const s of hero.skills) {
        expect(s.rank).toBeGreaterThanOrEqual(1);
        expect(s.rank).toBeLessThanOrEqual(RANKS.max);
      }
      for (const [id, stacks] of Object.entries(hero.passives)) {
        expect(stacks).toBeLessThanOrEqual(getPassive(id).maxStacks);
      }
      expect(new Set(hero.skills.map((s) => s.id)).size).toBe(hero.skills.length);
    }
  });

  it('is deterministic for the same seed and state', () => {
    const a = randomWarrior(new Rng(7));
    const b = randomWarrior(new Rng(7));
    expect(offerCards(a, new Rng(99))).toEqual(offerCards(b, new Rng(99)));
  });

  it('different seeds give different offer sequences', () => {
    const seq = (seed: number): string[] => {
      const hero = createHero(0);
      hero.level = 3;
      assignClass(hero, 'warrior');
      const rng = new Rng(seed);
      const out: string[] = [];
      for (let i = 0; i < 7; i++) {
        const offer = offerCards(hero, rng);
        out.push(offer.map(key).join(','));
        applyCard(hero, offer[0]!);
      }
      return out;
    };
    expect(seq(1)).not.toEqual(seq(2));
  });

  it('only class skills and passives are offered; all slots fill with all 4 warrior skills', () => {
    const rng = new Rng(5);
    const hero = createHero(0);
    hero.level = 3;
    assignClass(hero, 'warrior');
    const c = getClass('warrior');
    for (let i = 0; i < 40; i++) {
      const offer = offerCards(hero, rng);
      for (const card of offer) {
        if (card.kind === 'passive') expect(c.passives).toContain(card.passiveId);
        else expect(c.skills).toContain(card.skillId);
      }
      const ns = offer.find((x) => x.kind === 'newSkill');
      if (ns) applyCard(hero, ns);
      else if (offer[0]) applyCard(hero, offer[0]);
    }
    expect(hero.skills.length).toBe(4);
  });
});
