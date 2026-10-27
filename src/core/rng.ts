// Deterministic seeded RNG (mulberry32) with labelled sub-streams.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash, used to derive sub-stream seeds from labels. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Weighted<T> {
  item: T;
  weight: number;
}

export class Rng {
  readonly seed: number;
  /** mulberry32 state: saved with the game so a loaded hero continues the same streams. */
  state: number;

  constructor(seed: number, state?: number) {
    this.seed = seed >>> 0;
    this.state = (state ?? this.seed) >>> 0;
  }

  /** Float in [0, 1) (the same sequence as `mulberry32(seed)`). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    return arr[Math.floor(this.next() * arr.length)] as T;
  }

  /** Returns a shuffled copy (Fisher–Yates). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  weighted<T>(items: readonly Weighted<T>[]): T {
    let total = 0;
    for (const w of items) total += Math.max(0, w.weight);
    if (items.length === 0 || total <= 0) throw new Error('Rng.weighted: no positive weights');
    let roll = this.next() * total;
    for (const w of items) {
      roll -= Math.max(0, w.weight);
      if (roll < 0) return w.item;
    }
    return (items[items.length - 1] as Weighted<T>).item;
  }

  /**
   * Independent stream derived from this RNG's seed and a label.
   * Does not consume values from the parent, so subsystems stay independent.
   */
  fork(label: string): Rng {
    return new Rng((this.seed ^ hashString(label) ^ 0x9e3779b9) >>> 0);
  }
}
