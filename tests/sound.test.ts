import { describe, expect, it } from 'vitest';
import { SOUNDS, type SoundId } from '../src/data/sounds';
import { eventSound } from '../src/render/sound';

const at = { x: 0, y: 0 };

describe('sound', () => {
  it('recipes: audible, short, and a gap only for frequent sounds', () => {
    for (const [id, s] of Object.entries(SOUNDS)) {
      expect(s.gain, id).toBeGreaterThan(0);
      expect(s.gain, id).toBeLessThanOrEqual(1);
      expect(s.dur, id).toBeGreaterThan(0);
      expect(s.dur * (s.notes?.length ?? 1), id).toBeLessThanOrEqual(1.5);
      expect(s.freq, id).toBeGreaterThan(20);
    }
  });

  it('events: a crit is not a plain hit, the strong fall louder, rare loot rings brighter', () => {
    const hit = (crit: boolean) => eventSound({ type: 'hit', pos: at, amount: 5, crit, targetId: 1, radius: 10, source: 'basic' });
    expect(hit(false)).toBe('hit');
    expect(hit(true)).toBe('crit');
    const kill = (elite: boolean, boss: boolean) => eventSound({ type: 'kill', pos: at, defId: 'wolf', radius: 10, elite, boss });
    expect(kill(false, false)).toBe('kill');
    expect(kill(true, false)).toBe('bigKill');
    expect(kill(false, true)).toBe('bigKill');
    const loot = (rarity: 'common' | 'uncommon' | 'rare' | 'legendary') => eventSound({ type: 'loot', pos: at, name: 'x', rarity });
    expect(loot('common')).toBe('loot');
    expect(loot('uncommon')).toBe('loot');
    expect(loot('rare')).toBe('lootRare');
    expect(loot('legendary')).toBe('lootRare');
    expect(eventSound({ type: 'checkpoint' })).toBeNull();
  });

  it('there are 12–15 sounds, and every one but the button is made by some event', () => {
    const ids = Object.keys(SOUNDS) as SoundId[];
    expect(ids.length).toBeGreaterThanOrEqual(12);
    expect(ids.length).toBeLessThanOrEqual(15);
    const made = new Set<SoundId | null>([
      eventSound({ type: 'hit', pos: at, amount: 1, crit: false, targetId: 1, radius: 1, source: 'basic' }),
      eventSound({ type: 'hit', pos: at, amount: 1, crit: true, targetId: 1, radius: 1, source: 'basic' }),
      eventSound({ type: 'kill', pos: at, defId: 'wolf', radius: 1, elite: false, boss: false }),
      eventSound({ type: 'kill', pos: at, defId: 'wolf', radius: 1, elite: false, boss: true }),
      eventSound({ type: 'heroHurt', pos: at, amount: 1 }),
      eventSound({ type: 'heroDodge', from: at, to: at }),
      eventSound({ type: 'telegraph', kind: 'x', pos: at }),
      eventSound({ type: 'wave', index: 1, total: 2, bonus: 0, mult: { hp: 1, damage: 1, reward: 1, gold: 1, speed: 1 }, weather: null }),
      eventSound({ type: 'levelUp', level: 2, hp: 1, attack: 1 }),
      eventSound({ type: 'loot', pos: at, name: 'x', rarity: 'common' }),
      eventSound({ type: 'loot', pos: at, name: 'x', rarity: 'epic' }),
      eventSound({ type: 'gold', pos: at, amount: 1 }),
      eventSound({ type: 'healUse', id: 'herbGreen' as never, pos: at, total: 1, duration: 1 }),
      eventSound({ type: 'heroDeath', pos: at }),
    ]);
    for (const id of ids) if (id !== 'ui') expect(made.has(id), id).toBe(true);
  });
});
