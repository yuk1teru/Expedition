// The rework's core (ROADMAP 20.2–20.5): rules, not numbers — the numbers live in
// src/data/rework.ts and change in play.
import { describe, expect, it } from 'vitest';
import { PASSIVE_SLOTS, REWORK_BOSS, REWORK_CARDS, REWORK_ELITES, REWORK_ENEMIES, REWORK_FLOOD, REWORK_LIVES, REWORK_LOCATIONS, REWORK_MAP, REWORK_PICKUPS, REWORK_PROGRESS, REWORK_SPIRIT, REWORK_TASKS } from '../src/data/rework';
import { damageEnemy as damageEnemyHit, damageHero } from '../src/systems/rework/combat';
import { layWeb, pickBeast, powerAt, spawnBeast, spawnInterval } from '../src/systems/rework/enemies';
import { dodge, heroStats } from '../src/systems/rework/hero';
import { buildGrid, isFree, resolveBody } from '../src/systems/rework/map';
import { chooseCard, gainXp, reroll, rerollPrice, xpToNext } from '../src/systems/rework/progress';
import { createRun, runPaused, stepRun, stressSpawn } from '../src/systems/rework/run';
import { castSkill, effectiveParams, evolutionReady } from '../src/systems/rework/skills';
import { formRing, outsideRing } from '../src/systems/rework/boss';
import { altarPrice, openChest, useAltar } from '../src/systems/rework/pickups';
import { startTask } from '../src/systems/rework/task';
import { loseLife, newExpedition, reachCheckpoint } from '../src/systems/rework/expedition';
import { sightRadius } from '../src/systems/rework/spirit';
import { pullSegments } from '../src/systems/rework/spinner';
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
    run.gems.push({ pos: { x: run.hero.pos.x + REWORK_PROGRESS.magnet + 40, y: run.hero.pos.y }, xp: 1, pulled: false });
    // It flies for a moment (seen), not snapped up at once.
    stepRun(run, 1 / 60, still);
    expect(run.gems.length).toBe(2);
    for (let i = 0; i < 60; i++) stepRun(run, 1 / 60, still);
    expect(run.gems.length).toBe(1);
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

  it('the way out is far from the lumberjack, on the field edge', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const run = createRun(seed, 'mage');
      const t = startTask(run, 'rescue');
      expect(Math.hypot(t.exit.x - t.man.x, t.exit.y - t.man.y)).toBeGreaterThanOrEqual(REWORK_TASKS.rescue.exitDistance[0]);
      const onEdge = t.exit.x <= 60 || t.exit.y <= 60 || t.exit.x >= run.width - 60 || t.exit.y >= run.height - 60;
      expect(onEdge).toBe(true);
    }
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

