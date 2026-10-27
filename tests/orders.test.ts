import { describe, expect, it } from 'vitest';
import { getNpc } from '../src/data/npcs';
import { ARTIFACT_ORDERS, TROPHIES } from '../src/data/trophies';
import { completeOrder, orderProgress, ordersWant, trophyWhere } from '../src/systems/orders';
import { createGameState, saveCheckpoint } from '../src/systems/run';
import { fromSave, readSave, toSave } from '../src/systems/save';
import { addTrophy, trophySale } from '../src/systems/trophies';

const furs = ARTIFACT_ORDERS.find((o) => o.id === 'furs')!;

describe('artifact orders', () => {
  it('every order pays more than a merchant would for the same set', () => {
    for (const o of ARTIFACT_ORDERS) {
      const merchant = o.wants.reduce((a, w) => a + (TROPHIES[w.trophy]?.price ?? 0) * w.count, 0);
      expect(o.pay, o.id).toBeGreaterThan(merchant);
      for (const w of o.wants) expect(TROPHIES[w.trophy], `${o.id}: ${w.trophy}`).toBeDefined();
    }
  });

  it('a full set is handed in once: the trophies go, the gold comes', () => {
    const s = createGameState(1);
    s.quests.done.push('systemBuyer');
    const need = furs.wants[0]!.count;
    addTrophy(s, 'wolfPelt', need - 1);
    expect(orderProgress(s, furs).ready).toBe(false);
    expect(completeOrder(s, 'furs')).toBe(false);
    addTrophy(s, 'wolfPelt', 3);
    const gold = s.gold;
    expect(completeOrder(s, 'furs')).toBe(true);
    expect(s.gold).toBe(gold + furs.pay);
    expect(s.hero.trophies.wolfPelt).toBe(2);
    addTrophy(s, 'wolfPelt', need);
    expect(completeOrder(s, 'furs')).toBe(false);
  });

  it('orders open after the buyer\u2019s first quest; then the merchant keeps what they wait for, a done order frees it', () => {
    const s = createGameState(1);
    addTrophy(s, 'wolfPelt', 4);
    expect(ordersWant(s, 'wolfPelt')).toBe(0);
    addTrophy(s, 'wolfPelt', 10);
    expect(completeOrder(s, 'furs')).toBe(false);
    s.hero.trophies.wolfPelt = 4;
    s.quests.done.push('systemBuyer');
    expect(ordersWant(s, 'wolfPelt')).toBeGreaterThan(0);
    expect(trophySale(s).count).toBe(0);
    s.ordersDone.push('furs');
    expect(trophySale(s).count).toBe(4);
  });

  it('the buyer tells where to look; he has his orders in the talk', () => {
    const s = createGameState(1);
    expect(trophyWhere(s, 'wolfPelt')).toContain('Тихий гай');
    expect(trophyWhere(s, 'amberBeetle')).toContain('скарби');
    const npc = getNpc('artifactBuyer');
    expect(npc.nodes[npc.start]!.options.some((o) => o.action === 'openOrders')).toBe(true);
  });

  it('done orders are saved', () => {
    const s = createGameState(1);
    s.ordersDone.push('amber');
    saveCheckpoint(s);
    expect(fromSave(readSave(JSON.stringify(toSave(s)))!).ordersDone).toEqual(['amber']);
  });
});
