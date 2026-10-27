import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/bosses';
import { ELEMENT_LEVEL_STEP, ELEMENT_ORDER, ELEMENT_TABLE, ENEMY_ELEMENTS, elementMultiplier } from '../src/data/elements';
import { ENEMIES } from '../src/data/enemies';
import { SKILLS } from '../src/data/skills';
import { createBattle } from '../src/systems/battle';
import { damageEnemy } from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/waves';
import { createGameState, teleport } from '../src/systems/run';

describe('elements', () => {
  it('the circle: water beats fire, fire — earth, earth — wind, wind — water (ice)', () => {
    expect(ELEMENT_TABLE.water.fire).toBeGreaterThan(1);
    expect(ELEMENT_TABLE.fire.earth).toBeGreaterThan(1);
    expect(ELEMENT_TABLE.earth.wind).toBeGreaterThan(1);
    expect(ELEMENT_TABLE.wind.water).toBeGreaterThan(1);
    // An element against itself is resisted; neutral is always 100%.
    for (const e of ELEMENT_ORDER) {
      if (e !== 'neutral') expect(ELEMENT_TABLE[e][e], e).toBeLessThan(1);
      expect(ELEMENT_TABLE.neutral[e]).toBe(1);
      for (const d of ELEMENT_ORDER) expect(ELEMENT_TABLE[e][d]).toBeGreaterThanOrEqual(0);
    }
  });

  it('the defence level makes weaknesses and resistances stronger, within 0–200%', () => {
    expect(elementMultiplier('wind', { type: 'water', level: 1 })).toBeCloseTo(ELEMENT_TABLE.wind.water);
    expect(elementMultiplier('wind', { type: 'water', level: 3 })).toBeCloseTo(ELEMENT_TABLE.wind.water + 2 * ELEMENT_LEVEL_STEP);
    expect(elementMultiplier('water', { type: 'water', level: 3 })).toBe(Math.max(0, ELEMENT_TABLE.water.water - 2 * ELEMENT_LEVEL_STEP));
    for (const a of ELEMENT_ORDER) for (const d of ELEMENT_ORDER) for (const level of [1, 2, 3]) {
      const m = elementMultiplier(a, { type: d, level });
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(2);
    }
  });

  it('a shell lets only part of neutral damage through; elements pass it', () => {
    expect(elementMultiplier('neutral', { type: 'water', level: 1, shell: 0.6 })).toBe(0.6);
    expect(elementMultiplier('wind', { type: 'water', level: 1, shell: 0.6 })).toBeCloseTo(ELEMENT_TABLE.wind.water);
    expect(elementMultiplier('neutral', undefined)).toBe(1);
  });

  it('profiles name real enemies and bosses, with levels 1–3 and shells of 50–75%', () => {
    for (const [id, p] of Object.entries(ENEMY_ELEMENTS)) {
      expect(!!ENEMIES[id] || !!BOSSES[id], id).toBe(true);
      expect(p.level).toBeGreaterThanOrEqual(1);
      expect(p.level).toBeLessThanOrEqual(3);
      if (p.shell !== undefined) {
        expect(p.shell).toBeGreaterThanOrEqual(0.5);
        expect(p.shell).toBeLessThanOrEqual(0.75);
      }
    }
  });

  it('in battle a hit is multiplied by the element against the enemy profile', () => {
    const s = createGameState(1);
    teleport(s, 'quietGrove');
    const b = createBattle(s, 'quietGrove');
    const stump = spawnEnemy(b, 'stump', { x: 400, y: 300 });
    stump.hp = stump.maxHp = 1e6;
    stump.armor = 0;
    const before = stump.hp;
    damageEnemy(b, stump, { amount: 100, crit: false, element: 'fire' }, { source: 'skill' });
    expect(before - stump.hp).toBeCloseTo(100 * elementMultiplier('fire', ENEMY_ELEMENTS.stump));
    const mid = stump.hp;
    damageEnemy(b, stump, { amount: 100, crit: false }, { source: 'skill', element: 'neutral' });
    expect(mid - stump.hp).toBeCloseTo(100);
  });

  it('mage skills carry their elements; arrow skills take the chosen arrows', () => {
    expect(SKILLS.fireball!.element).toBe('fire');
    expect(SKILLS.frostRing!.element).toBe('water');
    expect(SKILLS.chainLightning!.element).toBe('wind');
    expect(SKILLS.multishot!.element).toBe('arrows');
  });
});
