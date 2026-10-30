// The rework's core (ROADMAP 20.2–20.5): rules, not numbers — the numbers live in
// src/data/rework.ts and change in play.
import { describe, expect, it } from 'vitest';
import { PASSIVE_SLOTS, REWORK_BOSS, REWORK_CARDS, REWORK_ELITES, REWORK_FLOOD, REWORK_MAP, REWORK_PICKUPS, REWORK_PROGRESS, REWORK_SPIRIT, REWORK_TASKS } from '../src/data/rework';
import { damageEnemy as damageEnemyHit, damageHero } from '../src/systems/rework/combat';
import { powerAt, spawnBeast, spawnInterval } from '../src/systems/rework/enemies';
import { dodge, heroStats } from '../src/systems/rework/hero';
import { isFree, resolveBody } from '../src/systems/rework/map';
import { chooseCard, gainXp, reroll, rerollPrice, xpToNext } from '../src/systems/rework/progress';
import { createRun, runPaused, stepRun, stressSpawn } from '../src/systems/rework/run';
import { castSkill, effectiveParams, evolutionReady } from '../src/systems/rework/skills';
import { formRing, outsideRing } from '../src/systems/rework/boss';
import { altarPrice, openChest, useAltar } from '../src/systems/rework/pickups';
import { startTask } from '../src/systems/rework/task';
import { sightRadius } from '../src/systems/rework/spirit';
import { CLASS_SKILLS, REWORK_SKILLS, type ReworkSkillId, SKILL_SLOTS, skillParams } from '../src/data/reworkSkills';

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

  it('every class dodges towards the cursor', () => {
    for (const cls of ['warrior', 'mage', 'archer'] as const) {
      const run = createRun(35, cls);
      const from = { x: run.hero.pos.x, y: run.hero.pos.y };
      dodge(run, { x: 1, y: 0 }, { x: from.x, y: from.y + 300 });
      for (let i = 0; i < 30; i++) stepRun(run, 1 / 60, still);
      expect(run.hero.pos.y - from.y, cls).toBeGreaterThan(40);
      expect(Math.abs(run.hero.pos.x - from.x), cls).toBeLessThan(20);
    }
  });

  it('without a cursor (the setting "along the walk") the dodge follows the walk', () => {
    const run = createRun(36, 'warrior');
    const from = { x: run.hero.pos.x, y: run.hero.pos.y };
    dodge(run, { x: 0, y: -1 }, null);
    for (let i = 0; i < 30; i++) stepRun(run, 1 / 60, still);
    expect(from.y - run.hero.pos.y).toBeGreaterThan(40);
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
    run.offer = [{ kind: 'passive', id: 'health', rank: 1 }];
    chooseCard(run, 0);
    expect(run.cards.health).toBe(1);
    expect(run.hero.maxHp).toBeGreaterThan(hp);
    expect(run.offer).toBeNull();
  });

  it('a card at its last rank is not offered again', () => {
    const run = createRun(43, 'warrior');
    for (const id of ['amount', 'area', 'cooldown', 'health'] as const) run.cards[id] = REWORK_CARDS[id].ranks;
    run.skills = (['whirlwind', 'groundSlam', 'axeThrow', 'battleCry'] as const).map((id) => ({ id, rank: 5, cooldown: 0, evolved: true }));
    gainXp(run, xpToNext(1));
    expect(run.offer!.map((c) => c.id).sort()).toEqual(['magnet', 'swiftness']);
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

describe('rework skills (20.6)', () => {
  it('the first choice is three new skills of the class', () => {
    const run = createRun(51, 'mage');
    gainXp(run, xpToNext(1));
    expect(run.offer!.length).toBe(3);
    for (const c of run.offer!) {
      expect(c.kind).toBe('skill');
      expect(c.rank).toBe(1);
      expect(CLASS_SKILLS.mage).toContain(c.id);
    }
  });

  it('no more than four skills; then only their ranks and passives', () => {
    const run = createRun(52, 'archer');
    run.skills = CLASS_SKILLS.archer.map((id) => ({ id, rank: 1, cooldown: 0 }));
    gainXp(run, xpToNext(1));
    for (const c of run.offer!) if (c.kind === 'skill') expect(c.rank).toBeGreaterThan(1);
    expect(run.skills.length).toBe(SKILL_SLOTS);
  });

  it('every rank says what it changes and changes a number', () => {
    for (const id of Object.keys(REWORK_SKILLS) as ReworkSkillId[]) {
      const d = REWORK_SKILLS[id];
      d.ranks.forEach((r, i) => {
        expect(r.text.length, id).toBeGreaterThan(3);
        expect(JSON.stringify(skillParams(id, i + 2)), `${id} rank ${i + 2}`).not.toBe(JSON.stringify(skillParams(id, i + 1)));
      });
    }
  });

  it('a skill waits for its cooldown', () => {
    const run = createRun(53, 'warrior');
    run.skills = [{ id: 'groundSlam', rank: 1, cooldown: 0 }];
    expect(castSkill(run, 0, null)).toBe(true);
    expect(castSkill(run, 0, null)).toBe(false);
    expect(castSkill(run, 1, null)).toBe(false);
  });

  it('every skill hurts a beast standing where it is aimed', () => {
    for (const cls of ['warrior', 'mage', 'archer'] as const) {
      for (const id of CLASS_SKILLS[cls]) {
        if (id === 'battleCry') continue;
        const run = createRun(54, cls);
        run.spawnTimer = 1e9;
        run.hero.immortal = true;
        run.hero.attackTimer = 1e9;
        const e = spawnBeast(run, 'stump', run.hero.pos)!;
        e.pos = { x: run.hero.pos.x + 80, y: run.hero.pos.y };
        e.traitTimer = 1e9;
        const hp = e.hp;
        run.skills = [{ id, rank: 1, cooldown: 0 }];
        castSkill(run, 0, { x: e.pos.x, y: e.pos.y });
        // A trap waits for the beast to step on it.
        if (id === 'hunterTrap') run.traps[0]!.pos = { x: e.pos.x, y: e.pos.y };
        for (let i = 0; i < 90; i++) {
          stepRun(run, 1 / 60, still);
          run.hero.attackTimer = 1e9;
        }
        expect(e.hp, id).toBeLessThan(hp);
      }
    }
  });

  it('a frozen or stunned beast stands still', () => {
    const run = createRun(55, 'mage');
    run.spawnTimer = 1e9;
    run.hero.immortal = true;
    run.hero.attackTimer = 1e9;
    const e = spawnBeast(run, 'wolf', run.hero.pos)!;
    e.pos = { x: run.hero.pos.x + 90, y: run.hero.pos.y };
    run.skills = [{ id: 'frostRing', rank: 1, cooldown: 0 }];
    castSkill(run, 0, null);
    const at = { x: e.pos.x, y: e.pos.y };
    for (let i = 0; i < 30; i++) {
      stepRun(run, 1 / 60, still);
      run.hero.attackTimer = 1e9;
    }
    expect(e.freeze).toBeGreaterThan(0);
    expect(Math.hypot(e.pos.x - at.x, e.pos.y - at.y)).toBeLessThan(1);
  });

  it('the battle cry speeds the attack and takes damage off', () => {
    const run = createRun(56, 'warrior');
    run.skills = [{ id: 'battleCry', rank: 1, cooldown: 0 }];
    castSkill(run, 0, null);
    expect(run.buff).not.toBeNull();
    const hp = run.hero.hp;
    damageHero(run, 10);
    expect(hp - run.hero.hp).toBeCloseTo(10 * (1 - run.buff!.guard));
  });
});

describe('rework passives (20.7)', () => {
  it('no more than five passives; when full, only the taken ones grow', () => {
    const run = createRun(61, 'warrior');
    run.skills = CLASS_SKILLS.warrior.map((id) => ({ id, rank: 5, cooldown: 0, evolved: true }));
    for (const id of ['amount', 'area', 'cooldown', 'health', 'swiftness'] as const) run.cards[id] = 1;
    gainXp(run, xpToNext(1));
    expect(run.offer!.length).toBeGreaterThan(0);
    for (const c of run.offer!) expect(c.id).not.toBe('magnet');
    expect(PASSIVE_SLOTS).toBe(5);
  });

  it('Кількість adds shots, Площа widens, Перезарядка shortens', () => {
    const run = createRun(62, 'mage');
    const sk = { id: 'fireball' as const, rank: 1, cooldown: 0 };
    const base = effectiveParams(run, sk);
    run.cards = { amount: 1, area: 2, cooldown: 3 };
    const p = effectiveParams(run, sk);
    expect(p.count).toBe(base.count + 1);
    expect(p.radius).toBeGreaterThan(base.radius);
    expect(p.cooldown).toBeLessThan(base.cooldown);
  });
});

describe('rework evolutions (20.8)', () => {
  it('a skill at rank 5 with its passive brings the golden card first', () => {
    const run = createRun(71, 'warrior');
    run.skills = [{ id: 'whirlwind', rank: 5, cooldown: 0 }];
    run.cards = { swiftness: 1 };
    expect(evolutionReady(run, run.skills[0]!)).toBe(true);
    gainXp(run, xpToNext(1));
    expect(run.offer![0]).toEqual({ kind: 'evolve', id: 'whirlwind', rank: 5 });
    chooseCard(run, 0);
    expect(run.skills[0]!.evolved).toBe(true);
    expect(evolutionReady(run, run.skills[0]!)).toBe(false);
  });

  it('without its passive there is no evolution', () => {
    const run = createRun(72, 'warrior');
    run.skills = [{ id: 'whirlwind', rank: 5, cooldown: 0 }];
    expect(evolutionReady(run, run.skills[0]!)).toBe(false);
  });

  it('evolved axes circle the hero and keep cutting', () => {
    const run = createRun(73, 'warrior');
    run.spawnTimer = 1e9;
    run.hero.attackTimer = 1e9;
    run.skills = [{ id: 'axeThrow', rank: 5, cooldown: 0, evolved: true }];
    castSkill(run, 0, null);
    expect(run.shots.filter((s) => s.kind === 'axe').length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 60; i++) stepRun(run, 1 / 60, still);
    for (const a of run.shots.filter((s) => s.kind === 'axe')) expect(Math.hypot(a.pos.x - run.hero.pos.x, a.pos.y - run.hero.pos.y)).toBeLessThan(120);
  });
});

describe('rework map things (20.9)', () => {
  it('elites come on time, stronger, and drop a chest', () => {
    const run = createRun(81, 'warrior');
    run.hero.immortal = true;
    run.time = REWORK_ELITES.times[0]! - 0.01;
    stepRun(run, 1 / 60, still);
    const elite = run.enemies.find((e) => e.elite);
    expect(elite).toBeTruthy();
    expect(elite!.maxHp).toBeGreaterThan(30);
    killFully(run, elite!);
    expect(run.chests.length).toBe(1);
  });

  it('a chest gives a ready evolution first, else a rank', () => {
    const run = createRun(82, 'archer');
    run.skills = [{ id: 'multishot', rank: 5, cooldown: 0 }, { id: 'arrowRain', rank: 2, cooldown: 0 }];
    run.cards = { amount: 1 };
    openChest(run, run.hero.pos);
    expect(run.skills[0]!.evolved).toBe(true);
    openChest(run, run.hero.pos);
    expect(run.skills[1]!.rank).toBe(3);
  });

  it('a herb heals over time; an altar sells a card for gold', () => {
    const run = createRun(83, 'mage');
    run.spawnTimer = 1e9;
    run.hero.hp = 10;
    run.herbs = [{ pos: { x: run.hero.pos.x + 5, y: run.hero.pos.y } }];
    for (let i = 0; i < 120; i++) stepRun(run, 1 / 60, still);
    expect(run.hero.hp).toBeGreaterThan(20);
    run.altars = [{ pos: { x: run.hero.pos.x, y: run.hero.pos.y } }];
    run.skills = [{ id: 'fireball', rank: 1, cooldown: 0 }];
    expect(useAltar(run)).toBe(false);
    run.gold = 100;
    const price = altarPrice(run);
    expect(useAltar(run)).toBe(true);
    expect(run.gold).toBe(100 - price);
    expect(run.offer).not.toBeNull();
    expect(altarPrice(run)).toBeGreaterThan(price);
  });

  it('standing by a shrine gives its buff', () => {
    const run = createRun(84, 'warrior');
    run.spawnTimer = 1e9;
    run.shrines = [{ kind: 'speed', pos: { x: run.hero.pos.x, y: run.hero.pos.y }, charge: 0, rest: 0 }];
    const speed = heroStats(run).speed;
    for (let i = 0; i < 120; i++) stepRun(run, 1 / 60, still);
    expect(run.hero.shrine?.kind).toBe('speed');
    expect(heroStats(run).speed).toBeGreaterThan(speed);
  });

  it('shrines stand far apart; herbs are many', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = createRun(seed, 'warrior');
      const s = run.shrines;
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) expect(Math.hypot(s[i]!.pos.x - s[j]!.pos.x, s[i]!.pos.y - s[j]!.pos.y)).toBeGreaterThanOrEqual(REWORK_PICKUPS.shrineApart);
      }
      expect(run.herbs.length).toBeGreaterThan(REWORK_PICKUPS.herbs * 0.8);
    }
  });
});

