import { describe, expect, it } from 'vitest';
import { ARENA, LOOP, WAVES } from '../src/data/balance';
import { type Battle, createBattle, killAll, stepBattle } from '../src/systems/battle';
import { SLICE_GROVE_ID } from '../src/systems/mapgen';
import { createGameState, teleport } from '../src/systems/run';
import { dist } from '../src/systems/entities';
import { portalActive, portalInReach, requestPortalEntry, waveSize, waveStatMult } from '../src/systems/waves';

function grove(): { b: Battle } {
  const s = createGameState(21);
  s.hero.immortal = true;
  teleport(s, SLICE_GROVE_ID);
  return { b: createBattle(s, SLICE_GROVE_ID) };
}

/** Clears waves by killing everything until `cleared` waves are done. */
function clearWaves(b: Battle, cleared: number): void {
  for (let t = 0; t < 120 && (b.waves?.cleared ?? 0) < cleared; t += LOOP.step) {
    stepBattle(b, LOOP.step);
    if (b.waves?.started && b.waves.queue.length === 0) killAll(b);
  }
}

describe('waves and portal', () => {
  it('portal opens only after the 3 mandatory waves; miniboss comes in wave 3', () => {
    const { b } = grove();
    clearWaves(b, WAVES.count - 1);
    expect(b.portal).toBeNull();
    let sawMiniboss = false;
    for (let t = 0; t < 120 && (b.waves?.cleared ?? 0) < WAVES.count; t += LOOP.step) {
      stepBattle(b, LOOP.step);
      if (b.enemies.some((e) => e.boss)) sawMiniboss = true;
      if (b.waves?.started && b.waves.queue.length === 0) killAll(b);
    }
    expect(sawMiniboss).toBe(true);
    expect(b.portal).not.toBeNull();
    expect(b.outcome).toBe('running');
  });

  it('bonus waves keep coming and get bigger and stronger', () => {
    const { b } = grove();
    clearWaves(b, WAVES.count);
    for (let t = 0; t < WAVES.bonus.delay + 2; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(b.waves!.index).toBe(WAVES.count);
    expect(b.waves!.statMult).toBeCloseTo(waveStatMult(1));
    expect(waveSize(1, 1)).toBe(waveSize(1, 0) + WAVES.bonus.extraPerWave);
    expect(b.enemies.length).toBeGreaterThan(0);
  });

  it('portal sits at the arena edge; walking into it does nothing, the button works only in reach', () => {
    const { b } = grove();
    clearWaves(b, WAVES.count);
    const portal = b.portal!;
    const edgeGap = Math.min(
      portal.pos.x - ARENA.x,
      ARENA.x + ARENA.w - portal.pos.x,
      portal.pos.y - ARENA.y,
      ARENA.y + ARENA.h - portal.pos.y,
    );
    expect(edgeGap).toBeLessThanOrEqual(WAVES.portal.edgeInset + 1);
    expect(requestPortalEntry(b)).toBe(dist(b.hero.pos, portal.pos) <= portal.radius + b.hero.radius + WAVES.portal.useRange);
    b.portal!.entered = false;
    b.hero.pos = { ...portal.pos };
    b.input.move = { x: 1, y: 0 };
    stepBattle(b, LOOP.step);
    expect(b.outcome).toBe('running');
    expect(portalInReach(b)).toBe(true);
    expect(requestPortalEntry(b)).toBe(true);
    stepBattle(b, LOOP.step);
    expect(b.outcome).toBe('won');
  });

  it('the portal is closed while a bonus wave is running', () => {
    const { b } = grove();
    clearWaves(b, WAVES.count);
    expect(portalActive(b)).toBe(true);
    for (let t = 0; t < WAVES.bonus.delay + 1; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(b.waves!.started).toBe(true);
    expect(portalActive(b)).toBe(false);
    b.hero.pos = { ...b.portal!.pos };
    expect(requestPortalEntry(b)).toBe(false);
  });
});
