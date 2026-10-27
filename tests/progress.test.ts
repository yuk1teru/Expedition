import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { CONSUMABLES } from '../src/data/consumables';
import { ITEM_BASES, ITEM_LEVEL, LOOT, MERCHANT_ITEMS, RARITIES, RARITY_ORDER, UNIDENTIFIED_SELL_MULT } from '../src/data/items';
import { createBattle, stepBattle } from '../src/systems/battle';
import { damageEnemy } from '../src/systems/combat';
import { createBossEnemy } from '../src/systems/boss';
import { assignClass } from '../src/systems/hero';
import {
  buyConsumable,
  buyItem,
  compareItems,
  dropItemLevel,
  itemLevelRange,
  merchantItemLevels,
  sellPrice,
  formatStatDelta,
  equipFromBag,
  hasNewItems,
  identifyItem,
  markItemsSeen,
  rollItem,
  sellItem,
  stashLoot,
  unequip,
} from '../src/systems/items';
import { gainXp } from '../src/systems/leveling';
import { SLICE_GROVE_ID, SLICE_LAIR_ID, TOWN_ID, getNode, markCleared } from '../src/systems/mapgen';
import { completeBattle, createGameState, leaveTown, restInTown, restoreCheckpoint, teleport } from '../src/systems/run';

describe('items', () => {
  it('rarities scale power and extra stats; items drop unidentified', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 50; i++) {
      const items = RARITY_ORDER.map((r) => rollItem(rng, r, i, 'weapon'));
      items.forEach((it, k) => {
        expect(it.stats).toHaveLength(1 + RARITIES[RARITY_ORDER[k]!].extraStats);
        expect(it.identified).toBe(false);
        expect(it.stats[0]!.value).toBeLessThanOrEqual(Math.round(ITEM_BASES.weapon.main.range[1] * RARITIES[it.rarity].power));
      });
      expect(items[4]!.stats[0]!.value).toBeGreaterThan(items[0]!.stats[0]!.value);
    }
  });

  it('a magnifier is needed to identify before wearing; selling pays by rarity', () => {
    const s = createGameState(2, 'slice');
    const rng = new Rng(3);
    stashLoot(s.hero, rollItem(rng, 'rare', 1, 'armor'));
    expect(equipFromBag(s.hero, 0)).toBe(false);
    expect(identifyItem(s.hero, 0)).toBe(false); // no magnifier
    s.gold = CONSUMABLES.magnifier.price;
    expect(buyConsumable(s, 'magnifier')).toBe(true);
    expect(s.gold).toBe(0);
    expect(identifyItem(s.hero, 0)).toBe(true);
    expect(s.hero.consumables.magnifier).toBe(0);
    expect(equipFromBag(s.hero, 0)).toBe(true);
    unequip(s.hero, 'armor');
    expect(sellItem(s, 0)).toBe(RARITIES.rare.sellPrice);
    expect(s.gold).toBe(RARITIES.rare.sellPrice);
    stashLoot(s.hero, rollItem(rng, 'rare', 2, 'armor'));
    expect(sellItem(s, 0)).toBe(Math.round(RARITIES.rare.sellPrice * UNIDENTIFIED_SELL_MULT));
  });

  it('loot goes to the bag as new; wearing is manual and swaps with the worn item', () => {
    const s = createGameState(1, 'slice');
    const atk0 = s.hero.stats.attack;
    const rng = new Rng(2);
    const a = rollItem(rng, 'common', 1, 'weapon');
    const b = rollItem(rng, 'epic', 2, 'weapon');
    stashLoot(s.hero, { ...a, identified: true });
    stashLoot(s.hero, { ...b, identified: true });
    expect(s.hero.equipment.weapon).toBeUndefined();
    expect(hasNewItems(s.hero)).toBe(true);
    expect(s.hero.stats.attack).toBe(atk0);
    equipFromBag(s.hero, 0);
    expect(s.hero.stats.attack).toBe(atk0 + a.stats[0]!.value);
    equipFromBag(s.hero, 0);
    expect(s.hero.equipment.weapon?.uid).toBe(2);
    expect(s.hero.bag[0]?.uid).toBe(1);
    expect(s.hero.stats.attack).toBe(atk0 + b.stats[0]!.value);
    markItemsSeen(s.hero);
    expect(hasNewItems(s.hero)).toBe(false);
  });

  it('miniboss drops common or uncommon loot, boss can drop anything', () => {
    const s = createGameState(5, 'slice');
    teleport(s, SLICE_GROVE_ID);
    const b = createBattle(s, SLICE_GROVE_ID);
    const mini = createBossEnemy(b, 'alpha', { x: 300, y: 300 });
    damageEnemy(b, mini, { amount: 1e6, crit: false }, { source: 'skill' });
    expect(b.stats.loot).toHaveLength(LOOT.miniboss.count);
    const allowed = (w: object, r: string): boolean => r in w;
    expect(b.stats.loot.every((i) => allowed(LOOT.miniboss.weights, i.rarity))).toBe(true);
    const boss = createBossEnemy(b, 'enat', { x: 500, y: 300 });
    damageEnemy(b, boss, { amount: 1e7, crit: false }, { source: 'skill' });
    const bossLoot = b.stats.loot.slice(LOOT.miniboss.count);
    expect(bossLoot).toHaveLength(LOOT.boss.count);
    expect(bossLoot.every((i) => allowed(LOOT.boss.weights, i.rarity))).toBe(true);
  });
});

