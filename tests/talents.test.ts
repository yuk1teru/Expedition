import { describe, expect, it } from 'vitest';
import { PROGRESSION, RANKS } from '../src/data/balance';
import { CLASS_ORDER } from '../src/data/classes';
import { SKILLS, skillParams } from '../src/data/skills';
import { TALENTS, TALENT_TREES } from '../src/data/talents';
import { assignClass, skillElement } from '../src/systems/hero';
import { createGameState } from '../src/systems/run';
import { canLearn, learn, nextFork, pointsSpent, pointsUpTo, rowOpen, setPanelSlot, startingSkills, treeCost, treeNodes } from '../src/systems/talents';

function warrior() {
  const s = createGameState(1);
  s.hero.level = PROGRESSION.classChoiceLevel;
  assignClass(s.hero, 'warrior', ['whirlwind', 'charge']);
  return s;
}

describe('talent points', () => {
  it('a point a level from TALENTS.pointsFrom, one more every bonusEvery levels: ~33 by the max level', () => {
    expect(pointsUpTo(TALENTS.pointsFrom - 1)).toBe(0);
    expect(pointsUpTo(PROGRESSION.maxLevel)).toBe(PROGRESSION.maxLevel - TALENTS.pointsFrom + 1 + Math.floor(PROGRESSION.maxLevel / TALENTS.bonusEvery));
  });

  it('nobody can learn the whole tree: it costs far more than all the points of a campaign', () => {
    for (const c of CLASS_ORDER) {
      if (!TALENT_TREES[c]) continue;
      const all = pointsUpTo(PROGRESSION.maxLevel) + 5;
      expect(treeCost(c), c).toBeGreaterThan(all * 1.5);
    }
  });

  it('every tree node is a real skill or passive of its class; the starting skills are the first row', () => {
    for (const [c, rows] of Object.entries(TALENT_TREES)) {
      expect(rows).toHaveLength(3);
      for (const n of treeNodes(c)) if (n.kind === 'skill') expect(SKILLS[n.id]?.classId, n.id).toBe(c);
      expect(startingSkills(c)).toEqual(rows[0]!.skills);
      expect(startingSkills(c).length).toBeGreaterThan(PROGRESSION.startingSkillPicks);
    }
  });
});

