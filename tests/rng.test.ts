import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { resolveSeed } from '../src/core/seed';

function seq(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => rng.next());
}

describe('Rng', () => {
  it('same seed gives the same sequence', () => {
    expect(seq(new Rng(123), 50)).toEqual(seq(new Rng(123), 50));
  });

  it('different seeds give different sequences', () => {
    expect(seq(new Rng(1), 10)).not.toEqual(seq(new Rng(2), 10));
  });

  it('forks are deterministic, independent of parent consumption and of each other', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    seq(b, 7);
    expect(seq(a.fork('cards'), 20)).toEqual(seq(b.fork('cards'), 20));
    expect(seq(a.fork('cards'), 20)).not.toEqual(seq(a.fork('map'), 20));
    expect(seq(a.fork('cards'), 20)).not.toEqual(seq(new Rng(42), 20));
  });

  it('int/float/pick/shuffle/weighted stay in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const n = r.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      const f = r.float(-1, 1);
      expect(f).toBeGreaterThanOrEqual(-1);
      expect(f).toBeLessThan(1);
      expect(['a', 'b']).toContain(r.pick(['a', 'b']));
      expect(r.weighted([{ item: 'x', weight: 0 }, { item: 'y', weight: 1 }])).toBe('y');
    }
    const arr = [1, 2, 3, 4, 5, 6];
    expect(r.shuffle(arr).sort()).toEqual(arr);
  });

  it('weighted roughly follows weights', () => {
    const r = new Rng(99);
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (r.weighted([{ item: 1, weight: 3 }, { item: 0, weight: 1 }]) === 1) hits++;
    expect(hits / 10000).toBeGreaterThan(0.7);
    expect(hits / 10000).toBeLessThan(0.8);
  });
});

describe('resolveSeed', () => {
  it('reads ?seed= from the URL', () => {
    expect(resolveSeed('http://x/?seed=123')).toBe(123);
    expect(resolveSeed('/?a=1&seed=77')).toBe(77);
  });

  it('falls back to a random seed', () => {
    expect(resolveSeed('http://x/', () => 0.5)).toBeGreaterThan(0);
    expect(resolveSeed('http://x/?seed=abc', () => 0.25)).toBeGreaterThan(0);
  });
});
