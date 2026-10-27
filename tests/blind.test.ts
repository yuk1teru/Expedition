import { describe, expect, it } from 'vitest';
import { blindPrice, rollItem, sellBlind, sellPrice } from '../src/systems/items';
import { createGameState } from '../src/systems/run';

describe('the blind buyer (ROADMAP 14.6)', () => {
  it('pays more than a merchant for unidentified items, less than for the same identified, and takes only those', () => {
    const s = createGameState(2);
    const a = rollItem(s.lootRng, 'rare', 1, 'weapon', 30);
    const b = { ...a, uid: 2, identified: true };
    s.hero.bag.push(a, b);
    expect(blindPrice(a)).toBeGreaterThan(sellPrice(a));
    expect(blindPrice(a)).toBeLessThan(sellPrice(b));
    const gold = s.gold;
    expect(sellBlind(s)).toEqual({ count: 1, gold: blindPrice(a) });
    expect(s.gold).toBe(gold + blindPrice(a));
    expect(s.hero.bag).toEqual([b]);
  });
});
