import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { OBJECTIVES } from '../src/data/objectives';
import { createBattle, stepBattle } from '../src/systems/battle';
import { killEnemy } from '../src/systems/combat';
import { planFor } from '../src/systems/expedition';
import { createGameState, teleport } from '../src/systems/run';

function arena(goal: 'nests' | 'rescue') {
  const s = createGameState(7);
  s.hero.immortal = true;
  teleport(s, 'quietGrove');
  const b = createBattle(s, 'quietGrove', 2, false, { waves: 1, miniboss: false, boss: false, objective: goal });
  return { s, b };
}

const run = (b: ReturnType<typeof arena>['b'], seconds: number) => {
  for (let t = 0; t < seconds && !b.finished; t += LOOP.step) stepBattle(b, LOOP.step);
};

describe('arena objectives', () => {
  it('nests: no waves; the nests stand still and hatch monsters until broken; all broken and beaten — won', () => {
    const { b } = arena('nests');
    expect(b.waves).toBeNull();
    const nests = b.enemies.filter((e) => e.nest);
    expect(nests).toHaveLength(OBJECTIVES.nests.count);
    const at = nests.map((n) => ({ ...n.pos }));
    // Keep the hero away: the nests must not move.
    run(b, OBJECTIVES.nests.firstHatch + OBJECTIVES.nests.hatchEvery + 0.5);
    nests.forEach((n, i) => expect(Math.hypot(n.pos.x - at[i]!.x, n.pos.y - at[i]!.y)).toBeLessThan(1));
    expect(b.enemies.some((e) => !e.nest && !e.dead)).toBe(true);
    expect(b.outcome).toBe('running');
    for (const n of nests) killEnemy(b, n);
    run(b, 0.1);
    expect(b.outcome).toBe('running');
    for (const e of b.enemies) if (!e.dead) killEnemy(b, e);
    run(b, 0.1);
    expect(b.outcome).toBe('won');
  });

  it('nests stop hatching while the arena is full', () => {
    const { b } = arena('nests');
    run(b, 60);
    const alive = b.enemies.filter((e) => !e.dead && !e.nest).length;
    expect(alive).toBeLessThanOrEqual(OBJECTIVES.nests.maxAlive + OBJECTIVES.nests.count);
  });

  it('rescue: only time next to the captive counts; held long enough — won', () => {
    const { b } = arena('rescue');
    const o = b.objective!;
    // Far from the captive: nothing.
    b.hero.pos = { x: o.spot.x + OBJECTIVES.rescue.radius * 3, y: o.spot.y };
    b.hero.immortal = true;
    stepBattle(b, LOOP.step);
    expect(o.held).toBe(0);
    // Next to the captive (pinned there).
    let t = 0;
    for (; t < OBJECTIVES.rescue.time + 2 && b.outcome === 'running'; t += LOOP.step) {
      b.hero.pos = { ...o.spot };
      stepBattle(b, LOOP.step);
    }
    expect(b.outcome).toBe('won');
    expect(t).toBeGreaterThanOrEqual(OBJECTIVES.rescue.time - LOOP.step * 2);
  });

  it('the bot goes to the captive by itself', () => {
    const { b } = arena('rescue');
    run(b, OBJECTIVES.rescue.time * 3);
    expect(b.outcome).toBe('won');
  });

  it('a fork offers two different kinds; an objective arena always has its goal', () => {
    const s = createGameState(3);
    for (let i = 0; i < 30; i++) {
      const fork = planFor(s, 'quietGrove')[1] as { kind: string; goal?: string }[];
      expect(fork[0]!.kind).not.toBe(fork[1]!.kind);
      for (const f of fork) if (f.kind === 'objective') expect(f.goal).toBeTruthy();
    }
  });
});
