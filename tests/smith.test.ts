import { describe, expect, it } from 'vitest';
import { getNpc } from '../src/data/npcs';
import { SMITH } from '../src/data/smith';
import { recomputeHeroStats } from '../src/systems/hero';
import { rollItem } from '../src/systems/items';
import { getNode, markCleared } from '../src/systems/mapgen';
import { createGameState } from '../src/systems/run';
import { removeStone, rerollPrice, rerollStat, smithMaxLevel, upgradeItem, upgradePrice } from '../src/systems/smith';

function withWeapon(rarity: 'common' | 'rare' = 'rare') {
  const s = createGameState(8);
  s.gold = 10_000;
  const item = rollItem(s.lootRng, rarity, s.nextItemUid++, 'weapon', 10);
  item.identified = true;
  s.hero.equipment.weapon = item;
  recomputeHeroStats(s.hero);
  return { s, item };
}

describe('smith', () => {
  it('every smith offers the forge in the talk', () => {
    for (const id of SMITH.at) {
      const npc = getNpc(id);
      expect(npc.nodes[npc.start]!.options.some((o) => o.action === 'openSmith'), id).toBe(true);
    }
  });

  it('a reroll costs gold, keeps the main stat kind and never doubles an extra stat', () => {
    const { s, item } = withWeapon();
    const main = item.stats[0]!.stat;
    for (let i = 0; i < 30; i++) {
      const gold = s.gold;
      expect(rerollStat(s, s.hero, item, 1 + (i % (item.stats.length - 1)))).toBe(true);
      expect(s.gold).toBe(gold - rerollPrice(item));
      expect(item.stats[0]!.stat).toBe(main);
      expect(new Set(item.stats.map((x) => x.stat)).size).toBe(item.stats.length);
    }
    s.gold = 0;
    expect(rerollStat(s, s.hero, item, 0)).toBe(false);
  });

  it('raising the level: up to the top of the hardest cleared location, stats grow, the hero gets them', () => {
    const { s, item } = withWeapon();
    markCleared(getNode(s.world, 'darkThicket'));
    const top = smithMaxLevel(s);
    expect(top).toBeGreaterThan(item.ilvl);
    const before = item.stats[0]!.value;
    const attack = s.hero.stats.attack;
    expect(upgradePrice(s, item)).toBeGreaterThan(0);
    expect(upgradeItem(s, s.hero, item)).toBe(true);
    expect(item.ilvl).toBe(top);
    expect(item.stats[0]!.value).toBeGreaterThan(before);
    expect(s.hero.stats.attack).toBeGreaterThan(attack);
    expect(upgradeItem(s, s.hero, item)).toBe(false);
  });

  it('taking a stone out returns it to the bag', () => {
    const { s, item } = withWeapon();
    item.stone = 'sandSoul';
    expect(removeStone(s, s.hero, item)).toBe(true);
    expect(item.stone).toBeUndefined();
    expect(s.hero.soulStones).toEqual(['sandSoul']);
    expect(removeStone(s, s.hero, item)).toBe(false);
  });
});
