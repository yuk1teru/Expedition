import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/data/quests';
import { TOWNS } from '../src/data/towns';
import { questsOffered } from '../src/systems/quests';
import { createGameState } from '../src/systems/run';

describe('the Smerekove chain and board (ROADMAP 15.1)', () => {
  it('the town chain has 4 steps, each opening the next', () => {
    const chain = ['forestWolves', 'forestSpores', 'forestAlpha', 'forestSpring'];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(QUESTS[chain[i]!]!.next).toBe(chain[i + 1]);
      expect(QUESTS[chain[i + 1]!]!.requires?.quests).toContain(chain[i]);
    }
  });

  it('the board stands in Smerekove and offers its errands from the start; they repeat', () => {
    expect(TOWNS.forestTown!.npcs.some((n) => n.id === 'forestBoard')).toBe(true);
    const s = createGameState(1);
    const offered = questsOffered(s, 'forestBoard');
    expect(offered.length).toBeGreaterThanOrEqual(3);
    for (const q of offered) expect(q.repeatable).toBe(true);
  });
});
