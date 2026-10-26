import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { createBattle, stepBattle } from '../src/systems/battle';
import { addTelegraph } from '../src/systems/boss';
import { assignClass, moveSkill } from '../src/systems/hero';
import { SLICE_GROVE_ID, SLICE_LAIR_ID } from '../src/systems/mapgen';
import { createGameState, teleport } from '../src/systems/run';
import { useSkill } from '../src/systems/skills';

function warriorBattle(nodeId = SLICE_LAIR_ID) {
  const s = createGameState(11);
  s.hero.level = 3;
  assignClass(s.hero, 'warrior');
  s.hero.skills.push({ id: 'charge', rank: 1, cooldown: 0 }, { id: 'groundSlam', rank: 1, cooldown: 0 });
  teleport(s, nodeId);
  return { s, b: createBattle(s, nodeId) };
}

describe('manual movement', () => {
  it('held direction moves the hero regardless of the AI target', () => {
    const { s, b } = warriorBattle();
    s.hero.immortal = true;
    const x0 = s.hero.pos.x;
    b.input.move = { x: 1, y: 0 };
    for (let t = 0; t < 1; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(s.hero.pos.x - x0).toBeGreaterThan(s.hero.stats.moveSpeed * 0.8);
  });

  it('lets the hero step out of a telegraph before it fires', () => {
    const { s, b } = warriorBattle();
    s.hero.immortal = true;
    b.enemies = [];
    b.boss = null;
    const hp = s.hero.hp;
    addTelegraph(b, 'roots', s.hero.pos, 60, 30, 0.8);
    b.input.move = { x: -1, y: 0 };
    for (let t = 0; t < 1; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(s.hero.hp).toBe(hp);
  });
});

describe('aimed skills', () => {
  it('Charge flies towards the aim point', () => {
    const { s, b } = warriorBattle();
    const start = { ...s.hero.pos };
    b.input.aim = { x: start.x - 200, y: start.y };
    expect(useSkill(b, 1)).toBe('cast');
    for (let t = 0; t < 0.5; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(s.hero.pos.x).toBeLessThan(start.x - 150);
  });

  it('without aim Charge keeps automatic targeting', () => {
    const { s, b } = warriorBattle(SLICE_GROVE_ID);
    expect(useSkill(b, 1)).toBe('noTarget');
    expect(s.hero.skills[1]!.cooldown).toBe(0);
  });
});

describe('skill reordering', () => {
  it('swaps occupied slots and keeps cooldowns with the skill', () => {
    const { s } = warriorBattle();
    s.hero.skills[1]!.cooldown = 3;
    moveSkill(s.hero, 1, 0);
    expect(s.hero.skills.map((x) => x.id)).toEqual(['charge', 'whirlwind', 'groundSlam']);
    expect(s.hero.skills[0]!.cooldown).toBe(3);
    moveSkill(s.hero, 0, 3);
    expect(s.hero.skills.map((x) => x.id)).toEqual(['whirlwind', 'groundSlam', 'charge']);
  });
});
