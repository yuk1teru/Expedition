import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { BIOMES, BIOME_ORDER } from '../src/data/biomes';
import { BOSSES } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { type Battle, createBattle, stepBattle } from '../src/systems/battle';
import { createBossEnemy } from '../src/systems/boss';
import { killEnemy } from '../src/systems/combat';
import { dist } from '../src/systems/entities';
import { addRing } from '../src/systems/hazards';
import { completeBattle, createGameState, teleport } from '../src/systems/run';
import { assignClass } from '../src/systems/hero';
import { CLASSES } from '../src/data/classes';
import { spawnEnemy } from '../src/systems/waves';

/** A battle at the first location of `biome` in the full world; no waves. */
function battleIn(biome: string, boss = false): Battle {
  const s = createGameState(21);
  s.hero.immortal = true;
  const node = s.world.nodes.find((n) => n.biome === biome && (boss ? n.isBoss : n.depth === 1))!;
  teleport(s, node.id);
  const b = createBattle(s, node.id);
  b.waves = null;
  return b;
}

function run(b: Battle, seconds: number): void {
  for (let t = 0; t < seconds && !b.finished; t += LOOP.step) stepBattle(b, LOOP.step);
}

describe('biome content', () => {
  it('every biome has 3 own enemies with a trait, a miniboss and a boss', () => {
    const seen = new Set<string>();
    for (const id of BIOME_ORDER) {
      const biome = BIOMES[id]!;
      expect(biome.enemies).toHaveLength(3);
      for (const e of biome.enemies) {
        expect(ENEMIES[e]?.trait.length).toBeGreaterThan(5);
        expect(seen.has(e)).toBe(false);
        seen.add(e);
      }
      expect(BOSSES[biome.boss]?.miniboss).toBeFalsy();
      expect(BOSSES[biome.boss]?.phase2).toBeDefined();
      expect(BOSSES[biome.miniboss]?.miniboss).toBe(true);
      expect(biome.locationNames).toHaveLength(8);
    }
  });

  it('the boss node of each sector fights its own biome boss', () => {
    for (const id of BIOME_ORDER) {
      const b = battleIn(id, true);
      expect(b.boss?.defId).toBe(BIOMES[id]!.boss);
    }
  });
});

describe('enemy traits', () => {
  it('Scorpion: the bite keeps hurting for 2 s (poison)', () => {
    const b = battleIn('desert');
    b.hero.immortal = false;
    const sc = spawnEnemy(b, 'scorpion', { x: b.hero.pos.x + 20, y: b.hero.pos.y });
    sc.hp = sc.maxHp = 1e6;
    sc.attackTimer = 0;
    run(b, 0.05);
    expect(b.hero.statuses.poison?.time ?? 0).toBeGreaterThan(1);
    sc.dead = true;
    const hp = b.hero.hp;
    run(b, 1);
    expect(b.hero.hp).toBeLessThan(hp);
  });

  it('Scarab and Slime split on death into two small ones that give no gold', () => {
    const b = battleIn('desert');
    killEnemy(b, spawnEnemy(b, 'scarab', { x: 300, y: 200 }));
    const small = b.enemies.filter((e) => e.defId === 'scarabling' && !e.dead);
    expect(small).toHaveLength(2);
    expect(small.every((e) => e.gold === 0)).toBe(true);
    const s = battleIn('swamp');
    killEnemy(s, spawnEnemy(s, 'slime', { x: 300, y: 200 }));
    expect(s.enemies.filter((e) => e.defId === 'slimelet' && !e.dead)).toHaveLength(2);
  });

  it('Snowman snowballs slow; Ice Golem has +20 armor over the Stump', () => {
    const b = battleIn('ice');
    const sm = spawnEnemy(b, 'snowman', { x: b.hero.pos.x + 150, y: b.hero.pos.y });
    sm.hp = sm.maxHp = 1e6;
    sm.attackTimer = 0;
    let slowed = 0;
    for (let t = 0; t < 1.5; t += LOOP.step) {
      stepBattle(b, LOOP.step);
      slowed = Math.max(slowed, b.hero.statuses.slow?.value ?? 0);
    }
    expect(slowed).toBeGreaterThan(0);
    expect(ENEMIES.iceGolem!.armor - ENEMIES.stump!.armor).toBe(20);
  });
});

