// Arena pickups: plants grow now and then; walking into a grown one picks it up.
// Herbs are carried and, like potions, used from the quick slots Z / X / C
// (even in a later battle): they heal over a few seconds.

import { ARENA } from '../data/balance';
import { CONSUMABLES, type HealId, PICKUPS, PICKUP_SPAWN, type PickupKind, QUICK_SLOTS, healAmount } from '../data/consumables';
import type { Battle } from './battle';
import { addBuff } from './effects';
import { type Vec, dist } from './entities';
import { gainConsumable } from './items';

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

/**
 * At the start of every N-th wave a random plant may sprout, never more than the max at
 * once. It grows even if the hero's pockets are full: then it waits to be picked later.
 */
export function maybeSpawnPickup(b: Battle, waveNumber: number): void {
  if (waveNumber % PICKUP_SPAWN.everyWaves !== 0) return;
  if (b.pickups.filter((p) => !p.dead).length >= PICKUP_SPAWN.max) return;
  const kind = b.rng.weighted(Object.values(PICKUPS).map((d) => ({ item: d.id, weight: d.weight })));
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
  hero.healCooldown = Math.max(0, hero.healCooldown - dt);
  if (hero.dead) return;
  for (const p of b.pickups) {
    if (p.dead || !pickupReady(b, p) || dist(hero.pos, p.pos) > hero.radius + PICKUP_SPAWN.radius) continue;
    const def = PICKUPS[p.kind];
    if (def.effect.kind === 'stash') {
      // Full: leave it growing.
      if (!gainConsumable(hero, def.effect.consumable)) continue;
    } else {
      addBuff(hero, { id: p.kind, time: def.effect.duration, attackSpeedMult: 1 + def.effect.attackSpeed, damageTakenMult: 1 });
    }
    p.dead = true;
    b.events.emit({ type: 'pickup', kind: p.kind, pos: { ...p.pos } });
  }
  if (b.pickups.some((p) => p.dead)) b.pickups = b.pickups.filter((p) => !p.dead);
}

/** Uses a carried healing item: heals `pct` of max HP + `flat` over its duration. */
export function useHealItem(b: Battle, id: HealId): boolean {
  const hero = b.hero;
  const def = CONSUMABLES[id];
  if (!def.heal || hero.dead || hero.consumables[id] <= 0 || hero.healCooldown > 0 || hero.hp >= hero.maxHp) return false;
  hero.consumables[id] -= 1;
  hero.healCooldown = QUICK_SLOTS.cooldown;
  const total = healAmount(def.heal, hero.maxHp);
  // Each use is its own buff, so two different items heal together.
  hero.buffs.push({ id: `heal:${id}:${b.time}`, time: def.heal.duration, attackSpeedMult: 1, damageTakenMult: 1, regen: total / def.heal.duration });
  b.events.emit({ type: 'healUse', id, pos: { ...hero.pos }, total, duration: def.heal.duration });
  return true;
}

/** Z / X / C: the healing item on a quick slot (0-based). */
export function useQuickSlot(b: Battle, slot: number): boolean {
  const id = b.hero.quickSlots[slot];
  return id ? useHealItem(b, id) : false;
}
