// Arena pickups: plants grow now and then; walking into a grown one picks it up.
// Healing herbs are carried and eaten with G (even in a later battle).

import { ARENA } from '../data/balance';
import { CONSUMABLES, HERB, PICKUPS, PICKUP_SPAWN, type PickupKind } from '../data/consumables';
import type { Battle } from './battle';
import { healHero } from './combat';
import { addBuff } from './effects';
import type { Vec } from './entities';
import { dist } from './entities';

export interface Pickup {
  id: number;
  kind: PickupKind;
  pos: Vec;
  spawnedAt: number;
  dead: boolean;
}

export function pickupReady(b: Battle, p: Pickup): boolean {
  return b.time - p.spawnedAt >= PICKUP_SPAWN.growTime;
}

/** At the start of every N-th wave a plant may sprout (never more than the max at once). */
export function maybeSpawnPickup(b: Battle, waveNumber: number): void {
  if (waveNumber % PICKUP_SPAWN.everyWaves !== 0) return;
  if (b.pickups.filter((p) => !p.dead).length >= PICKUP_SPAWN.max) return;
  // Nothing to carry: no herb grows while the hero's bag is full of them (counting ones already growing).
  const kinds = Object.values(PICKUPS).filter((d) => {
    if (d.effect.kind !== 'stash') return true;
    const id = d.effect.consumable;
    const growing = b.pickups.filter((p) => !p.dead && p.kind === d.id).length;
    return b.hero.consumables[id] + growing < CONSUMABLES[id].max;
  });
  if (kinds.length === 0) return;
  const kind = b.rng.weighted(kinds.map((d) => ({ item: d.id, weight: d.weight })));
  const inset = PICKUP_SPAWN.inset;
  let pos: Vec = { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
  for (let i = 0; i < PICKUP_SPAWN.placementTries; i++) {
    pos = { x: b.rng.float(ARENA.x + inset, ARENA.x + ARENA.w - inset), y: b.rng.float(ARENA.y + inset, ARENA.y + ARENA.h - inset) };
    if (dist(pos, b.hero.pos) > inset * 2) break;
  }
  b.pickups.push({ id: b.nextId++, kind, pos, spawnedAt: b.time, dead: false });
  b.events.emit({ type: 'pickupSpawn', kind, pos: { ...pos } });
}

/** The hero picks up grown plants by walking into them. */
export function updatePickups(b: Battle, dt: number): void {
  const hero = b.hero;
  hero.herbCooldown = Math.max(0, hero.herbCooldown - dt);
  if (hero.dead) return;
  for (const p of b.pickups) {
    if (p.dead || !pickupReady(b, p) || dist(hero.pos, p.pos) > hero.radius + PICKUP_SPAWN.radius) continue;
    const def = PICKUPS[p.kind];
    if (def.effect.kind === 'stash') {
      const id = def.effect.consumable;
      if (hero.consumables[id] >= CONSUMABLES[id].max) continue; // full: leave it growing
      hero.consumables[id] += 1;
    } else {
      addBuff(hero, { id: p.kind, time: def.effect.duration, attackSpeedMult: 1 + def.effect.attackSpeed, damageTakenMult: 1 });
    }
    p.dead = true;
    b.events.emit({ type: 'pickup', kind: p.kind, pos: { ...p.pos } });
  }
  if (b.pickups.some((p) => p.dead)) b.pickups = b.pickups.filter((p) => !p.dead);
}

/** G: eat a carried herb. */
export function useHerb(b: Battle): boolean {
  const hero = b.hero;
  if (hero.dead || hero.consumables.herb <= 0 || hero.herbCooldown > 0 || hero.hp >= hero.maxHp) return false;
  hero.consumables.herb -= 1;
  hero.herbCooldown = HERB.cooldown;
  healHero(b, hero.maxHp * HERB.healPct, 'show');
  return true;
}
