import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { createBattle, stepBattle } from '../src/systems/battle';
import { addTelegraph } from '../src/systems/boss';
import { assignClass, firstFreeSlot, moveSkill, skillInSlot } from '../src/systems/hero';
import { SLICE_GROVE_ID, SLICE_LAIR_ID } from '../src/systems/mapgen';
import { createGameState, teleport } from '../src/systems/run';
import { useSkill } from '../src/systems/skills';
import { spawnEnemy } from '../src/systems/waves';

function warriorBattle(nodeId = SLICE_LAIR_ID) {
  const s = createGameState(11);
  s.hero.level = 3;
  assignClass(s.hero, 'warrior');
  s.hero.skills.push({ id: 'charge', rank: 1, cooldown: 0, slot: 1 }, { id: 'groundSlam', rank: 1, cooldown: 0, slot: 2 });
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

describe('player control', () => {
  function duel() {
    const { s, b } = warriorBattle(SLICE_GROVE_ID);
    s.hero.immortal = true;
    b.input.control = 'player';
    const hero = s.hero;
    const enemy = spawnEnemy(b, 'stump', { x: hero.pos.x + 45, y: hero.pos.y });
    enemy.speed = 0;
    enemy.damage = 0;
    return { s, b, hero, enemy };
  }

  it('without movement keys the hero stays put', () => {
    const { b, hero } = duel();
    const p0 = { ...hero.pos };
    b.input.aim = { x: hero.pos.x - 200, y: hero.pos.y };
    for (let t = 0; t < 1; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(Math.hypot(hero.pos.x - p0.x, hero.pos.y - p0.y)).toBeLessThan(10);
  });

  it('attacks only towards the cursor, and keeps the last direction when the cursor leaves the arena', () => {
    const { b, hero, enemy } = duel();
    const hp0 = enemy.hp;
    b.input.aim = { x: hero.pos.x - 200, y: hero.pos.y }; // facing away
    for (let t = 0; t < 1.5; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(enemy.hp).toBe(hp0);
    b.input.aim = { x: hero.pos.x + 200, y: hero.pos.y }; // towards the enemy
    stepBattle(b, LOOP.step);
    b.input.aim = null; // cursor left the arena
    for (let t = 0; t < 1.5; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(enemy.hp).toBeLessThan(hp0);
  });
});

describe('class basic attacks', () => {
  function pair(withClass: boolean) {
    const s = createGameState(31);
    s.hero.immortal = true;
    if (withClass) {
      s.hero.level = 3;
      assignClass(s.hero, 'warrior');
    }
    teleport(s, SLICE_GROVE_ID);
    const b = createBattle(s, SLICE_GROVE_ID);
    b.input.control = 'player';
    const h = s.hero.pos;
    const a = spawnEnemy(b, 'stump', { x: h.x + 40, y: h.y });
    const c = spawnEnemy(b, 'stump', { x: h.x + 30, y: h.y + 34 });
    for (const e of [a, c]) {
      e.speed = 0;
      e.damage = 0;
      e.mass = 1000;
    }
    b.input.aim = { x: h.x + 200, y: h.y };
    stepBattle(b, LOOP.step);
    return { a, c };
  }

  it('novice hits a single enemy; Warrior splashes others in the arc', () => {
    const novice = pair(false);
    const hitNovice = [novice.a, novice.c].filter((e) => e.hp < e.maxHp).length;
    expect(hitNovice).toBe(1);
    const warrior = pair(true);
    const hits = [warrior.a, warrior.c].map((e) => e.maxHp - e.hp).sort((x, y) => y - x);
    expect(hits[1]).toBeGreaterThan(0);
    expect(hits[1]! / hits[0]!).toBeCloseTo(0.4, 1);
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

  it('Charge hits every enemy on its path, not only at the landing spot', () => {
    const { s, b } = warriorBattle(SLICE_GROVE_ID);
    const h = s.hero.pos;
    const onPath = spawnEnemy(b, 'stump', { x: h.x - 120, y: h.y + 10 });
    const offPath = spawnEnemy(b, 'stump', { x: h.x - 120, y: h.y + 150 });
    const hp = onPath.hp;
    b.input.aim = { x: h.x - 280, y: h.y };
    expect(useSkill(b, 1)).toBe('cast');
    for (let t = 0; t < 0.5; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(onPath.hp).toBeLessThan(hp);
    expect(offPath.hp).toBe(offPath.maxHp);
  });

  it('without aim Charge keeps automatic targeting', () => {
    const { s, b } = warriorBattle(SLICE_GROVE_ID);
    expect(useSkill(b, 1)).toBe('noTarget');
    expect(skillInSlot(s.hero, 1)!.cooldown).toBe(0);
  });
});

describe('skill reordering', () => {
  it('swaps occupied slots, moves into empty ones and keeps cooldowns with the skill', () => {
    const { s } = warriorBattle();
    const bar = (): (string | undefined)[] => [0, 1, 2, 3].map((i) => skillInSlot(s.hero, i)?.id);
    skillInSlot(s.hero, 1)!.cooldown = 3;
    moveSkill(s.hero, 1, 0);
    expect(bar()).toEqual(['charge', 'whirlwind', 'groundSlam', undefined]);
    expect(skillInSlot(s.hero, 0)!.cooldown).toBe(3);
    moveSkill(s.hero, 0, 3);
    expect(bar()).toEqual([undefined, 'whirlwind', 'groundSlam', 'charge']);
  });

  it('a lone skill can be dragged from slot 1 to empty slot 2, new skills fill free slots', () => {
    const s = createGameState(3);
    s.hero.level = 3;
    assignClass(s.hero, 'warrior');
    moveSkill(s.hero, 0, 1);
    expect(skillInSlot(s.hero, 0)).toBeUndefined();
    expect(skillInSlot(s.hero, 1)?.id).toBe('whirlwind');
    expect(firstFreeSlot(s.hero)).toBe(0);
  });
});
