import { describe, expect, it } from 'vitest';
import { WORLD_NODES } from '../src/data/world';
import { markVisited, revealSecret, visibleNodes } from '../src/systems/fog';
import { getNode, markCleared, neighbours } from '../src/systems/mapgen';
import { createGameState, teleport } from '../src/systems/run';
import { fromSave, readSave, toSave, writeSave } from '../src/systems/save';

describe('fog of war', () => {
  it('a new hero sees the capital and the places next to it only', () => {
    const s = createGameState(1);
    const seen = visibleNodes(s);
    expect([...seen].sort()).toEqual(['capital', ...neighbours(s.world, 'capital')].sort());
    expect(seen.has('iceCitadel')).toBe(false);
  });

  it('visiting or clearing a place opens its neighbours; the debug switch shows all', () => {
    const s = createGameState(1);
    teleport(s, 'quietGrove');
    for (const n of neighbours(s.world, 'quietGrove')) expect(visibleNodes(s).has(n)).toBe(true);
    markCleared(getNode(s.world, 'darkThicket'));
    expect(visibleNodes(s).has('enatLair')).toBe(true);
    s.noFog = true;
    expect(visibleNodes(s).size).toBe(s.world.nodes.length);
  });

  it('a secret place stays hidden next door until revealed', () => {
    const def = WORLD_NODES.find((n) => n.id === 'wolfTrail')!;
    def.secret = true;
    try {
      const s = createGameState(1);
      expect(visibleNodes(s).has('wolfTrail')).toBe(false);
      revealSecret(s, 'wolfTrail');
      expect(visibleNodes(s).has('wolfTrail')).toBe(true);
      const t = createGameState(1);
      markVisited(t, 'wolfTrail');
      expect(visibleNodes(t).has('wolfTrail')).toBe(true);
    } finally {
      delete def.secret;
    }
  });

  it('what the hero has seen is saved', () => {
    const s = createGameState(1);
    teleport(s, 'quietGrove');
    revealSecret(s, 'x');
    const l = fromSave(readSave(writeSave(toSave(s)))!);
    expect(l.nodesVisited).toContain('quietGrove');
    expect(l.revealed).toEqual(['x']);
  });
});
