import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { ITEM_BASES, LOOT } from '../src/data/items';
import { createBattle, stepBattle } from '../src/systems/battle';
import { damageEnemy } from '../src/systems/combat';
import { createBossEnemy } from '../src/systems/boss';
import { assignClass } from '../src/systems/hero';
import { equipFromBag, hasNewItems, markItemsSeen, rollItem, stashLoot } from '../src/systems/items';
import { gainXp } from '../src/systems/leveling';
import { SLICE_GROVE_ID, SLICE_LAIR_ID, getNode, markCleared } from '../src/systems/mapgen';
import { completeBattle, createGameState, restInTown, restoreCheckpoint, teleport } from '../src/systems/run';

describe('items', () => {
  it('epic items are stronger than common ones and have an extra stat', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 50; i++) {
      const c = rollItem(rng, 'common', i, 'weapon');
      const e = rollItem(rng, 'epic', i, 'weapon');
      expect(c.stats).toHaveLength(1);
      expect(e.stats).toHaveLength(2);
      expect(e.stats[0]!.value).toBeGreaterThan(c.stats[0]!.value);
      expect(e.stats[0]!.value).toBeLessThanOrEqual(ITEM_BASES.weapon.main.epic[1]);
    }
  });

  it('loot goes to the bag as new; wearing is manual and swaps with the worn item', () => {
    const s = createGameState(1);
    const atk0 = s.hero.stats.attack;
    const rng = new Rng(2);
    const a = rollItem(rng, 'common', 1, 'weapon');
    const b = rollItem(rng, 'epic', 2, 'weapon');
    stashLoot(s.hero, a);
    stashLoot(s.hero, b);
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

  it('miniboss drops common loot, boss drops epic loot', () => {
    const s = createGameState(5);
    teleport(s, SLICE_GROVE_ID);
    const b = createBattle(s, SLICE_GROVE_ID);
    const mini = createBossEnemy(b, 'alpha', { x: 300, y: 300 });
    damageEnemy(b, mini, { amount: 1e6, crit: false }, { source: 'skill' });
    expect(b.stats.loot).toHaveLength(LOOT.miniboss.count);
    expect(b.stats.loot.every((i) => i.rarity === 'common')).toBe(true);
    const boss = createBossEnemy(b, 'enat', { x: 500, y: 300 });
    damageEnemy(b, boss, { amount: 1e7, crit: false }, { source: 'skill' });
    expect(b.stats.loot.filter((i) => i.rarity === 'epic')).toHaveLength(LOOT.boss.count);
  });
});

describe('checkpoint', () => {
  it('death returns the hero to the last rest, keeping run statistics', () => {
    const s = createGameState(9);
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
    expect(s.currentNodeId).toBe('town');
  });

  it('saving works even if a battle ended mid-dash', () => {
    const s = createGameState(12);
    s.hero.dash = { from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, time: 0, duration: 1, onArrive: () => {} };
    expect(() => restInTown(s)).not.toThrow();
    expect(s.checkpoint.hero.dash).toBeNull();
  });

  it('a boss victory saves the checkpoint; death afterwards keeps it; victory screen only once', () => {
    const s = createGameState(14);
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
    const s = createGameState(10);
    gainXp(s, 1000);
    restoreCheckpoint(s);
    expect(s.hero.level).toBe(1);
  });
});
