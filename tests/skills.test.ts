import { describe, expect, it } from 'vitest';
import { RANKS } from '../src/data/balance';
import { PASSIVES, SKILLS, rankChanges, skillParams } from '../src/data/skills';
import { killEnemy } from '../src/systems/combat';
import { dist } from '../src/systems/entities';
import { createBattle, stepBattle } from '../src/systems/battle';
import { createBossEnemy } from '../src/systems/boss';
import { assignClass, recomputeHeroStats } from '../src/systems/hero';
import { SLICE_GROVE_ID } from '../src/systems/mapgen';
import { createGameState, teleport } from '../src/systems/run';
import { useSkill } from '../src/systems/skills';
import { spawnEnemy } from '../src/systems/waves';

function battle(skills: string[]) {
  const s = createGameState(3);
  s.hero.immortal = true;
  s.hero.level = 3;
  assignClass(s.hero, 'warrior', skills);
  teleport(s, SLICE_GROVE_ID);
  const b = createBattle(s, SLICE_GROVE_ID);
  b.waves = null;
  return b;
}

describe('skill ranks', () => {
  it('every skill has RANKS.max ranks, every upgrade changes something and is described', () => {
    for (const def of Object.values(SKILLS)) {
      expect(def.ranks).toHaveLength(RANKS.max);
      for (let r = 2; r <= RANKS.max; r++) {
        expect(skillParams(def.id, r)).not.toEqual(skillParams(def.id, r - 1));
        expect(rankChanges(def.id, r).length).toBeGreaterThan(0);
      }
    }
  });

  it('Hook stuns pulled enemies already at rank 1', () => {
    const b = battle(['hook', 'whirlwind', 'charge']);
    const stump = spawnEnemy(b, 'stump', { x: b.hero.pos.x + 200, y: b.hero.pos.y });
    b.input.aim = { ...stump.pos };
    expect(useSkill(b, 0)).toBe('cast');
    expect(stump.dead).toBe(false);
    expect(stump.statuses.stun?.time ?? 0).toBeGreaterThan(0);
  });

  it('Hook yanks enemies right next to the hero fast, whatever their mass', () => {
    const b = battle(['hook', 'whirlwind', 'charge']);
    const stump = spawnEnemy(b, 'stump', { x: b.hero.pos.x + 280, y: b.hero.pos.y });
    stump.hp = stump.maxHp = 1e6;
    b.input.aim = { ...stump.pos };
    useSkill(b, 0);
    for (let t = 0; t < 0.25; t += 1 / 60) stepBattle(b, 1 / 60);
    expect(dist(stump.pos, b.hero.pos)).toBeLessThan(b.hero.radius + stump.radius + 12);
  });

  it('Battle Fervor: every kill takes time off all skill cooldowns', () => {
    const b = battle(['whirlwind', 'charge', 'hook']);
    b.hero.passives.fervor = 2;
    recomputeHeroStats(b.hero);
    for (const sk of b.hero.skills) sk.cooldown = 5;
    killEnemy(b, spawnEnemy(b, 'wolf', { x: 100, y: 100 }));
    for (const sk of b.hero.skills) expect(sk.cooldown).toBeCloseTo(5 - 2 * PASSIVES.fervor!.value);
  });

  it('Charge is blocked while the hero is rooted by a trap', () => {
    const b = battle(['charge', 'whirlwind', 'hook']);
    spawnEnemy(b, 'wolf', { x: b.hero.pos.x + 150, y: b.hero.pos.y });
    b.hero.statuses.root = { time: 1, value: 0 };
    expect(useSkill(b, 0)).toBe('busy');
    expect(b.hero.skills[0]!.cooldown).toBe(0);
  });

  it('Earthquake is smaller than before the rebalance and slows less', () => {
    const p = skillParams('earthquake', 1);
    expect(p.radius).toBeLessThanOrEqual(110);
    expect(p.slow).toBeLessThanOrEqual(0.25);
  });
});

describe('miniboss combos', () => {
  it('Ватажок sometimes chains lunge and leap without the usual pause', () => {
    let combos = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = createGameState(seed);
      s.hero.immortal = true;
      teleport(s, SLICE_GROVE_ID);
      const b = createBattle(s, SLICE_GROVE_ID);
      b.waves = null;
      createBossEnemy(b, 'alpha', { x: b.hero.pos.x + 250, y: b.hero.pos.y });
      s.events.on('bossCombo', () => combos++);
      // The hero stands still and keeps jumping away, so the miniboss uses its ranged moves.
      b.input.control = 'player';
      let step = 0;
      for (let t = 0; t < 40; t += 1 / 60) {
        if (++step % 120 === 0) b.hero.pos = { x: b.hero.pos.x < 480 ? 760 : 200, y: 250 };
        stepBattle(b, 1 / 60);
      }
    }
    expect(combos).toBeGreaterThan(0);
  });
});
