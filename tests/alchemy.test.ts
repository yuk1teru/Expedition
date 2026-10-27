import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/alchemy';
import { LIVES } from '../src/data/balance';
import { getNpc, NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { TROPHIES } from '../src/data/trophies';
import { brew, brewBlock, elixirArenaDone, getRecipe, recipeKnown } from '../src/systems/alchemy';
import { createBattle } from '../src/systems/battle';
import { createGameState, completeBattle, teleport } from '../src/systems/run';
import { addTrophy } from '../src/systems/trophies';

function stocked() {
  const s = createGameState(4);
  s.gold = 1000;
  for (const id of Object.keys(TROPHIES)) addTrophy(s, id, 20);
  return s;
}

describe('alchemy', () => {
  it('data: real parts and brewers; a quest recipe names a real quest; every brewer has the option in the talk', () => {
    for (const r of RECIPES) {
      for (const n of r.needs) expect(TROPHIES[n.trophy], `${r.id}: ${n.trophy}`).toBeDefined();
      for (const id of r.at) {
        expect(NPCS[id], `${r.id}: ${id}`).toBeDefined();
        const npc = getNpc(id);
        expect(npc.nodes[npc.start]!.options.some((o) => o.action === 'openAlchemy'), id).toBe(true);
      }
      if (r.quest) expect(QUESTS[r.quest], r.id).toBeDefined();
    }
  });

  it('brewing takes the parts and the gold; a potion goes to the bag up to its maximum', () => {
    const s = stocked();
    const r = getRecipe('potionSmall')!;
    const gold = s.gold;
    const parts = s.hero.trophies.sporeCap!;
    expect(brew(s, 'potionSmall')).toBe(true);
    expect(s.hero.consumables.potionSmall).toBe(1);
    expect(s.gold).toBe(gold - r.gold);
    expect(s.hero.trophies.sporeCap).toBe(parts - r.needs[0]!.count);
    while (brew(s, 'potionSmall'));
    expect(brewBlock(s, r)).not.toBeNull();
    s.hero.trophies = {};
    s.hero.consumables.potionSmall = 0;
    expect(brew(s, 'potionSmall')).toBe(false);
  });

  it('an elixir raises its stat for its arenas, one at a time, then wears off', () => {
    const s = stocked();
    const base = s.hero.stats.attackSpeed;
    const r = getRecipe('wolfBrew')!;
    expect(brew(s, 'wolfBrew')).toBe(true);
    expect(s.hero.stats.attackSpeed).toBeGreaterThan(base);
    const arenas = r.result.kind === 'elixir' ? r.result.arenas : 0;
    teleport(s, 'quietGrove');
    for (let i = 0; i < arenas - 1; i++) {
      const b = createBattle(s, 'quietGrove');
      b.outcome = 'won';
      completeBattle(s, b);
    }
    expect(s.hero.elixir?.arenas).toBe(1);
    elixirArenaDone(s.hero);
    expect(s.hero.elixir).toBeNull();
    expect(s.hero.stats.attackSpeed).toBeCloseTo(base);
  });

  it('the Elixir of return: known only after the doctor’s quest; +1 life up to the maximum', () => {
    const s = stocked();
    const r = getRecipe('returnElixir')!;
    expect(recipeKnown(s, r)).toBe(false);
    expect(brew(s, 'returnElixir')).toBe(false);
    s.quests.done.push(r.quest!);
    const lives = s.lives;
    expect(brew(s, 'returnElixir')).toBe(true);
    expect(s.lives).toBe(lives + 1);
    s.lives = LIVES.max;
    expect(brew(s, 'returnElixir')).toBe(false);
  });
});