describe('rework second location and the spinner (20.14)', () => {
  it('after the boss a path at the edge leads on; the hero keeps level, skills, passives and gold', () => {
    const run = createRun(141, 'warrior');
    run.hero.immortal = true;
    run.spawnTimer = 1e9;
    run.time = REWORK_BOSS.warnAt + REWORK_BOSS.warnTime;
    stepRun(run, 1 / 60, still);
    const boss = run.enemies.find((e) => e.boss)!;
    expect(boss.def).toBe('alpha');
    run.level = 9;
    run.gold = 77;
    run.skills = [{ id: 'whirlwind', rank: 3, cooldown: 5 }];
    run.cards = { area: 2 };
    killFully(run, boss);
    stepRun(run, 1 / 60, still);
    expect(run.phase).toBe('won');
    expect(run.path).not.toBeNull();
    run.hero.pos = { ...run.path! };
    run.offer = null;
    stepRun(run, 1 / 60, still);
    expect(run.location).toBe(1);
    expect(run.phase).toBe('flood');
    expect(run.time).toBe(0);
    expect(run.level).toBeGreaterThanOrEqual(9);
    expect(run.gold).toBeGreaterThanOrEqual(77);
    expect(run.skills[0]!.rank).toBe(3);
    expect(run.cards.area).toBe(2);
    expect(run.obstacles.some((o) => o.webbed)).toBe(true);
  });

  it('the deeper forest: denser, stronger beasts, spiders, two tasks one after another', () => {
    const first = createRun(142, 'mage');
    const deep = createRun(142, 'mage', 1);
    expect(deep.obstacles.length).toBeGreaterThan(first.obstacles.length);
    const a = spawnBeast(first, 'wolf')!;
    const b = spawnBeast(deep, 'wolf')!;
    expect(b.maxHp).toBeGreaterThan(a.maxHp);
    deep.time = 120;
    const kinds = new Set(Array.from({ length: 60 }, () => pickBeast(deep)));
    expect(kinds.has('spider')).toBe(true);
    deep.hero.immortal = true;
    deep.spawnTimer = 1e9;
    deep.time = REWORK_LOCATIONS[1]!.tasks[0]!.at;
    stepRun(deep, 1 / 60, still);
    const one = deep.task!.kind;
    expect(['webs', 'rescue']).toContain(one);
    deep.task!.time = 0;
    stepRun(deep, 1 / 60, still);
    deep.time = REWORK_LOCATIONS[1]!.tasks[1]!.at;
    stepRun(deep, 1 / 60, still);
    expect(deep.task!.kind).not.toBe(one);
    expect(deep.tasksGiven).toBe(2);
  });

  it('cocoons hatch spiders; destroyed, the spinner calls no spiderlings', () => {
    const run = createRun(143, 'archer', 1);
    run.hero.immortal = true;
    run.spawnTimer = 1e9;
    run.task = null;
    startTask(run, 'webs');
    const cocoons = run.enemies.filter((e) => e.def === 'cocoon');
    expect(cocoons.length).toBe(REWORK_TASKS.webs.count);
    for (const c of cocoons) killFully(run, c);
    stepRun(run, 1 / 60, still);
    expect(run.task!.state).toBe('done');
    expect(run.noBrood).toBe(true);
  });

  it("a spider's web on the ground slows the hero", () => {
    const run = createRun(144, 'warrior', 1);
    run.spawnTimer = 1e9;
    layWeb(run, run.hero.pos);
    stepRun(run, 1 / 60, still);
    expect(run.hero.slow).toBeLessThan(1);
    run.webs = [];
    stepRun(run, 1 / 60, still);
    expect(run.hero.slow).toBe(1);
  });

  it('the spinner: her cocoon wraps the hero (a dodge breaks free), the pull hurts, then she stands open', () => {
    const run = createRun(145, 'warrior', 1);
    run.spawnTimer = 1e9;
    run.time = REWORK_BOSS.warnAt + REWORK_BOSS.warnTime;
    stepRun(run, 1 / 60, still);
    const boss = run.enemies.find((e) => e.boss)!;
    expect(boss.def).toBe('spinner');
    run.hero.invuln = 0;
    // A cocoon hits.
    run.shots.push({ pos: { ...run.hero.pos }, vel: { x: 0, y: 0 }, radius: 10, damage: 0, life: 1, byHero: false, kind: 'cocoon', pierce: 0, hit: [] });
    stepRun(run, 1 / 60, still);
    expect(run.hero.root).toBeGreaterThan(0);
    run.hero.dodgeTimer = 0;
    expect(dodge(run, { x: 1, y: 0 })).toBe(true);
    expect(run.hero.root).toBe(0);
    // The pull closes on a hero who stays: it hurts; then the threads tear and she rests.
    run.hero.dash = null;
    run.hero.invuln = 0;
    run.threads = [{ a: { x: 0, y: 0 }, b: { x: 1, y: 1 }, warn: 0 }];
    run.pull = { center: { ...run.hero.pos }, time: 0, base: 0, gaps: [0], hit: false };
    const hp = run.hero.hp;
    for (let i = 0; i < 60 * 2 && run.pull; i++) stepRun(run, 1 / 60, still);
    expect(run.hero.hp).toBeLessThan(hp);
    expect(run.pull).toBeNull();
    expect(run.threads.length).toBe(0);
    expect(boss.act.kind).toBe('rest');
  });

  it('with the lumberjack saved the pull has two clear gaps', () => {
    const run = createRun(146, 'mage', 1);
    run.spawnTimer = 1e9;
    run.rescued = true;
    run.time = REWORK_BOSS.warnAt + REWORK_BOSS.warnTime;
    stepRun(run, 1 / 60, still);
    const boss = run.enemies.find((e) => e.boss)!;
    boss.traitTimer = 0;
    for (let i = 0; i < 60 && !run.pull; i++) stepRun(run, 1 / 60, still);
    expect(run.pull?.gaps.length).toBe(2);
    expect(pullSegments(run).length).toBe(REWORK_BOSS.spinner.pull.segments - 2);
  });
});

