import { describe, expect, it } from 'vitest';
import { LIVES } from '../src/data/balance';
import { amuletHint, claimSecret, placeAmulet } from '../src/systems/amulet';
import { isVisible } from '../src/systems/fog';
import { getNode } from '../src/systems/mapgen';
import { questsOffered, startQuest, questState } from '../src/systems/quests';
import { createGameState, restoreCheckpoint, saveCheckpoint } from '../src/systems/run';

describe('the Amulet of life (ROADMAP 16.6)', () => {
  it('exists only for a hero someone died before, in a secret place', () => {
    const s = createGameState(3);
    placeAmulet(s, false);
    expect(s.amulet).toBeNull();
    expect(amuletHint(s)).toBeNull();
    placeAmulet(s, true);
    expect(getNode(s.world, s.amulet!.nodeId).secret).toBe(true);
  });

  it('the place is hidden until a tombstone tells of it; then the priest asks to find it', () => {
    const s = createGameState(3);
    placeAmulet(s, true);
    const id = s.amulet!.nodeId;
    // Next to it, but secret: still hidden.
    s.nodesVisited.push(...s.world.edges.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a)));
    expect(isVisible(s, id)).toBe(false);
    expect(questsOffered(s, 'capitalPriest').map((q) => q.id)).not.toContain('systemAmulet');
    expect(amuletHint(s)).toContain(getNode(s.world, id).name);
    expect(isVisible(s, id)).toBe(true);
    expect(questsOffered(s, 'capitalPriest').map((q) => q.id)).toContain('systemAmulet');
  });

  it('clearing its place gives a life (up to the max) and meets the quest; elsewhere — a stash', () => {
    const s = createGameState(3);
    placeAmulet(s, true);
    amuletHint(s);
    startQuest(s, 'systemAmulet');
    const other = s.world.nodes.find((n) => n.secret && n.id !== s.amulet!.nodeId)!;
    const gold = s.gold;
    claimSecret(s, other, 3);
    expect(s.gold).toBeGreaterThan(gold);
    const lives = s.lives;
    claimSecret(s, getNode(s.world, s.amulet!.nodeId), 3);
    expect(s.lives).toBe(Math.min(LIVES.max, lives + 1));
    expect(s.amulet!.found).toBe(true);
    expect(questState(s, 'systemAmulet')!.step).toBe(1);
    // Once only.
    claimSecret(s, getNode(s.world, s.amulet!.nodeId), 3);
    expect(s.lives).toBe(Math.min(LIVES.max, lives + 1));
  });

  it('it is part of the checkpoint, like the life it gives', () => {
    const s = createGameState(3);
    placeAmulet(s, true);
    saveCheckpoint(s);
    claimSecret(s, getNode(s.world, s.amulet!.nodeId), 3);
    restoreCheckpoint(s);
    expect(s.amulet!.found).toBe(false);
  });
});