describe('rework weather spirit (20.10)', () => {
  it('comes at its time, thickens the fog; killed, the fog goes', () => {
    const run = createRun(91, 'mage');
    run.hero.immortal = true;
    run.spawnTimer = 1e9;
    run.time = REWORK_SPIRIT.appearAt;
    stepRun(run, 1 / 60, still);
    const spirit = run.enemies.find((e) => e.def === 'spirit');
    expect(spirit).toBeTruthy();
    for (let i = 0; i < 60 * 25; i++) {
      stepRun(run, 1 / 60, still);
      run.hero.attackTimer = 1e9;
    }
    expect(run.fog).toBeGreaterThan(0.1);
    expect(sightRadius(run.fog)).toBeLessThan(sightRadius(0));
    killFully(run, spirit!);
    for (let i = 0; i < 60 * 5; i++) stepRun(run, 1 / 60, still);
    expect(run.fog).toBeLessThan(0.05);
  });

  it('low on HP it runs, but not far, and stays on the field', () => {
    const run = createRun(92, 'mage');
    run.hero.immortal = true;
    run.spawnTimer = 1e9;
    run.time = REWORK_SPIRIT.appearAt;
    stepRun(run, 1 / 60, still);
    const spirit = run.enemies.find((e) => e.def === 'spirit')!;
    spirit.hp = spirit.maxHp * REWORK_SPIRIT.fleeAt * 0.5;
    // It comes from beyond the screen's edge: once near, it stays within reach.
    for (let i = 0; i < 60 * 25; i++) {
      stepRun(run, 1 / 60, still);
      run.hero.attackTimer = 1e9;
      const d = Math.hypot(spirit.pos.x - run.hero.pos.x, spirit.pos.y - run.hero.pos.y);
      if (i > 60 * 10) expect(d).toBeLessThan(REWORK_SPIRIT.fleeKeep + 80);
      expect(spirit.pos.x).toBeGreaterThanOrEqual(REWORK_SPIRIT.edge);
      expect(spirit.pos.y).toBeLessThanOrEqual(run.height - REWORK_SPIRIT.edge);
    }
  });
});

