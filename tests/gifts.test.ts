import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { GIFTS, GIFT_RULES, SKILL_TAGS } from '../src/data/gifts';
import { PROGRESSION } from '../src/data/balance';
import { SKILLS, skillParams } from '../src/data/skills';
import { createBattle } from '../src/systems/battle';
import { addStatus, damageEnemy } from '../src/systems/combat';
import { giftSkillParams, giftTagMult, offerGifts, takeGift } from '../src/systems/gifts';
import { assignClass, recomputeHeroStats } from '../src/systems/hero';
import { gainXp } from '../src/systems/leveling';
import { completeBattle, createGameState, teleport } from '../src/systems/run';
import { xpToNext } from '../src/systems/scaling';
import { spawnEnemy } from '../src/systems/waves';

function mage() {
  const s = createGameState(2);
  s.hero.level = PROGRESSION.classChoiceLevel;
  assignClass(s.hero, 'mage', ['fireball', 'frostRing']);
  return s;
}

describe('gifts', () => {
  it('data: skill gifts name real skills and params; tags name real skills', () => {
    for (const g of Object.values(GIFTS)) {
      expect(g.effects.length, g.id).toBeGreaterThan(0);
      for (const e of g.effects) if (e.kind === 'skill') expect(SKILLS[e.skill]?.ranks[0]![e.param], `${g.id}: ${e.skill}.${e.param}`).toBeDefined();
    }
    for (const id of Object.keys(SKILL_TAGS)) expect(SKILLS[id], id).toBeDefined();
  });

  it('an offer: 3 gifts of the rarity, not taken yet, skill gifts only for learned skills, at most one cursed', () => {
    const s = mage();
    const rng = new Rng(5);
    for (let i = 0; i < 200; i++) {
      for (const rarity of ['common', 'rare', 'legendary'] as const) {
        const offer = offerGifts(s.hero, rng, rarity);
        expect(offer.length).toBe(GIFT_RULES.offerSize);
        expect(new Set(offer.map((g) => g.id)).size).toBe(offer.length);
        expect(offer.filter((g) => g.cursed).length).toBeLessThanOrEqual(1);
        for (const g of offer) {
          for (const e of g.effects) if (e.kind === 'skill') expect(s.hero.skills.some((x) => x.id === e.skill), g.id).toBe(true);
        }
      }
    }
    takeGift(s.hero, 'swift', recomputeHeroStats);
    for (let i = 0; i < 50; i++) expect(offerGifts(s.hero, rng, 'common').map((g) => g.id)).not.toContain('swift');
  });

  it('a stat gift changes the stats; a curse takes something too', () => {
    const s = mage();
    const as = s.hero.stats.attackSpeed;
    takeGift(s.hero, 'swift', recomputeHeroStats);
    expect(s.hero.stats.attackSpeed).toBeCloseTo(as * 1.08);
    const hp = s.hero.maxHp;
    takeGift(s.hero, 'glass', recomputeHeroStats);
    expect(s.hero.maxHp).toBeLessThan(hp);
  });

  it('a skill gift brings the modifier from rank 1; a tag gift raises the tagged skills', () => {
    const s = mage();
    expect(skillParams('fireball', 1).ground).toBe(0);
    takeGift(s.hero, 'fireGround', recomputeHeroStats);
    expect(giftSkillParams(s.hero, 'fireball', skillParams('fireball', 1)).ground).toBe(1);
    takeGift(s.hero, 'area', recomputeHeroStats);
    expect(giftTagMult(s.hero, 'fireball')).toBeCloseTo(1 + 0.12);
    expect(giftTagMult(s.hero, 'teleport')).toBe(1);
  });

  it('element and status gifts raise the hits that fit', () => {
    const s = mage();
    teleport(s, 'quietGrove');
    const b = createBattle(s, 'quietGrove');
    const wolf = spawnEnemy(b, 'wolf', { x: 400, y: 300 });
    wolf.hp = wolf.maxHp = 1e6;
    wolf.armor = 0;
    takeGift(s.hero, 'fire', recomputeHeroStats);
    takeGift(s.hero, 'stunned', recomputeHeroStats);
    let hp = wolf.hp;
    damageEnemy(b, wolf, { amount: 100, crit: false, element: 'fire' }, { source: 'skill' });
    expect(hp - wolf.hp).toBeCloseTo(115);
    addStatus(wolf, 'stun', 5);
    hp = wolf.hp;
    damageEnemy(b, wolf, { amount: 100, crit: false, element: 'neutral' }, { source: 'skill' });
    expect(hp - wolf.hp).toBeCloseTo(120);
  });

  it('sources: every 5th level, and a legendary one for a boss', () => {
    const s = mage();
    s.modalQueue = [];
    for (let lv = s.hero.level; lv < GIFT_RULES.levelEvery; lv++) gainXp(s, xpToNext(lv));
    expect(s.modalQueue.some((m) => m.kind === 'gift')).toBe(true);
    s.modalQueue = [];
    teleport(s, 'enatLair');
    const b = createBattle(s, 'enatLair');
    b.outcome = 'won';
    completeBattle(s, b);
    expect(s.modalQueue).toContainEqual({ kind: 'gift', rarity: 'legendary' });
  });
});
