import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { HERB, PICKUP_SPAWN } from '../src/data/consumables';
import { createBattle, stepBattle } from '../src/systems/battle';
import { SLICE_GROVE_ID } from '../src/systems/mapgen';
import { maybeSpawnPickup, useHerb } from '../src/systems/pickups';
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

  it('a grown herb is picked up by walking into it and eaten later with G, even in another battle', () => {
    const { s, b } = grove();
    b.input.control = 'player';
    b.pickups.push({ id: 999, kind: 'herb', pos: { ...s.hero.pos }, spawnedAt: 0, dead: false });
    stepBattle(b, LOOP.step);
    expect(s.hero.consumables.herb).toBe(0); // still growing
    for (let t = 0; t < PICKUP_SPAWN.growTime + 0.1; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(s.hero.consumables.herb).toBe(1);
    // Next battle: the herb is still carried.
    teleport(s, SLICE_GROVE_ID);
    const b2 = createBattle(s, SLICE_GROVE_ID);
    s.hero.hp = s.hero.maxHp / 2;
    expect(useHerb(b2)).toBe(true);
    expect(s.hero.hp).toBeCloseTo(s.hero.maxHp * (0.5 + HERB.healPct), 0);
    expect(s.hero.consumables.herb).toBe(0);
    expect(useHerb(b2)).toBe(false);
  });

  it('a rage berry gives an attack-speed buff on pickup', () => {
    const { s, b } = grove();
    b.input.control = 'player';
    b.pickups.push({ id: 998, kind: 'rageBerry', pos: { ...s.hero.pos }, spawnedAt: -10, dead: false });
    stepBattle(b, LOOP.step);
    expect(s.hero.buffs.some((x) => x.id === 'rageBerry' && x.attackSpeedMult > 1)).toBe(true);
  });
});