describe('rework lair and the Old Enat (20.15)', () => {
  const lairBoss = (seed: number): { run: ReturnType<typeof createRun>; enat: ReturnType<typeof createRun>['enemies'][number] } => {
    const run = createRun(seed, 'warrior', 2);
    run.spawnTimer = 1e9;
    run.time = REWORK_LOCATIONS[2]!.bossAt + REWORK_BOSS.warnTime;
    stepRun(run, 1 / 60, still);
    const enat = run.enemies.find((e) => e.boss)!;
    return { run, enat };
  };

  it('the path after the spinner leads to the lair; its ghost asks for help; the boss comes at 1:30', () => {
    const run = createRun(151, 'archer', 1);
    run.phase = 'won';
    stepRun(run, 1 / 60, still);
    expect(run.path).not.toBeNull();
    run.hero.pos = { ...run.path! };
    stepRun(run, 1 / 60, still);
    expect(run.location).toBe(2);
    expect(run.ghost).toBeGreaterThan(0);
    const { run: lair, enat } = lairBoss(152);
    expect(enat.def).toBe('enat');
    expect(lair.phase).toBe('ring');
  });

  it('he stands; roots burst under the hero and hurt', () => {
    const { run, enat } = lairBoss(153);
    const at = { ...enat.pos };
    run.hero.invuln = 0;
    run.hero.pos = { x: enat.pos.x + 120, y: enat.pos.y + 100 };
    enat.moveTimer = 0;
    const hp = run.hero.hp;
    for (let i = 0; i < 60 * 2; i++) stepRun(run, 1 / 60, still);
    expect(run.hero.hp).toBeLessThan(hp);
    expect(Math.hypot(enat.pos.x - at.x, enat.pos.y - at.y)).toBeLessThan(1);
  });

  it('the combo: the branch catches and pulls the hero in; a dodge in the charge breaks free', () => {
    const { run, enat } = lairBoss(154);
    run.hero.pos = { x: enat.pos.x + 200, y: enat.pos.y + 120 };
    enat.moveTimer = 1e9;
    enat.howlTimer = 1e9;
    enat.shots = 1e9;
    enat.traitTimer = 0;
    for (let i = 0; i < 120 && enat.act.kind !== 'charge'; i++) stepRun(run, 1 / 60, still);
    expect(enat.act.kind).toBe('charge');
    expect(Math.hypot(run.hero.pos.x - enat.pos.x, run.hero.pos.y - enat.pos.y)).toBeLessThan(enat.radius + 40);
    expect(run.hero.root).toBeGreaterThan(0);
    run.hero.dodgeTimer = 0;
    expect(dodge(run, { x: 0, y: 1 })).toBe(true);
    expect(run.hero.root).toBe(0);
  });

  it('phase 2 turns the forest to stone and sends thorns; phase 3 gives the shade and more damage taken', () => {
    const { run, enat } = lairBoss(155);
    run.hero.immortal = true;
    const stones = run.obstacles.length;
    enat.hp = enat.maxHp * 0.5;
    stepRun(run, 1 / 60, still);
    expect(run.bossPhase).toBe(1);
    expect(run.obstacles.length).toBeGreaterThan(stones);
    enat.traitTimer = 0;
    enat.shots = 0;
    stepRun(run, 1 / 60, still);
    expect(run.hazards.filter((z) => z.kind === 'thorn').length).toBe(8);
    enat.hp = enat.maxHp * 0.2;
    stepRun(run, 1 / 60, still);
    expect(run.bossPhase).toBe(2);
    expect(run.shade).not.toBeNull();
    const before = enat.hp;
    damageEnemyHit(run, enat, 100);
    expect(before - enat.hp).toBeCloseTo(100 * REWORK_BOSS.enat.sapTake);
  });

  it('thorns do not hurt in the shade; his death ends the biome', () => {
    const { run, enat } = lairBoss(156);
    enat.hp = enat.maxHp * 0.2;
    stepRun(run, 1 / 60, still);
    run.hero.invuln = 0;
    run.hero.pos = { ...run.shade!.pos };
    run.shade!.to = { ...run.shade!.pos };
    run.hazards = [{ kind: 'thorn', pos: { x: run.hero.pos.x - 100, y: run.hero.pos.y }, dir: { x: 1, y: 0 }, length: 300, radius: 26, delay: 0, warn: 0.01, total: 0.01, damage: 30, shadeSafe: true, after: 0.3, struck: false }];
    const hp = run.hero.hp;
    stepRun(run, 1 / 60, still);
    expect(run.hero.hp).toBe(hp);
    killFully(run, enat);
    stepRun(run, 1 / 60, still);
    expect(run.phase).toBe('won');
    expect(run.path).toBeNull();
  });
});

