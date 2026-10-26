import { describe, expect, it } from 'vitest';
import { SLICE } from '../src/data/balance';
import { SLICE_GROVE_ID, SLICE_LAIR_ID, TOWN_ID, generateSliceWorld, getNode, markCleared, neighbours } from '../src/systems/mapgen';
import { canTravel, createGameState, travel } from '../src/systems/run';

describe('slice world', () => {
  it('has town, grove and boss lair connected by 2 edges', () => {
    const w = generateSliceWorld();
    expect(w.nodes.map((n) => n.id).sort()).toEqual([SLICE_GROVE_ID, SLICE_LAIR_ID, TOWN_ID].sort());
    expect(w.edges).toHaveLength(2);
    expect(neighbours(w, TOWN_ID).sort()).toEqual([SLICE_GROVE_ID, SLICE_LAIR_ID].sort());
    expect(w.nodes.filter((n) => n.isBoss)).toHaveLength(1);
  });

  it('grove tier grows by 0.5 per clear up to the max', () => {
    const w = generateSliceWorld();
    const grove = getNode(w, SLICE_GROVE_ID);
    const tiers = [grove.tier];
    for (let i = 0; i < 6; i++) {
      markCleared(grove);
      tiers.push(grove.tier);
    }
    expect(tiers).toEqual([1, 1.5, 2, 2.5, 3, 3, 3]);
    expect(getNode(w, SLICE_LAIR_ID).tier).toBe(SLICE.bossTier);
  });

  it('travel only to adjacent nodes; current location can be replayed', () => {
    const s = createGameState(1);
    expect(canTravel(s, TOWN_ID)).toBe(false);
    expect(travel(s, SLICE_GROVE_ID)).toEqual({ kind: 'battle', nodeId: SLICE_GROVE_ID });
    expect(travel(s, SLICE_GROVE_ID)).toEqual({ kind: 'battle', nodeId: SLICE_GROVE_ID });
    expect(travel(s, SLICE_LAIR_ID)).toEqual({ kind: 'blocked' });
    expect(travel(s, TOWN_ID)).toEqual({ kind: 'town' });
    expect(travel(s, SLICE_LAIR_ID)).toEqual({ kind: 'battle', nodeId: SLICE_LAIR_ID });
  });
});
