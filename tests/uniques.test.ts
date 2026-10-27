import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { CLASSES } from '../src/data/classes';
import { getSkill, skillParams } from '../src/data/skills';
import { ITEM_SETS, LEGENDARIES } from '../src/data/uniques';
import { giftSkillParams } from '../src/systems/gifts';
import { assignClass, recomputeHeroStats } from '../src/systems/hero';
import { type Item, rollItem } from '../src/systems/items';
import { createGameState, teleport } from '../src/systems/run';
import { createBattle } from '../src/systems/battle';
import { killEnemy } from '../src/systems/combat';
import { affixCooldownMult, effectiveRank, maybeSetPiece } from '../src/systems/uniques';

function warrior() {
  const s = createGameState(6);
  s.hero.level = 3;
  assignClass(s.hero, 'warrior', ['whirlwind', 'charge']);
  return s;
}

function wear(s: ReturnType<typeof warrior>, item: Item) {
  item.identified = true;
  s.hero.equipment[item.slot] = item;
  recomputeHeroStats(s.hero);
}

describe('items with effects', () => {
  it('a boss’s own legendary drops at its first defeat and never at random', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 200; i++) expect(LEGENDARIES[rollItem(rng, 'legendary', i, undefined, 20, 'warrior').legendary!]!.boss).toBeUndefined();
    const s = warrior();
    teleport(s, 'enatLair');
    const b = createBattle(s, 'enatLair');
    killEnemy(b, b.boss!);
    expect(b.stats.loot.some((x) => x.legendary === 'enatBark')).toBe(true);
    s.bossesDefeated.push('enatLair');
    const again = createBattle(s, 'enatLair');
    killEnemy(again, again.boss!);
    expect(again.stats.loot.some((x) => x.legendary === 'enatBark')).toBe(false);
  });

  it('data: legendaries change a real skill of their class, two per class', () => {
    const per: Record<string, number> = {};
    for (const l of Object.values(LEGENDARIES)) {
      if (!l.classId) continue;
      per[l.classId] = (per[l.classId] ?? 0) + 1;
      for (const e of l.effects) {
        if (e.kind !== 'skill') continue;
        expect(getSkill(e.skill).classId, l.id).toBe(l.classId);
        expect(CLASSES[l.classId]!.skills, l.id).toContain(e.skill);
      }
    }
    for (const c of ['warrior', 'mage', 'archer']) expect(per[c], c).toBeGreaterThanOrEqual(2);
  });

  it('a legendary drop carries its power, most often of the hero’s class; worn, it changes the skill', () => {
    const s = warrior();
    const rng = new Rng(3);
    let own = 0;
    for (let i = 0; i < 60; i++) {
      const it = rollItem(rng, 'legendary', 1000 + i, undefined, 20, 'warrior');
      expect(it.legendary, 'every legendary has a power').toBeDefined();
      if (LEGENDARIES[it.legendary!]!.classId === 'warrior') own++;
    }
    expect(own).toBeGreaterThan(30);
    const axe = rollItem(rng, 'legendary', 2000, 'weapon', 20, 'warrior');
    axe.legendary = 'stormAxe';
    const before = giftSkillParams(s.hero, 'whirlwind', skillParams('whirlwind', 1)).radius!;
    wear(s, axe);
    expect(giftSkillParams(s.hero, 'whirlwind', skillParams('whirlwind', 1)).radius).toBeGreaterThan(before);
  });

  it('skill affixes: for the hero’s class, far more often on better items; +1 rank (up to the max) and a cooldown cut', () => {
    const s = warrior();
    const rng = new Rng(9);
    let affixes = 0;
    let commons = 0;
    for (let i = 0; i < 200; i++) {
      if (rollItem(rng, 'common', i, undefined, 20, 'warrior').affix) commons++;
      expect(rollItem(rng, 'epic', 5000 + i, undefined, 20, null).affix, 'no class — no affix').toBeUndefined();
      const epic = rollItem(rng, 'epic', 500 + i, undefined, 20, 'warrior');
      if (epic.affix) {
        affixes++;
        expect(CLASSES.warrior!.skills).toContain(epic.affix.skill);
      }
    }
    expect(affixes).toBeGreaterThan(commons * 3);
    const hat = rollItem(rng, 'rare', 900, 'hat', 20, null);
    hat.affix = { kind: 'rank', skill: 'whirlwind', value: 1 };
    const boots = rollItem(rng, 'rare', 901, 'boots', 20, null);
    boots.affix = { kind: 'cooldown', skill: 'whirlwind', value: 0.2 };
    wear(s, hat);
    wear(s, boots);
    expect(effectiveRank(s.hero, 'whirlwind', 1)).toBe(2);
    expect(effectiveRank(s.hero, 'whirlwind', 5)).toBe(5);
    expect(effectiveRank(s.hero, 'charge', 1)).toBe(1);
    expect(affixCooldownMult(s.hero, 'whirlwind')).toBeCloseTo(0.8);
  });

  it('the Forest set: pieces from the Forest only; 2 and 4 worn pieces give their bonuses', () => {
    const s = warrior();
    const rng = new Rng(5);
    let pieces = 0;
    for (let i = 0; i < 100; i++) {
      const it = rollItem(rng, 'rare', i, undefined, 20, 'warrior');
      maybeSetPiece(rng, it, 'plains');
      expect(it.set).toBeUndefined();
      maybeSetPiece(rng, it, 'forest');
      if (it.set) pieces++;
    }
    expect(pieces).toBeGreaterThan(10);
    const hp0 = s.hero.maxHp;
    const set = ITEM_SETS.forest!;
    const slots = ['hat', 'armor', 'weapon', 'boots'] as const;
    const items = slots.map((slot, i) => {
      const it = rollItem(rng, 'common', 3000 + i, slot, 1, null);
      it.stats = [];
      it.set = set.id;
      return it;
    });
    wear(s, items[0]!);
    expect(s.hero.maxHp).toBe(hp0);
    wear(s, items[1]!);
    expect(s.hero.maxHp).toBeGreaterThan(hp0);
    const speed = s.hero.stats.attackSpeed;
    wear(s, items[2]!);
    wear(s, items[3]!);
    expect(s.hero.stats.attackSpeed).toBeGreaterThan(speed);
  });
});

describe('the sets and boss legendaries of every land (ROADMAP 16)', () => {
  it('each land with a boss has its set and its boss legendary; each set drops only in its land', async () => {
    const { WORLD_NODES } = await import('../src/data/world');
    const { BOSSES } = await import('../src/data/bosses');
    for (const n of WORLD_NODES.filter((x) => x.kind === 'boss')) {
      expect(Object.values(ITEM_SETS).some((s) => s.region === n.region), n.region).toBe(true);
      const boss = n.boss ?? '';
      expect(BOSSES[boss], n.id).toBeDefined();
      expect(Object.values(LEGENDARIES).some((l) => l.boss === boss), boss).toBe(true);
    }
  });
});
