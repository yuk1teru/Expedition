import { describe, expect, it } from 'vitest';
import { CONSUMABLES } from '../src/data/consumables';
import { INVASION_EVENTS } from '../src/data/invasion';
import { TOWN_GROWTH } from '../src/data/growth';
import { getNpc } from '../src/data/npcs';
import { getTownLayout, grownLayout } from '../src/data/towns';
import { invest, priceMult, townLevel } from '../src/systems/growth';
import { defenseBattle } from '../src/systems/invasion';
import { buyConsumable } from '../src/systems/items';
import { createGameState, restoreCheckpoint, saveCheckpoint, teleport } from '../src/systems/run';

const forest = TOWN_GROWTH.forestTown!;

function rich() {
  const s = createGameState(4);
  s.gold = 5000;
  teleport(s, 'forestTown');
  return s;
}

describe('town growth (ROADMAP 15.4)', () => {
  it('the steward takes the gold; levels go one by one up to the last', () => {
    const steward = getNpc(forest.steward);
    expect(steward.nodes[steward.start]!.options.some((o) => o.action === 'openGrowth')).toBe(true);
    const s = rich();
    let gold = s.gold;
    for (const l of forest.levels) {
      expect(invest(s, 'forestTown')).toBe(true);
      expect(s.gold).toBe(gold - l.cost);
      gold = s.gold;
    }
    expect(townLevel(s, 'forestTown')).toBe(forest.levels.length);
    expect(invest(s, 'forestTown')).toBe(false);
  });

  it('the market makes this town cheaper (only here); the palisade shortens the battle at the gates', () => {
    const s = rich();
    const waves0 = defenseBattle(s, 'forestTown').waves!.total;
    expect(waves0).toBe(INVASION_EVENTS.townAttack.waves);
    for (let i = 0; i < forest.levels.length; i++) invest(s, 'forestTown');
    teleport(s, 'forestTown');
    expect(defenseBattle(s, 'forestTown').waves!.total).toBeLessThan(waves0);
    teleport(s, 'forestTown');
    expect(priceMult(s)).toBeLessThan(1);
    const gold = s.gold;
    buyConsumable(s, 'potionSmall');
    expect(gold - s.gold).toBeLessThan(CONSUMABLES.potionSmall.price);
    teleport(s, 'capital');
    expect(priceMult(s)).toBe(1);
  });

  it('the town visibly grows: pieces of a level appear with it (the smith comes at the last)', () => {
    const base = getTownLayout('forestTown');
    const at0 = grownLayout(base, 0);
    const top = grownLayout(base, forest.levels.length);
    expect(top.props.length).toBeGreaterThan(at0.props.length);
    expect(top.buildings.length).toBeGreaterThan(at0.buildings.length);
    expect(at0.npcs.some((n) => n.id === 'forestSmith')).toBe(false);
    expect(top.npcs.some((n) => n.id === 'forestSmith')).toBe(true);
  });

  it('growth is part of the checkpoint, like the gold paid for it', () => {
    const s = rich();
    saveCheckpoint(s);
    invest(s, 'forestTown');
    restoreCheckpoint(s);
    expect(townLevel(s, 'forestTown')).toBe(0);
  });
});