describe('rework task (20.11)', () => {
  it('dens destroyed: a chest and the boss calls no wolves', () => {
    const run = createRun(101, 'warrior');
    run.spawnTimer = 1e9;
    startTask(run, 'nests');
    expect(run.task!.dens.length).toBe(REWORK_TASKS.nests.count);
    for (const e of run.enemies.filter((x) => x.def === 'nest')) killFully(run, e);
    stepRun(run, 1 / 60, still);
    expect(run.task!.state).toBe('done');
    expect(run.noHowl).toBe(true);
    expect(run.chests.length).toBe(1);
  });

  it('the lumberjack follows the hero and is saved at the edge', () => {
    const run = createRun(102, 'warrior');
    run.spawnTimer = 1e9;
    run.hero.immortal = true;
    const t = startTask(run, 'rescue');
    run.hero.pos = { x: t.man.x + 30, y: t.man.y };
    stepRun(run, 1 / 60, still);
    expect(t.following).toBe(true);
    run.hero.pos = { x: t.exit.x, y: t.exit.y };
    for (let i = 0; i < 60 * 20 && t.state === 'active'; i++) stepRun(run, 1 / 60, still);
    expect(t.state).toBe('done');
  });

  it('time runs out: failed, nothing lost', () => {
    const run = createRun(103, 'warrior');
    run.spawnTimer = 1e9;
    run.hero.immortal = true;
    startTask(run, 'nests');
    for (let i = 0; i < 60 * (REWORK_TASKS.duration + 1); i++) {
      stepRun(run, 1 / 60, still);
      while (run.offer) chooseCard(run, 0);
    }
    expect(run.task!.state).toBe('failed');
    expect(run.noHowl).toBe(false);
  });
});

