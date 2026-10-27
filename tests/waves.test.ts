import { describe, expect, it } from 'vitest';
import { LOOP, WAVES } from '../src/data/balance';
import { type Battle, createBattle, killAll, stepBattle } from '../src/systems/battle';
import { createBossEnemy } from '../src/systems/boss';
import { killEnemy } from '../src/systems/combat';
import { createGameState, teleport } from '../src/systems/run';
import { TRAPS } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { CONSUMABLES, PICKUP_SPAWN } from '../src/data/consumables';
import { maybeSpawnPickup } from '../src/systems/pickups';
import { spawnTraps, trapsForWave, updateTraps } from '../src/systems/traps';
import { spawnEnemy, waveEvent, waveMult, waveSize } from '../src/systems/waves';

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

  it('the next wave comes to help when ≤ 40% of the current one is left; the last wave ends with a full clear and the win', () => {
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
    expect(w.done).toBe(true);
    stepBattle(b, LOOP.step);
    expect(b.outcome).toBe('won');
  });

  it('an arena of the trip: its own number of waves, the growth goes on, the miniboss comes with the last wave of a lair', () => {
    const s = createGameState(5);
    s.hero.immortal = true;
    teleport(s, 'quietGrove');
    const entrance = createBattle(s, 'quietGrove', 0, false, { waves: 2, miniboss: false });
    expect(entrance.waves!.total).toBe(2);
    const lair = createBattle(s, 'quietGrove', 3, false, { waves: 1, miniboss: true });
    expect(lair.waves!.index).toBe(3);
    expect(lair.waves!.mult.hp).toBeCloseTo(waveMult(3).hp);
    let boss = false;
    clearWaves(lair, 4, () => {
      if (lair.enemies.some((e) => e.boss && !e.dead)) boss = true;
    });
    expect(boss).toBe(true);
    expect(lair.waves!.done).toBe(true);
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
});