describe('checkpoint', () => {
  it('death returns the hero to the last rest, keeping run statistics', () => {
    const s = createGameState(9, 'slice');
    gainXp(s, 300);
    assignClass(s.hero, 'warrior');
    s.gold = 50;
    restInTown(s);
    const level = s.hero.level;
    // Progress after the checkpoint is lost on death.
    gainXp(s, 5000);
    s.gold = 999;
    s.day = 7;
    markCleared(getNode(s.world, SLICE_GROVE_ID));
    s.stats.kills = 42;
    s.hero.hp = 0;
    s.hero.dead = true;
    restoreCheckpoint(s);
    expect(s.hero.level).toBe(level);
    expect(s.hero.classId).toBe('warrior');
    expect(s.gold).toBe(50);
    expect(s.day).toBe(1);
    expect(getNode(s.world, SLICE_GROVE_ID).timesCleared).toBe(0);
    expect(s.hero.dead).toBe(false);
    expect(s.hero.hp).toBe(s.hero.maxHp);
    expect(s.stats.kills).toBe(42);
    expect(s.stats.deaths).toBe(1);
    expect(s.currentNodeId).toBe(TOWN_ID);
  });

  it('saving works even if a battle ended mid-dash', () => {
    const s = createGameState(12, 'slice');
    s.hero.dash = { from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, time: 0, duration: 1, onArrive: () => {} };
    expect(() => restInTown(s)).not.toThrow();
    expect(s.checkpoint.hero.dash).toBeNull();
  });

  it('a boss victory saves the checkpoint; death afterwards keeps it; victory screen only once', () => {
    const s = createGameState(14, 'slice');
    gainXp(s, 3000);
    const level = s.hero.level;
    teleport(s, SLICE_LAIR_ID);
    const win = (): ReturnType<typeof completeBattle> => {
      const b = createBattle(s, SLICE_LAIR_ID);
      damageEnemy(b, b.boss!, { amount: 1e7, crit: false }, { source: 'skill' });
      for (let t = 0; t < 5 && !b.finished; t += 1 / 60) stepBattle(b, 1 / 60);
      return completeBattle(s, b);
    };
    const first = win();
    expect(first.runCompleted).toBe(true);
    s.hero.dead = true;
    restoreCheckpoint(s);
    expect(s.bossesDefeated).toContain(SLICE_LAIR_ID);
    expect(s.hero.level).toBeGreaterThanOrEqual(level);
    teleport(s, SLICE_LAIR_ID);
    expect(win().runCompleted).toBe(false);
  });

  it('a new run starts with its initial state as the checkpoint', () => {
    const s = createGameState(10, 'slice');
    gainXp(s, 1000);
    restoreCheckpoint(s);
    expect(s.hero.level).toBe(1);
  });
});

describe('item stats and the merchant item shop', () => {
  it('stats per item: uncommon 2, epic 3, legendary 4, all different', () => {
    const rng = new Rng(77);
    const count = { common: 1, uncommon: 2, rare: 2, epic: 3, legendary: 4 } as const;
    for (const rarity of RARITY_ORDER) {
      for (let i = 0; i < 20; i++) {
        const it = rollItem(rng, rarity, i);
        expect(it.stats).toHaveLength(count[rarity]);
        expect(new Set(it.stats.map((x) => x.stat)).size).toBe(it.stats.length);
      }
    }
  });

  it('the merchant sells a random identified item for the chosen slot, never legendary or common', () => {
    const s = createGameState(12, 'slice');
    s.gold = MERCHANT_ITEMS.price * 30;
    for (let i = 0; i < 30; i++) {
      const it = buyItem(s, 'boots')!;
      expect(it.slot).toBe('boots');
      expect(it.identified).toBe(true);
      expect(['uncommon', 'rare', 'epic']).toContain(it.rarity);
    }
    expect(s.gold).toBe(0);
    expect(buyItem(s, 'hat')).toBeNull();
    expect(s.hero.bag).toHaveLength(30);
  });
});

describe('leaving town', () => {
  it('saves: an item identified in town stays identified after a death', () => {
    const s = createGameState(31, 'slice');
    restInTown(s);
    const item = rollItem(new Rng(3), 'rare', 500, 'boots');
    s.hero.bag.push(item);
    s.hero.consumables.magnifier = 1;
    expect(identifyItem(s.hero, 0)).toBe(true);
    leaveTown(s);
    restoreCheckpoint(s);
    expect(s.hero.bag[0]?.identified).toBe(true);
    expect(s.hero.consumables.magnifier).toBe(0);
  });

  it('rare items are clearly stronger than uncommon ones', () => {
    expect(RARITIES.rare.power).toBeGreaterThan(RARITIES.uncommon.power * 1.3);
  });
});