describe('rework boss and ring (20.12–20.13)', () => {
  it('a warning, then the beasts stand in a ring and the boss comes', () => {
    const run = createRun(111, 'warrior');
    run.hero.immortal = true;
    stressSpawn(run, 20);
    run.time = REWORK_BOSS.warnAt;
    stepRun(run, 1 / 60, still);
    expect(run.phase).toBe('warning');
    run.time = REWORK_BOSS.warnAt + REWORK_BOSS.warnTime;
    stepRun(run, 1 / 60, still);
    expect(run.phase).toBe('ring');
    expect(run.enemies.some((e) => e.boss)).toBe(true);
    expect(run.enemies.filter((e) => e.act.kind === 'ring').length).toBeGreaterThanOrEqual(REWORK_BOSS.ringMin);
    const count = run.enemies.length;
    for (let i = 0; i < 60 * 3; i++) {
      stepRun(run, 1 / 60, still);
      while (run.offer) chooseCard(run, 0);
    }
    // No more beasts come during the duel.
    expect(run.enemies.length).toBeLessThanOrEqual(count);
  });

  it('the beasts of the ring are a wall: not hurt by the hero', () => {
    const run = createRun(114, 'warrior');
    run.hero.immortal = true;
    stressSpawn(run, 40);
    formRing(run);
    const ring = run.enemies.filter((e) => e.act.kind === 'ring');
    const hp = ring[0]!.hp;
    damageEnemyHit(run, ring[0]!, 9999);
    expect(ring[0]!.hp).toBe(hp);
    expect(ring[0]!.dead).toBe(false);
  });

  it('the ring is a wall: the hero stays inside', () => {
    const run = createRun(112, 'archer');
    run.hero.immortal = true;
    formRing(run);
    for (let i = 0; i < 60 * 4; i++) {
      stepRun(run, 1 / 60, { x: 1, y: 0 });
      while (run.offer) chooseCard(run, 0);
    }
    expect(outsideRing(run, run.hero.pos, 0)).toBe(false);
  });

  it('the boss dashes and leaps; his death wins the location', () => {
    const run = createRun(113, 'warrior');
    run.hero.immortal = true;
    formRing(run);
    const boss = run.enemies.find((e) => e.boss)!;
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 30; i++) {
      stepRun(run, 1 / 60, still);
      while (run.offer) chooseCard(run, 0);
      seen.add(boss.act.kind);
      run.hero.attackTimer = 1e9;
    }
    expect(seen.has('dashWind') || seen.has('leapWind')).toBe(true);
    killFully(run, boss);
    expect(run.phase).toBe('won');
  });
});

/** Hits a beast until it dies (a shield or a resting boss take less). */
function killFully(run: ReturnType<typeof createRun>, e: Parameters<typeof damageEnemyHit>[1]): void {
  for (let i = 0; i < 50 && !e.dead; i++) damageEnemyHit(run, e, 1e6);
}