describe('learning', () => {
  it('prices: opening and ranks 2–3 cost 1, ranks 4–5 cost 2; the free starting skills are not counted', () => {
    const s = warrior();
    expect(pointsSpent(s.hero)).toBe(0);
    s.talentPoints = 20;
    const slam = treeNodes('warrior').find((n) => n.id === 'groundSlam')!;
    expect(learn(s, slam)).toBe(true);
    expect(s.talentPoints).toBe(19);
    learn(s, slam);
    learn(s, slam);
    learn(s, slam);
    expect(s.talentPoints).toBe(19 - TALENTS.rankCost[1]! - TALENTS.rankCost[2]! - TALENTS.rankCost[3]!);
    expect(s.hero.skills.find((x) => x.id === 'groundSlam')!.rank).toBe(4);
    expect(pointsSpent(s.hero)).toBe(TALENTS.rankCost.slice(0, 4).reduce((a, x) => a + x, 0));
  });

  it('rows open after 5 and 10 points in the tree', () => {
    const s = warrior();
    s.talentPoints = 30;
    const axe = treeNodes('warrior').find((n) => n.id === 'axeThrow')!;
    expect(canLearn(s, axe)).toBe('rowLocked');
    const armor = treeNodes('warrior').find((n) => n.id === 'armor')!;
    while (pointsSpent(s.hero) < TALENTS.rowUnlock[1]!) learn(s, armor);
    expect(rowOpen(s.hero, 2)).toBe(true);
    expect(canLearn(s, axe)).toBe('ok');
  });

  it('a fork rank: the chosen variant sets the params and may change the element', () => {
    const s = warrior();
    s.talentPoints = 10;
    const whirl = treeNodes('warrior').find((n) => n.id === 'whirlwind')!;
    learn(s, whirl);
    expect(nextFork(s.hero, 'whirlwind')).toBe(3);
    learn(s, whirl, 1);
    const hs = s.hero.skills.find((x) => x.id === 'whirlwind')!;
    expect(hs.rank).toBe(3);
    expect(hs.forks).toEqual({ 3: 1 });
    expect(skillParams('whirlwind', 3, hs.forks).pull).toBe(0);
    expect(skillParams('whirlwind', 3, { 3: 0 }).pull).toBeGreaterThan(0);
    expect(skillElement(s.hero, SKILLS.whirlwind!)).toBe('neutral');
    hs.forks = { 3: 0 };
    expect(skillElement(s.hero, SKILLS.whirlwind!)).toBe('wind');
  });

  it('a new skill takes a free panel slot (1–5), else waits off the panel; slots can be swapped', () => {
    const s = warrior();
    s.talentPoints = 50;
    for (const n of treeNodes('warrior')) if (n.kind === 'skill') while (canLearn(s, n) === 'ok' && !s.hero.skills.some((x) => x.id === n.id)) learn(s, n);
    // Learn passives to open the rows, then the rest of the skills.
    for (const n of treeNodes('warrior').filter((x) => x.kind === 'passive')) for (let i = 0; i < 5; i++) learn(s, n);
    for (const n of treeNodes('warrior')) if (n.kind === 'skill' && !s.hero.skills.some((x) => x.id === n.id)) learn(s, n);
    const on = s.hero.skills.filter((x) => x.slot >= 0 && x.slot < TALENTS.classSlots);
    const off = s.hero.skills.filter((x) => x.slot < 0);
    expect(on).toHaveLength(TALENTS.classSlots);
    expect(off.length).toBeGreaterThan(0);
    const waiting = off[0]!;
    setPanelSlot(s.hero, waiting.id, 0);
    expect(waiting.slot).toBe(0);
    expect(s.hero.skills.filter((x) => x.slot === 0)).toHaveLength(1);
    expect(s.hero.skills.filter((x) => x.slot < 0)).toHaveLength(off.length);
  });

  it('ranks stop at the max; points never go negative', () => {
    const s = warrior();
    s.talentPoints = 100;
    const whirl = treeNodes('warrior').find((n) => n.id === 'whirlwind')!;
    for (let i = 0; i < 10; i++) learn(s, whirl);
    expect(s.hero.skills.find((x) => x.id === 'whirlwind')!.rank).toBe(RANKS.max);
    expect(canLearn(s, whirl)).toBe('maxed');
    s.talentPoints = 0;
    expect(learn(s, treeNodes('warrior').find((n) => n.id === 'groundSlam')!)).toBe(false);
    expect(s.talentPoints).toBe(0);
  });
});

describe('class teacher', () => {
  it('a reset returns every point for gold; starting skills stay at rank 1, the rest is unlearned', async () => {
    const { resetTree, resetPrice, refundablePoints } = await import('../src/systems/talents');
    const { TEACHERS } = await import('../src/data/talents');
    const { NPCS } = await import('../src/data/npcs');
    const s = warrior();
    s.talentPoints = 12;
    const nodes = treeNodes('warrior');
    for (let i = 0; i < 3; i++) learn(s, nodes.find((n) => n.id === 'whirlwind')!, 1);
    learn(s, nodes.find((n) => n.id === 'groundSlam')!);
    learn(s, nodes.find((n) => n.id === 'armor')!);
    const spent = 12 - s.talentPoints;
    expect(refundablePoints(s.hero)).toBe(spent);
    s.gold = resetPrice(s.hero) - 1;
    expect(resetTree(s)).toBe(false);
    s.gold = resetPrice(s.hero);
    expect(resetTree(s)).toBe(true);
    expect(s.gold).toBe(0);
    expect(s.talentPoints).toBe(12);
    expect(s.hero.skills.map((x) => [x.id, x.rank, x.forks])).toEqual([
      ['whirlwind', 1, undefined],
      ['charge', 1, undefined],
    ]);
    expect(s.hero.passives).toEqual({});
    // Each class has its teacher, and the teacher can reset.
    for (const id of Object.values(TEACHERS.byClass)) expect(NPCS[id]!.nodes.hello!.options.some((o) => o.action === 'resetTree'), id).toBe(true);
  });
});