describe('item comparison', () => {
  it('lists every stat that changes, better positive and worse negative', () => {
    const mk = (stats: { stat: 'armor' | 'hpPct' | 'moveSpeedPct'; value: number }[]) => ({ ...rollItem(new Rng(1), 'rare', 1, 'boots'), stats, identified: true });
    const worn = mk([{ stat: 'moveSpeedPct', value: 0.2 }, { stat: 'armor', value: 3 }]);
    const item = mk([{ stat: 'moveSpeedPct', value: 0.25 }, { stat: 'hpPct', value: 0.04 }]);
    const diff = compareItems(item, worn);
    expect(diff).toContainEqual({ stat: 'moveSpeedPct', value: 0.05 });
    expect(diff).toContainEqual({ stat: 'hpPct', value: 0.04 });
    expect(diff).toContainEqual({ stat: 'armor', value: -3 });
    expect(formatStatDelta({ stat: 'armor', value: -3 })).toBe('−3 броні');
    expect(compareItems(worn, worn)).toHaveLength(0);
  });

  it('miniboss drops at most uncommon; the boss mostly common, legendary rare', () => {
    const total = (w: Partial<Record<string, number>>): number => Object.values(w).reduce<number>((a, x) => a + (x ?? 0), 0);
    expect(Object.keys(LOOT.miniboss.weights).sort()).toEqual(['common', 'uncommon']);
    const boss = LOOT.boss.weights;
    expect((boss.common ?? 0) / total(boss)).toBeGreaterThan(0.55);
    expect((boss.legendary ?? 0) / total(boss)).toBeLessThan(0.05);
    expect(MERCHANT_ITEMS.weights.legendary ?? 0).toBe(0);
  });
});

describe('item level', () => {
  it('higher item level: stronger flat stats, percent stats grow slower, pricier; capped at 300', () => {
    const low = rollItem(new Rng(8), 'rare', 1, 'weapon', 10);
    const high = rollItem(new Rng(8), 'rare', 2, 'weapon', 40);
    const top = rollItem(new Rng(8), 'rare', 3, 'weapon', 999);
    expect([low.ilvl, high.ilvl, top.ilvl]).toEqual([10, 40, ITEM_LEVEL.max]);
    const attack = (it: typeof low): number => it.stats.find((s) => s.stat === 'attack')!.value;
    expect(attack(high)).toBeGreaterThan(attack(low));
    expect(attack(top)).toBeGreaterThan(attack(high) * 3);
    const extra = (it: typeof low): number => it.stats[1]!.value;
    expect(extra(top) / extra(high)).toBeLessThan(attack(top) / attack(high));
    high.identified = low.identified = true;
    expect(sellPrice(high)).toBeGreaterThan(sellPrice(low));
  });

  it('item level follows the location tier: first locations up to 40, the edge of the world up to 300', () => {
    expect(itemLevelRange(1)[1]).toBeLessThanOrEqual(40);
    expect(itemLevelRange(1.3)[1]).toBe(40);
    expect(itemLevelRange(4.5)[1]).toBe(ITEM_LEVEL.max);
    for (let t = 1; t < 4.5; t += 0.1) expect(itemLevelRange(t + 0.1)[1]).toBeGreaterThanOrEqual(itemLevelRange(t)[1]);
  });

  it('drops stay within the location range: bosses near the top, minibosses climb with the wave', () => {
    const range = itemLevelRange(1.3);
    const rng = new Rng(21);
    const levels = (source: 'miniboss' | 'boss', wave: number): number[] => Array.from({ length: 200 }, () => dropItemLevel(rng, range, source, wave));
    const avg = (xs: number[]): number => xs.reduce((a, x) => a + x, 0) / xs.length;
    for (const xs of [levels('miniboss', 3), levels('miniboss', 30), levels('boss', 1)]) {
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(range[0]);
      expect(Math.max(...xs)).toBeLessThanOrEqual(range[1]);
    }
    expect(avg(levels('miniboss', 3))).toBeLessThan(avg(levels('miniboss', 12)));
    expect(Math.min(...levels('boss', 1))).toBeGreaterThan(Math.max(...levels('miniboss', 3)));
  });

  it('loot from a battle and merchant items carry the level of the location', () => {
    const s = createGameState(5, 'slice');
    teleport(s, SLICE_GROVE_ID);
    const b = createBattle(s, SLICE_GROVE_ID);
    const boss = createBossEnemy(b, 'enat', { x: 500, y: 300 });
    damageEnemy(b, boss, { amount: 1e7, crit: false }, { source: 'skill' });
    for (const it of b.stats.loot) expect(it.ilvl).toBeLessThanOrEqual(40);
    const [lo, hi] = merchantItemLevels(s);
    expect(lo).toBeGreaterThanOrEqual(itemLevelRange(1)[0]);
    expect(hi).toBeLessThanOrEqual(40);
    s.gold = MERCHANT_ITEMS.price;
    const bought = buyItem(s, 'hat')!;
    expect(bought.ilvl).toBeGreaterThanOrEqual(lo);
    expect(bought.ilvl).toBeLessThanOrEqual(hi);
  });
});
