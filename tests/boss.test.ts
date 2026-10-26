import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { getBoss } from '../src/data/bosses';
import { createBattle, stepBattle } from '../src/systems/battle';
import { addTelegraph, createBossEnemy } from '../src/systems/boss';
import { damageEnemy } from '../src/systems/combat';
import { SLICE_LAIR_ID } from '../src/systems/mapgen';
import { createGameState, teleport } from '../src/systems/run';

function bossBattle(seed = 1) {
  const s = createGameState(seed, 'slice');
  teleport(s, SLICE_LAIR_ID);
  return { s, b: createBattle(s, SLICE_LAIR_ID) };
}

describe('boss battle', () => {
  it('has the boss and no waves', () => {
    const { b } = bossBattle();
    expect(b.kind).toBe('boss');
    expect(b.waves).toBeNull();
    expect(b.boss?.name).toBe(getBoss('enat').name);
  });

  it('telegraph hits only after the delay and only inside the zone', () => {
    const { s, b } = bossBattle();
    s.hero.immortal = true;
    const hp0 = s.hero.hp;
    b.enemies = []; // isolate from boss attacks
    b.boss = null;
    addTelegraph(b, 'test', s.hero.pos, 60, 20, 0.8);
    addTelegraph(b, 'far', { x: s.hero.pos.x + 300, y: s.hero.pos.y }, 60, 50, 0.8);
    for (let t = 0; t < 0.7; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(s.hero.hp).toBe(hp0);
    for (let t = 0; t < 0.2; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(hp0 - s.hero.hp).toBeCloseTo(20, 0);
  });

  it('enters phase 2 at 50% HP and gets faster', () => {
    const { s, b } = bossBattle();
    s.hero.immortal = true;
    const boss = b.boss!;
    const speed = boss.speed;
    boss.hp = boss.maxHp * 0.49;
    stepBattle(b, LOOP.step);
    expect(boss.boss?.phase).toBe(2);
    expect(boss.speed).toBeCloseTo(speed * getBoss('enat').phase2!.speedMult);
  });

  it('keeps at least the minimal pause between attacks', () => {
    const { s, b } = bossBattle(3);
    s.hero.immortal = true;
    const starts: number[] = [];
    let prev = b.telegraphs.length + b.enemies.length;
    for (let t = 0; t < 30; t += LOOP.step) {
      stepBattle(b, LOOP.step);
      const now = b.telegraphs.length + b.enemies.length;
      if (now > prev) starts.push(b.time);
      prev = now;
    }
    expect(starts.length).toBeGreaterThan(3);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(getBoss('enat').minPause - 1e-6);
    }
  });

  it('bosses and minibosses actually move; the lunge dash finishes', () => {
    const { s, b } = bossBattle();
    s.hero.immortal = true;
    b.input.control = 'player'; // hero stands still
    const enat = b.boss!;
    const alpha = createBossEnemy(b, 'alpha', { x: s.hero.pos.x + 280, y: s.hero.pos.y });
    const e0 = { ...enat.pos };
    const a0 = { ...alpha.pos };
    let dashed = false;
    for (let t = 0; t < 6; t += LOOP.step) {
      stepBattle(b, LOOP.step);
      if (alpha.boss?.dash) dashed = true;
    }
    expect(Math.hypot(enat.pos.x - e0.x, enat.pos.y - e0.y)).toBeGreaterThan(20);
    expect(Math.hypot(alpha.pos.x - a0.x, alpha.pos.y - a0.y)).toBeGreaterThan(60);
    expect(dashed).toBe(true);
    expect(alpha.boss?.dash).toBeNull();
  });

  it('killing the boss wins the battle and clears summons', () => {
    const { s, b } = bossBattle();
    s.hero.immortal = true;
    for (let t = 0; t < 10; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(b.enemies.some((e) => e.summoned)).toBe(true);
    damageEnemy(b, b.boss!, { amount: b.boss!.maxHp * 10, crit: false }, { source: 'skill' });
    stepBattle(b, LOOP.step);
    expect(b.outcome).toBe('won');
    expect(b.enemies.filter((e) => !e.dead)).toHaveLength(0);
  });
});