describe('bosses of Desert, Swamp and Ice', () => {
  for (const biome of ['desert', 'swamp', 'ice']) {
    it(`${biome}: the boss fights for a minute without errors and enters phase 2`, () => {
      const b = battleIn(biome, true);
      const boss = b.boss!;
      let telegraphs = 0;
      b.events.on('telegraphFire', () => telegraphs++);
      run(b, 25);
      boss.hp = boss.maxHp * 0.45;
      run(b, 35);
      expect(boss.boss!.phase).toBe(2);
      expect(telegraphs + b.hazards.length).toBeGreaterThan(0);
    });
  }

  for (const id of ['scorpionKing', 'bigToad', 'frostWarden']) {
    it(`miniboss ${id} uses its moves`, () => {
      const biome = BOSSES[id]!.biome;
      const b = battleIn(biome);
      createBossEnemy(b, id, { x: b.hero.pos.x + 220, y: b.hero.pos.y });
      let moves = 0;
      b.events.on('telegraphFire', () => moves++);
      b.events.on('enemyShot', () => moves++);
      b.events.on('spawn', () => moves++);
      run(b, 20);
      expect(moves).toBeGreaterThan(2);
    });
  }

  it('Sand Worm: untouchable while burrowed, bursts out where the hero stood', () => {
    const b = battleIn('desert', true);
    const worm = b.boss!;
    worm.boss!.attackCooldowns = { burrow: 0, acid: 99, sandstorm: 99 };
    worm.boss!.pause = 0;
    const heroAt = { ...b.hero.pos };
    run(b, 0.1);
    expect(b.enemies.includes(worm)).toBe(false);
    b.hero.pos = { ...heroAt };
    run(b, 1.6);
    expect(b.enemies.includes(worm)).toBe(true);
    expect(dist(worm.pos, heroAt)).toBeLessThan(120);
  });

  it('a ring hits once as it passes the hero, but not through a gap or during invulnerability', () => {
    const b = battleIn('ice');
    b.hero.immortal = false;
    const centre = { x: b.hero.pos.x - 150, y: b.hero.pos.y };
    const hp0 = b.hero.hp;
    addRing(b, 'toxicWave', centre, { speed: 300, width: 24, damage: 10, maxRadius: 600 });
    run(b, 1);
    expect(b.hero.hp).toBeLessThan(hp0);
    const hp1 = b.hero.hp;
    // The gap points straight at the hero.
    addRing(b, 'spikeRing', centre, { speed: 300, width: 24, damage: 10, maxRadius: 600, gaps: [0], gapDeg: 40 });
    run(b, 1);
    expect(b.hero.hp).toBeCloseTo(hp1, 0);
  });

  it('Ice Knight: the cold aura slows the hero in phase 2', () => {
    const b = battleIn('ice', true);
    const k = b.boss!;
    k.boss!.phase = 2;
    k.boss!.attackCooldowns = { ram: 99, spikeRing: 99 };
    b.hero.pos = { x: k.pos.x, y: k.pos.y + 120 };
    run(b, 0.1);
    expect(b.hero.statuses.slow?.value ?? 0).toBeCloseTo(0.25);
  });
});

describe('end of the boss fight', () => {
  it('a boss victory gives an extra card choice and counts towards the 4 bosses', () => {
    const b = battleIn('swamp', true);
    const s = b.state;
    s.hero.level = 6;
    assignClass(s.hero, 'archer', CLASSES.archer!.defaultPicks);
    s.modalQueue = [];
    killEnemy(b, b.boss!);
    run(b, 3);
    expect(b.outcome).toBe('won');
    const summary = completeBattle(s, b);
    expect(summary.isBoss).toBe(true);
    expect(s.modalQueue).toContainEqual({ kind: 'cardChoice', level: s.hero.level, bossReward: true });
    expect(s.bossesDefeated).toHaveLength(1);
    expect(summary.runCompleted).toBe(false);
  });
});
