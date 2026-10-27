import { describe, expect, it } from 'vitest';
import { PROGRESSION } from '../src/data/balance';
import { CLASSES } from '../src/data/classes';
import { PROMOTIONS } from '../src/data/promotions';
import { skillParams } from '../src/data/skills';
import { giftSkillParams } from '../src/systems/gifts';
import { assignClass } from '../src/systems/hero';
import { chooseBranchFork, choosePromotion, completePromotion, createGameState } from '../src/systems/run';

describe('branch forks at level 22 (ROADMAP 15.6)', () => {
  it('every branch offers two boosts of real class skills, each changing something', () => {
    for (const p of Object.values(PROMOTIONS)) {
      expect(p.forks22).toHaveLength(2);
      for (const f of p.forks22) {
        expect(CLASSES[p.classId]!.skills, `${p.id}: ${f.skill}`).toContain(f.skill);
        const top = skillParams(f.skill, 5);
        expect(Object.entries(f.set).some(([k, v]) => (top[k] ?? 0) < v), `${p.id}: ${f.name} beyond rank 5`).toBe(true);
      }
    }
  });

  it('the second stage asks for the choice; the chosen boost works', () => {
    const s = createGameState(3);
    s.hero.level = PROGRESSION.promotion2Level;
    assignClass(s.hero, 'warrior', ['whirlwind', 'charge']);
    choosePromotion(s, 'berserker');
    expect(s.modalQueue.some((m) => m.kind === 'branchFork')).toBe(true);
    const fork = PROMOTIONS.berserker!.forks22[0];
    const before = giftSkillParams(s.hero, fork.skill, skillParams(fork.skill, 1));
    chooseBranchFork(s, 0);
    const after = giftSkillParams(s.hero, fork.skill, skillParams(fork.skill, 1));
    for (const [k, v] of Object.entries(fork.set)) expect(after[k]).toBeGreaterThanOrEqual(v);
    expect(after).not.toEqual(before);
    // Asked once.
    s.modalQueue = [];
    completePromotion(s);
    expect(s.modalQueue.some((m) => m.kind === 'branchFork')).toBe(false);
  });
});
