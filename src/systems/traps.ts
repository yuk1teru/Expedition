// Snares against kiting: from TRAPS.fromWave on, every wave scatters a few traps.
// A trap fades in, arms, and snaps on the hero (root + damage). Charge jumps over them.

import { ARENA, TRAPS } from '../data/balance';
import type { Battle } from './battle';
import { damageHero, debuffHero } from './combat';
import type { Vec } from './entities';
import { dist } from './entities';
import { tierMultiplier } from './scaling';

export interface Trap {
  id: number;
  pos: Vec;
  spawnedAt: number;
  damage: number;
  dead: boolean;
}

export function trapArmed(b: Battle, t: Trap): boolean {
  return b.time - t.spawnedAt >= TRAPS.armTime;
}

/** New traps for a wave (1-based number). */
export function trapsForWave(waveNumber: number): number {
  if (waveNumber < TRAPS.fromWave) return 0;
  return Math.floor(TRAPS.base + TRAPS.perWave * (waveNumber - TRAPS.fromWave));
}

export function spawnTraps(b: Battle, waveNumber: number): void {
  const alive = b.traps.filter((t) => !t.dead).length;
  const n = Math.min(trapsForWave(waveNumber), TRAPS.max - alive);
  const damage = TRAPS.damage * tierMultiplier(b.tier) * (b.waves?.mult.damage ?? 1);
  const inset = TRAPS.inset;
  for (let i = 0; i < n; i++) {
    let pos: Vec | null = null;
    for (let k = 0; k < TRAPS.placementTries && !pos; k++) {
      const p = { x: b.rng.float(ARENA.x + inset, ARENA.x + ARENA.w - inset), y: b.rng.float(ARENA.y + inset, ARENA.y + ARENA.h - inset) };
      if (dist(p, b.hero.pos) < TRAPS.minDistFromHero) continue;
      if (b.traps.some((t) => !t.dead && dist(t.pos, p) < TRAPS.radius * 4)) continue;
      pos = p;
    }
    if (!pos) continue;
    b.traps.push({ id: b.nextId++, pos, spawnedAt: b.time, damage, dead: false });
  }
}

export function updateTraps(b: Battle): void {
  const hero = b.hero;
  if (hero.dead || hero.dash) return;
  for (const t of b.traps) {
    if (t.dead || !trapArmed(b, t) || dist(t.pos, hero.pos) > TRAPS.radius + hero.radius * 0.6) continue;
    t.dead = true;
    damageHero(b, t.damage, { melee: false });
    debuffHero(b, 'root', TRAPS.root);
    b.events.emit({ type: 'trapSnap', pos: { ...t.pos } });
  }
  if (b.traps.some((t) => t.dead)) b.traps = b.traps.filter((t) => !t.dead);
}
