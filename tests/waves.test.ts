import { describe, expect, it } from 'vitest';
import { ARENA, LOOP, WAVES } from '../src/data/balance';
import { type Battle, createBattle, killAll, stepBattle } from '../src/systems/battle';
import { createBossEnemy } from '../src/systems/boss';
import { killEnemy } from '../src/systems/combat';
import { dist } from '../src/systems/entities';
import { createGameState, teleport } from '../src/systems/run';
import { TRAPS } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { CONSUMABLES, PICKUP_SPAWN } from '../src/data/consumables';
import { maybeSpawnPickup } from '../src/systems/pickups';
import { spawnTraps, trapsForWave, updateTraps } from '../src/systems/traps';
import { inBreak, isPortalBreak, portalActive, portalInReach, requestPortalEntry, skipBreak, spawnEnemy, waveEvent, waveMult, waveSize } from '../src/systems/waves';

function grove(): { b: Battle } {
  const s = createGameState(21);
  s.hero.immortal = true;
  teleport(s, 'quietGrove');
  return { b: createBattle(s, 'quietGrove') };
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
  it('every wave is stronger and faster than the previous one; size grows up to the cap', () => {
    for (let i = 1; i < 20; i++) {
      const a = waveMult(i - 1);
      const m = waveMult(i);
      expect(m.hp).toBeGreaterThan(a.hp);
      expect(m.damage).toBeGreaterThan(a.damage);
      expect(m.speed).toBeGreaterThanOrEqual(a.speed);
      expect(waveSize(1, i)).toBeGreaterThanOrEqual(waveSize(1, i - 1));
      expect(waveSize(3, i)).toBeLessThanOrEqual(WAVES.cap);
    }
    expect(waveMult(1).speed).toBeGreaterThan(1);
    expect(waveMult(100).speed).toBe(WAVES.growth.speedMax);
    // HP growth accelerates; damage stays close to linear (no sudden spikes between waves).
    expect(waveMult(9).hp - waveMult(8).hp).toBeGreaterThan(waveMult(2).hp - waveMult(1).hp);
    for (let i = 1; i < 30; i++) expect(waveMult(i).damage / waveMult(i - 1).damage).toBeLessThanOrEqual(1.17);
  });

  it('fast and ranged enemies are less tanky than tanks on late waves', () => {
    const { b } = grove();
    const m = waveMult(12);
    const hpMult = (id: string): number => spawnEnemy(b, id, { x: 300, y: 300 }, false, false, m).maxHp / ENEMIES[id]!.hp;
    expect(hpMult('wolf')).toBeLessThan(hpMult('stump'));
    expect(hpMult('mushroom')).toBeLessThan(hpMult('stump'));
  });

  it('every 5th wave is an event: weather and elemental in turn', () => {
    expect(waveEvent(4)).toBeNull();
    expect(waveEvent(5)).toBe('weather');
    expect(waveEvent(10)).toBe('elemental');
    expect(waveEvent(15)).toBe('weather');
  });

  it('a break can be skipped (also the portal one)', () => {
    const { b } = grove();
    clearWaves(b, WAVES.portalEvery);
    expect(inBreak(b)).toBe(true);
    expect(skipBreak(b)).toBe(true);
    stepBattle(b, LOOP.step);
    expect(b.waves!.started).toBe(true);
    expect(portalActive(b)).toBe(false);
    expect(skipBreak(b)).toBe(false);
  });

  it('skipping a break takes the skipped seconds off skill and boot-dash cooldowns', () => {
    const { b } = grove();
    clearWaves(b, WAVES.portalEvery);
    const left = b.waves!.pause;
    b.hero.skills = [{ id: 'whirlwind', rank: 1, slot: 0, cooldown: left + 2 }, { id: 'charge', rank: 1, slot: 1, cooldown: 1 }];
    b.hero.dodgeCooldown = left + 3;
    expect(skipBreak(b)).toBe(true);
    expect(b.hero.skills[0]!.cooldown).toBeCloseTo(2);
    expect(b.hero.skills[1]!.cooldown).toBe(0);
    expect(b.hero.dodgeCooldown).toBeCloseTo(3);
  });

  it('continuing starts from the remembered wave, with 3 mandatory waves', () => {
    const s = createGameState(5);
    s.hero.immortal = true;
    teleport(s, 'quietGrove');
    const b = createBattle(s, 'quietGrove', 9);
    expect(b.waves!.index).toBe(9);
    expect(b.waves!.total).toBe(12);
    clearWaves(b, 11);
    expect(portalActive(b)).toBe(false);
    clearWaves(b, 12);
    expect(portalActive(b)).toBe(true);
  });

  it('traps appear from their wave on and root the hero', () => {
    expect(trapsForWave(TRAPS.fromWave - 1)).toBe(0);
    expect(trapsForWave(TRAPS.fromWave)).toBeGreaterThan(0);
    const { b } = grove();
    spawnTraps(b, TRAPS.fromWave + 4);
    expect(b.traps.length).toBeGreaterThan(0);
    const t = b.traps[0]!;
    b.time += TRAPS.armTime;
    b.hero.pos = { ...t.pos };
    updateTraps(b);
    expect(b.hero.statuses.root?.time ?? 0).toBeGreaterThan(0);
  });

  it('herbs grow even with full pockets, but never more than the max plants at once', () => {
    const { b } = grove();
    for (const id of ['herbGreen', 'herbRed', 'herbWhite'] as const) b.hero.consumables[id] = CONSUMABLES[id].max;
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      b.pickups = [];
      for (let w = 1; w <= 6; w++) maybeSpawnPickup(b, w * 2);
      expect(b.pickups.length).toBeLessThanOrEqual(PICKUP_SPAWN.max);
      for (const p of b.pickups) kinds.add(p.kind);
    }
    expect(kinds.has('herbGreen')).toBe(true);
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

  it('the next wave comes to help when ≤ 40% of the current one is left; the 3rd wave ends with a full clear and the portal', () => {
    const { b } = grove();
    const w = b.waves!;
    for (let t = 0; t < 10 && !(w.started && w.queue.length === 0); t += LOOP.step) stepBattle(b, LOOP.step);
    expect(w.index).toBe(0);
    const mine = b.enemies.filter((e) => !e.dead && e.wave === 0);
    // Kill until just above 40%: no help yet.
    const keep = Math.floor(w.size * WAVES.overlapAt) + 1;
    for (const e of mine.slice(keep)) killEnemy(b, e);
    stepBattle(b, LOOP.step);
    expect(w.index).toBe(0);
    killEnemy(b, mine[0]!);
    stepBattle(b, LOOP.step);
    stepBattle(b, LOOP.step);
    expect(w.index).toBe(1);
    expect(w.started).toBe(true);
    // The leftovers of wave 1 are still on the field, together with wave 2.
    expect(b.enemies.some((e) => !e.dead && e.wave === 0)).toBe(true);
    clearWaves(b, 3);
    expect(b.enemies.filter((e) => !e.dead)).toHaveLength(0);
    expect(w.portalBreak).toBe(true);
    expect(w.pause).toBeCloseTo(WAVES.breaks.portal, 1);
  });

  it('no help while a miniboss lives', () => {
    const { b } = grove();
    const w = b.waves!;
    for (let t = 0; t < 10 && !(w.started && w.queue.length === 0); t += LOOP.step) stepBattle(b, LOOP.step);
    const boss = createBossEnemy(b, 'alpha', { x: 300, y: 300 });
    for (const e of b.enemies) if (e !== boss) killEnemy(b, e);
    for (let t = 0; t < 1; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(w.index).toBe(0);
    killEnemy(b, boss);
    stepBattle(b, LOOP.step);
    expect(w.index).toBe(1);
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
    // The 4th wave hands over to the 5th without a break: the portal stays shut.
    clearWaves(b, WAVES.portalEvery + 1);
    expect(portalActive(b)).toBe(false);
  });
});