describe('rework biome structure (20.16)', () => {
  it('a death costs a sign and says her words; with none left — back to the checkpoint and a tombstone', () => {
    const exp = newExpedition('mage');
    expect(exp.lives).toBe(REWORK_LIVES.max);
    const first = loseLife(exp);
    expect(first).toEqual({ line: REWORK_LIVES.death[0], lives: 2, rollback: false });
    const second = loseLife(exp);
    expect(second).toEqual({ line: REWORK_LIVES.death[1], lives: 1, rollback: false });
    const last = loseLife(exp);
    expect(last.rollback).toBe(true);
    expect(last.line).toBe(REWORK_LIVES.lost);
    expect(exp.tombstones).toBe(1);
    expect(exp.lives).toBe(REWORK_LIVES.max);
  });

  it('beating the biome boss is a checkpoint: the signs come back', () => {
    const exp = newExpedition('warrior');
    loseLife(exp);
    loseLife(exp);
    expect(reachCheckpoint(exp)).toBe(REWORK_LIVES.checkpoint);
    expect(exp.lives).toBe(REWORK_LIVES.max);
    expect(exp.checkpoint).toBe('forest');
  });
});

describe('rework wolves (pack)', () => {
  it('wolves differ: the timid never leap, the pack never leaps all at once', () => {
    const run = createRun(171, 'warrior');
    run.spawnTimer = 1e9;
    run.hero.immortal = true;
    run.hero.attackTimer = 1e9;
    const L = REWORK_ENEMIES.wolf.leap!;
    const wolves = Array.from({ length: 14 }, (_, i) => {
      const w = spawnBeast(run, 'wolf')!;
      const a = (i / 14) * Math.PI * 2;
      w.pos = { x: run.hero.pos.x + Math.cos(a) * 160, y: run.hero.pos.y + Math.sin(a) * 160 };
      return w;
    });
    expect(new Set(wolves.map((w) => w.temper!.toFixed(2))).size).toBeGreaterThan(5);
    const leapt = new Set<number>();
    let most = 0;
    for (let i = 0; i < 60 * 15; i++) {
      stepRun(run, 1 / 60, still);
      run.hero.attackTimer = 1e9;
      const busy = run.enemies.filter((e) => e.act.kind === 'crouch' || e.act.kind === 'leap');
      most = Math.max(most, busy.length);
      for (const e of busy) leapt.add(e.id);
    }
    expect(most).toBeLessThanOrEqual(L.atOnce);
    for (const w of wolves) if (w.temper! < L.timid) expect(leapt.has(w.id)).toBe(false);
    expect(leapt.size).toBeGreaterThan(0);
  });
});

