import { describe, expect, it } from 'vitest';
import { ARENA, LOOP, WAVES } from '../src/data/balance';
import { type Battle, createBattle, killAll, stepBattle } from '../src/systems/battle';
import { dist } from '../src/systems/entities';
import { SLICE_GROVE_ID } from '../src/systems/mapgen';
import { createGameState, teleport } from '../src/systems/run';
import { isPortalBreak, portalActive, portalInReach, requestPortalEntry, waveSize, waveStatMult } from '../src/systems/waves';

function grove(): { b: Battle } {
  const s = createGameState(21);
  s.hero.immortal = true;
  teleport(s, SLICE_GROVE_ID);
  return { b: createBattle(s, SLICE_GROVE_ID) };
}

/** Runs the battle, killing each wave once spawned, until `cleared` waves are done. */
function clearWaves(b: Battle, cleared: number, onStep?: () => void): void {
  for (let t = 0; t < 600 && (b.waves?.cleared ?? 0) < cleared; t += LOOP.step) {
    stepBattle(b, LOOP.step);
    onStep?.();
    if (b.waves?.started && b.waves.queue.length === 0) killAll(b);
  }
}

describe('waves', () => {
  it('every wave is bigger and stronger than the previous one', () => {
    for (let i = 1; i < 12; i++) {
      expect(waveStatMult(i)).toBeGreaterThan(waveStatMult(i - 1));
      if (i >= WAVES.count) expect(waveSize(1, i)).toBeGreaterThan(waveSize(1, i - 1));
    }
    expect(waveStatMult(9)).toBeCloseTo(1 + 9 * WAVES.statPerWave + 81 * WAVES.statPerWave2);
    // Growth accelerates.
    expect(waveStatMult(9) - waveStatMult(8)).toBeGreaterThan(waveStatMult(2) - waveStatMult(1));
  });

  it('portal opens only after every 3rd wave; the miniboss comes with every 3rd wave and grows', () => {
    const { b } = grove();
    const minibossHp: number[] = [];
    const seen = new Set<number>();
    clearWaves(b, 2);
    expect(b.portal).toBeNull();
    clearWaves(b, 6, () => {
      for (const e of b.enemies) {
        if (e.boss && !seen.has(e.id)) {
          seen.add(e.id);
          minibossHp.push(e.maxHp);
        }
      }
      if (b.waves && !b.waves.started) {
        expect(portalActive(b)).toBe(isPortalBreak(b.waves.cleared));
      }
    });
    expect(minibossHp).toHaveLength(2);
    expect(minibossHp[1]!).toBeGreaterThan(minibossHp[0]!);
  });

  it('portal breaks last longer, normal breaks are shorter', () => {
    const { b } = grove();
    clearWaves(b, 3);
    expect(b.waves!.portalBreak).toBe(true);
    expect(b.waves!.pause).toBeCloseTo(WAVES.breaks.portal, 1);
    clearWaves(b, 4);
    expect(b.waves!.portalBreak).toBe(false);
    expect(b.waves!.pause).toBeCloseTo(WAVES.breaks.normal, 1);
    expect(WAVES.breaks.portal - WAVES.breaks.normal).toBe(10);
  });

  it('portal sits at the arena edge; walking into it does nothing, the button works only in reach', () => {
    const { b } = grove();
    clearWaves(b, WAVES.portalEvery);
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

  it('the portal is closed while a wave is running and during non-portal breaks', () => {
    const { b } = grove();
    clearWaves(b, WAVES.portalEvery);
    expect(portalActive(b)).toBe(true);
    for (let t = 0; t < WAVES.breaks.portal + 1; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(b.waves!.started).toBe(true);
    expect(portalActive(b)).toBe(false);
    b.hero.pos = { ...b.portal!.pos };
    expect(requestPortalEntry(b)).toBe(false);
    clearWaves(b, WAVES.portalEvery + 1);
    expect(portalActive(b)).toBe(false);
  });
});
