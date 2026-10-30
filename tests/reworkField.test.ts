// The rework's field (ROADMAP 20.1): the hero walks inside the location, the dummies run at him
// and never stand inside him.
import { describe, expect, it } from 'vitest';
import { REWORK_STRESS } from '../src/data/rework';
import { createField, spawnDummies, stepField } from '../src/systems/rework/field';

describe('rework field', () => {
  it('puts exactly the asked number of dummies', () => {
    const f = createField(1);
    for (const n of REWORK_STRESS.counts) {
      spawnDummies(f, n);
      expect(f.dummies.length).toBe(n);
    }
    spawnDummies(f, 0);
    expect(f.dummies.length).toBe(0);
  });

  it('the hero walks where told and stays inside the location', () => {
    const f = createField(2);
    const x0 = f.hero.pos.x;
    for (let i = 0; i < 60; i++) stepField(f, 1 / 60, { x: 1, y: 0 });
    expect(f.hero.pos.x).toBeGreaterThan(x0);
    for (let i = 0; i < 60 * 60; i++) stepField(f, 1 / 60, { x: 1, y: 1 });
    expect(f.hero.pos.x).toBeLessThanOrEqual(f.width);
    expect(f.hero.pos.y).toBeLessThanOrEqual(f.height);
  });

  it('dummies close in on the hero but do not stand inside him', () => {
    const f = createField(3);
    spawnDummies(f, 300);
    const dist = (): number => Math.min(...f.dummies.map((d) => Math.hypot(d.pos.x - f.hero.pos.x, d.pos.y - f.hero.pos.y)));
    const before = dist();
    for (let i = 0; i < 60 * 20; i++) stepField(f, 1 / 60, { x: 0, y: 0 });
    expect(dist()).toBeLessThan(before);
    expect(dist()).toBeGreaterThanOrEqual(REWORK_STRESS.radius + f.hero.radius - 1);
  });
});