describe('rework aiming on screen', () => {
  it('ranged heroes do not shoot beasts the player cannot see', () => {
    for (const cls of ['archer', 'mage'] as const) {
      const run = createRun(181, cls);
      run.spawnTimer = 1e9;
      run.hero.immortal = true;
      const off = spawnBeast(run, 'wolf')!;
      // In reach, but below the screen's bottom edge.
      off.pos = { x: run.hero.pos.x, y: run.hero.pos.y + 300 };
      off.traitTimer = 1e9;
      run.hero.attackTimer = 0;
      stepRun(run, 1 / 60, still);
      expect(run.shots.filter((s) => s.byHero).length).toBe(0);
      off.pos = { x: run.hero.pos.x + 200, y: run.hero.pos.y };
      run.hero.attackTimer = 0;
      // The archer draws the bow first.
      let shot = false;
      for (let i = 0; i < 20 && !shot; i++) {
        stepRun(run, 1 / 60, still);
        shot = run.shots.some((s) => s.byHero);
      }
      expect(shot).toBe(true);
    }
  });
});
describe('rework archer draw', () => {
  it('the arrow leaves after the bow is drawn, not at once', () => {
    const run = createRun(183, 'archer');
    run.spawnTimer = 1e9;
    run.hero.immortal = true;
    const w = spawnBeast(run, 'wolf')!;
    w.pos = { x: run.hero.pos.x + 200, y: run.hero.pos.y };
    w.traitTimer = 1e9;
    run.hero.attackTimer = 0;
    stepRun(run, 1 / 60, still);
    expect(run.hero.draw).not.toBeNull();
    expect(run.shots.filter((s) => s.byHero).length).toBe(0);
    for (let i = 0; i < 20; i++) stepRun(run, 1 / 60, still);
    expect(run.shots.filter((s) => s.byHero).length).toBe(1);
  });
});


describe('rework dens and shooters', () => {
  it('the hero cannot push a den', () => {
    const run = createRun(191, 'warrior');
    run.spawnTimer = 1e9;
    run.hero.immortal = true;
    const den = spawnBeast(run, 'nest')!;
    den.pos = { x: run.hero.pos.x + 60, y: run.hero.pos.y };
    const at = { ...den.pos };
    for (let i = 0; i < 60; i++) stepRun(run, 1 / 60, { x: 1, y: 0 });
    expect(Math.hypot(den.pos.x - at.x, den.pos.y - at.y)).toBeLessThan(0.5);
  });

  it('mushrooms are few: capped alive, plain ones never spit a fan', () => {
    const run = createRun(192, 'warrior');
    run.time = 200;
    for (let i = 0; i < 400; i++) {
      const id = pickBeast(run);
      if (id === 'mushroom') spawnBeast(run, 'mushroom');
    }
    expect(run.enemies.filter((e) => e.def === 'mushroom').length).toBeLessThanOrEqual(REWORK_ENEMIES.mushroom.maxAlive!);
    run.hero.immortal = true;
    run.spawnTimer = 1e9;
    for (let i = 0; i < 60 * 12; i++) {
      stepRun(run, 1 / 60, still);
      run.hero.attackTimer = 1e9;
      for (const e of run.enemies) if (e.act.kind === 'aim') expect(e.act.fan).toBe(false);
    }
  });
});

describe('rework beasts go round obstacles', () => {
  it('a beast with a stone between it and the hero walks round it and comes close', () => {
    for (const def of ['wolf', 'mushroom', 'stump'] as const) {
      const run = createRun(201, 'warrior');
      run.spawnTimer = 1e9;
      run.hero.immortal = true;
      run.hero.attackTimer = 1e9;
      const h = run.hero.pos;
      // A big stone right on the way, nothing else near.
      run.obstacles = [{ kind: 'stone', pos: { x: h.x - 150, y: h.y }, radius: 30, height: 0, seed: 0.5 }];
      run.grid = buildGrid(run.obstacles);
      const b = spawnBeast(run, def)!;
      b.pos = { x: h.x - 300, y: h.y };
      b.traitTimer = 1e9;
      for (let i = 0; i < 60 * 8; i++) {
        stepRun(run, 1 / 60, still);
        run.hero.attackTimer = 1e9;
      }
      // The mushroom keeps its distance; the others come to bite.
      const d = Math.hypot(b.pos.x - h.x, b.pos.y - h.y);
      expect(d).toBeLessThan(def === 'mushroom' ? REWORK_ENEMIES.mushroom.spit!.keep + 40 : 60);
    }
  });
});

/** Hits a beast until it dies (a shield or a resting boss take less). */
function killFully(run: ReturnType<typeof createRun>, e: Parameters<typeof damageEnemyHit>[1]): void {
  for (let i = 0; i < 50 && !e.dead; i++) damageEnemyHit(run, e, 1e6);
}
