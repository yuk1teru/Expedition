// The rework's core (ROADMAP 20.2–20.5): rules, not numbers — the numbers live in
// src/data/rework.ts and change in play.
import { describe, expect, it } from 'vitest';
import { REWORK_CARDS, REWORK_FLOOD, REWORK_MAP, REWORK_PROGRESS } from '../src/data/rework';
import { damageHero } from '../src/systems/rework/combat';
import { powerAt, spawnBeast, spawnInterval } from '../src/systems/rework/enemies';
import { dodge, heroStats } from '../src/systems/rework/hero';
import { isFree, resolveBody } from '../src/systems/rework/map';
import { chooseCard, gainXp, reroll, rerollPrice, xpToNext } from '../src/systems/rework/progress';
import { createRun, runPaused, stepRun, stressSpawn } from '../src/systems/rework/run';

const still = { x: 0, y: 0 };

describe('rework map (20.2)', () => {
  it('obstacles stand apart, inside the field and away from the start', () => {
    const run = createRun(11, 'warrior');
    const start = run.hero.pos;
    expect(run.obstacles.length).toBeGreaterThan(100);
    for (const o of run.obstacles) {
      expect(Math.hypot(o.pos.x - start.x, o.pos.y - start.y)).toBeGreaterThanOrEqual(REWORK_MAP.startClear);
      expect(o.pos.x).toBeGreaterThan(0);
      expect(o.pos.x).toBeLessThan(run.width);
    }
    for (let i = 0; i < run.obstacles.length; i++) {
      for (let j = i + 1; j < run.obstacles.length; j++) {
        const a = run.obstacles[i]!;
        const b = run.obstacles[j]!;
        expect(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)).toBeGreaterThanOrEqual(a.radius + b.radius);
      }
    }
    expect(run.obstacles.filter((o) => o.kind === 'oak' || o.kind === 'stoneRing' || o.kind === 'log').length).toBe(3);
  });

  it('a body is pushed out of an obstacle', () => {
    const run = createRun(12, 'warrior');
    const o = run.obstacles.find((x) => x.kind === 'tree')!;
    const p = { x: o.pos.x + 1, y: o.pos.y };
    resolveBody(run.grid, p, 14, run.width, run.height);
    expect(isFree(run.grid, p, 13.9)).toBe(true);
  });

  it('the hero cannot walk through a tree', () => {
    const run = createRun(13, 'warrior');
    const o = run.obstacles.find((x) => x.kind === 'tree')!;
    run.hero.pos = { x: o.pos.x - o.radius - 40, y: o.pos.y };
    for (let i = 0; i < 120; i++) stepRun(run, 1 / 60, { x: 1, y: 0 });
    expect(Math.hypot(run.hero.pos.x - o.pos.x, run.hero.pos.y - o.pos.y)).toBeGreaterThanOrEqual(o.radius + run.hero.radius - 0.5);
  });
});

describe('rework flood (20.3)', () => {
  it('beasts come ever more often and ever stronger', () => {
    expect(spawnInterval(0)).toBeGreaterThan(spawnInterval(120));
    expect(spawnInterval(120)).toBeGreaterThan(spawnInterval(REWORK_FLOOD.rampTime));
    expect(powerAt(300).hp).toBeGreaterThan(powerAt(60).hp);
    expect(powerAt(300).damage).toBeGreaterThan(powerAt(60).damage);
  });

  it('the flood is thin at first and thick later', () => {
    const run = createRun(21, 'warrior');
    run.hero.immortal = true;
    // Level-ups stop the run for a card: take the first one.
    const go = (): void => {
      stepRun(run, 1 / 60, still);
      while (run.offer) chooseCard(run, 0);
    };
    for (let i = 0; i < 60 * 30; i++) go();
    const early = run.nextId;
    run.time = 300;
    const before = run.nextId;
    for (let i = 0; i < 60 * 30; i++) go();
    expect(run.nextId - before).toBeGreaterThan(early * 2);
    expect(run.enemies.length).toBeLessThanOrEqual(REWORK_FLOOD.maxAlive);
  });

  it('only wolves at the start; the mushroom and the stump join later', () => {
    const run = createRun(22, 'warrior');
    run.hero.immortal = true;
    for (let i = 0; i < 60 * 20; i++) {
      stepRun(run, 1 / 60, still);
      while (run.offer) chooseCard(run, 0);
    }
    expect(run.enemies.every((e) => e.def === 'wolf')).toBe(true);
  });
});

