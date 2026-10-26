import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { CONSUMABLES, PICKUP_SPAWN, QUICK_SLOTS, healAmount } from '../src/data/consumables';
import { createBattle, stepBattle } from '../src/systems/battle';
import { SLICE_GROVE_ID } from '../src/systems/mapgen';
import { maybeSpawnPickup, useHealItem, useQuickSlot } from '../src/systems/pickups';
import { assignQuickSlot, buyConsumable } from '../src/systems/items';
import { createGameState, teleport } from '../src/systems/run';

function grove(seed = 41) {
  const s = createGameState(seed);
  s.hero.immortal = true;
  teleport(s, SLICE_GROVE_ID);
  return { s, b: createBattle(s, SLICE_GROVE_ID) };
}

describe('pickups', () => {
  it('a plant sprouts only every N-th wave and never more than the max at once', () => {
    const { b } = grove();
    maybeSpawnPickup(b, 1);
    expect(b.pickups).toHaveLength(0);
    for (let w = 1; w <= 12; w++) maybeSpawnPickup(b, w * PICKUP_SPAWN.everyWaves);
    expect(b.pickups.length).toBe(PICKUP_SPAWN.max);
  });

  it('a grown herb is picked up, lands on a free quick slot and heals over time later, even in another battle', () => {
    const { s, b } = grove();
    b.input.control = 'player';
    b.pickups.push({ id: 999, kind: 'herbRed', pos: { ...s.hero.pos }, spawnedAt: 0, dead: false });
    stepBattle(b, LOOP.step);
    expect(s.hero.consumables.herbRed).toBe(0); // still growing
    for (let t = 0; t < PICKUP_SPAWN.growTime + 0.1; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(s.hero.consumables.herbRed).toBe(1);
    expect(s.hero.quickSlots[0]).toBe('herbRed');
    // Next battle: the herb is still carried; Z heals pct + flat over its duration.
    teleport(s, SLICE_GROVE_ID);
    const b2 = createBattle(s, SLICE_GROVE_ID);
    b2.waves = null;
    s.hero.hp = s.hero.maxHp / 2;
    s.hero.hitAt = 0;
    expect(useQuickSlot(b2, 0)).toBe(true);
    const heal = CONSUMABLES.herbRed.heal!;
    for (let t = 0; t < heal.duration + 0.1; t += LOOP.step) stepBattle(b2, LOOP.step);
    const regen = s.hero.stats.hpRegen * (heal.duration + 0.1);
    expect(s.hero.hp - s.hero.maxHp / 2).toBeGreaterThanOrEqual(healAmount(heal, s.hero.maxHp) - 1);
    expect(s.hero.hp - s.hero.maxHp / 2).toBeLessThanOrEqual(healAmount(heal, s.hero.maxHp) + regen + 1);
    expect(s.hero.consumables.herbRed).toBe(0);
    expect(useQuickSlot(b2, 0)).toBe(false);
  });

  it('herbs: green < red < white; potions heal a bigger share than herbs; shared cooldown', () => {
    const c = CONSUMABLES;
    expect(c.herbGreen.heal!.pct).toBeLessThan(c.herbRed.heal!.pct);
    expect(c.herbRed.heal!.pct).toBeLessThan(c.herbWhite.heal!.pct);
    expect(c.potionSmall.heal!.pct).toBeGreaterThan(c.herbWhite.heal!.pct);
    const { s, b } = grove();
    s.hero.consumables.herbGreen = 1;
    s.hero.consumables.potionSmall = 1;
    s.hero.hp = 10;
    expect(useHealItem(b, 'herbGreen')).toBe(true);
    expect(useHealItem(b, 'potionSmall')).toBe(false);
    for (let t = 0; t < QUICK_SLOTS.cooldown + 0.05; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(useHealItem(b, 'potionSmall')).toBe(true);
  });

  it('potions are bought from the merchant and can be put on any quick slot', () => {
    const { s } = grove();
    s.gold = 1000;
    expect(buyConsumable(s, 'potionLarge')).toBe(true);
    expect(s.hero.quickSlots).toContain('potionLarge');
    assignQuickSlot(s.hero, 2, 'potionLarge');
    expect(s.hero.quickSlots.filter((x) => x === 'potionLarge')).toHaveLength(1);
    expect(s.hero.quickSlots[2]).toBe('potionLarge');
    expect(buyConsumable(s, 'herbGreen')).toBe(false); // herbs are found, not sold
  });

  it('a rage berry gives an attack-speed buff on pickup', () => {
    const { s, b } = grove();
    b.input.control = 'player';
    b.pickups.push({ id: 998, kind: 'rageBerry', pos: { ...s.hero.pos }, spawnedAt: -10, dead: false });
    stepBattle(b, LOOP.step);
    expect(s.hero.buffs.some((x) => x.id === 'rageBerry' && x.attackSpeedMult > 1)).toBe(true);
  });
});
