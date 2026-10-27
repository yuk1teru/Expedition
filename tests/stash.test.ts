import { describe, expect, it } from 'vitest';
import { STASH } from '../src/data/items';
import { fromStash, rollItem, toStash } from '../src/systems/items';
import { createGameState, restoreCheckpoint, saveCheckpoint } from '../src/systems/run';
import { fromSave, readSave, toSave } from '../src/systems/save';

function withItems(n: number) {
  const s = createGameState(3);
  for (let i = 0; i < n; i++) s.hero.bag.push(rollItem(s.lootRng, 'common', s.nextItemUid++));
  return s;
}

describe('stash (ROADMAP 14.7)', () => {
  it('items move between the bag and the stash; a full stash takes no more', () => {
    const s = withItems(STASH.size + 2);
    const first = s.hero.bag[0]!;
    expect(toStash(s, 0)).toBe(true);
    expect(s.stash).toEqual([first]);
    expect(s.hero.bag).not.toContain(first);
    expect(fromStash(s, 0)).toBe(true);
    expect(s.hero.bag).toContain(first);
    while (s.stash.length < STASH.size) expect(toStash(s, 0)).toBe(true);
    expect(toStash(s, 0)).toBe(false);
  });

  it('it is part of the checkpoint: a death does not copy items, a save keeps them', () => {
    const s = withItems(2);
    saveCheckpoint(s);
    toStash(s, 0);
    // A death before the next checkpoint: bag and stash go back together.
    restoreCheckpoint(s);
    expect(s.hero.bag).toHaveLength(2);
    expect(s.stash).toHaveLength(0);
    toStash(s, 0);
    saveCheckpoint(s);
    const loaded = fromSave(readSave(JSON.stringify(toSave(s)))!);
    expect(loaded.stash).toHaveLength(1);
    expect(loaded.hero.bag).toHaveLength(1);
  });
});