describe('rework combat (20.4)', () => {
  it('each class kills a beast next to it on its own', () => {
    for (const cls of ['warrior', 'mage', 'archer'] as const) {
      const run = createRun(31, cls);
      run.spawnTimer = 1e9;
      run.hero.immortal = true;
      const e = spawnBeast(run, 'wolf', run.hero.pos)!;
      e.pos = { x: run.hero.pos.x + 50, y: run.hero.pos.y };
      for (let i = 0; i < 60 * 10 && !e.dead; i++) stepRun(run, 1 / 60, still);
      expect(e.dead, cls).toBe(true);
      expect(run.gems.length + (run.xp > 0 ? 1 : 0)).toBeGreaterThan(0);
    }
  });

  it('a dodge gives invulnerability and waits for its cooldown', () => {
    const run = createRun(32, 'warrior');
    expect(dodge(run, { x: 1, y: 0 })).toBe(true);
    const hp = run.hero.hp;
    damageHero(run, 50);
    expect(run.hero.hp).toBe(hp);
    expect(dodge(run, { x: 1, y: 0 })).toBe(false);
  });

  it('the hero dies at 0 HP and the run stops', () => {
    const run = createRun(33, 'mage');
    damageHero(run, run.hero.hp + 1);
    expect(run.hero.dead).toBe(true);
    expect(runPaused(run)).toBe(true);
    const t = run.time;
    stepRun(run, 1, still);
    expect(run.time).toBe(t);
  });

  it('a long run stays sound (no stuck numbers)', () => {
    const run = createRun(34, 'archer');
    run.hero.immortal = true;
    stressSpawn(run, 300);
    for (let i = 0; i < 60 * 60; i++) {
      stepRun(run, 1 / 60, { x: Math.cos(i / 90), y: Math.sin(i / 90) });
      while (run.offer) chooseCard(run, 0);
    }
    expect(Number.isFinite(run.hero.pos.x) && Number.isFinite(run.hero.pos.y)).toBe(true);
    expect(run.enemies.every((e) => Number.isFinite(e.pos.x) && Number.isFinite(e.pos.y))).toBe(true);
  });
});

describe('rework experience and cards (20.5)', () => {
  it('each level needs more experience', () => {
    for (let l = 1; l < 30; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('a level-up stops the run with up to three different cards', () => {
    const run = createRun(41, 'warrior');
    gainXp(run, xpToNext(1));
    expect(run.level).toBe(2);
    expect(run.offer).not.toBeNull();
    const ids = run.offer!.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(3);
    expect(runPaused(run)).toBe(true);
  });

  it('a chosen card raises its rank; Health raises max HP', () => {
    const run = createRun(42, 'warrior');
    const hp = heroStats(run).maxHp;
    run.cards.health = 0;
    gainXp(run, xpToNext(1));
    run.offer = [{ id: 'health', rank: 1 }];
    chooseCard(run, 0);
    expect(run.cards.health).toBe(1);
    expect(run.hero.maxHp).toBeGreaterThan(hp);
    expect(run.offer).toBeNull();
  });

  it('a card at its last rank is not offered again', () => {
    const run = createRun(43, 'warrior');
    for (const id of Object.keys(REWORK_CARDS) as (keyof typeof REWORK_CARDS)[]) if (id !== 'magnet') run.cards[id] = REWORK_CARDS[id].ranks;
    gainXp(run, xpToNext(1));
    expect(run.offer!.map((c) => c.id)).toEqual(['magnet']);
  });

  it('re-rolling costs gold and gets dearer', () => {
    const run = createRun(44, 'warrior');
    gainXp(run, xpToNext(1));
    expect(reroll(run)).toBe(false);
    run.gold = 100;
    const p1 = rerollPrice(run);
    expect(reroll(run)).toBe(true);
    expect(run.gold).toBe(100 - p1);
    expect(rerollPrice(run)).toBe(p1 + REWORK_PROGRESS.rerollStep);
  });

  it('gems inside the magnet fly to the hero and give experience', () => {
    const run = createRun(45, 'warrior');
    run.spawnTimer = 1e9;
    run.gems.push({ pos: { x: run.hero.pos.x + 50, y: run.hero.pos.y }, xp: 1, pulled: false });
    for (let i = 0; i < 60; i++) stepRun(run, 1 / 60, still);
    expect(run.gems.length).toBe(0);
    expect(run.xp).toBe(1);
  });
});
