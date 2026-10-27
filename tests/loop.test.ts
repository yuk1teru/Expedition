import { describe, expect, it } from 'vitest';
import { GameLoop } from '../src/core/loop';

function loop(): { l: GameLoop; steps: number[] } {
  const steps: number[] = [];
  const l = new GameLoop(
    { fixedUpdate: (dt) => steps.push(dt), frameUpdate: () => {}, render: () => {} },
    { requestFrame: () => {} },
    { step: 1 / 60, maxFrame: 0.25 },
  );
  return { l, steps };
}

describe('game loop', () => {
  it('runs fixed steps for the elapsed time and keeps the rest', () => {
    const { l, steps } = loop();
    l.tick(1 / 144);
    expect(steps.length).toBe(0);
    l.tick(1 / 144);
    l.tick(1 / 144);
    expect(steps.length).toBe(1);
  });

  it('alpha is the share of the next step already elapsed (frames draw between steps)', () => {
    const { l } = loop();
    l.tick(1 / 120);
    expect(l.alpha).toBeCloseTo(0.5, 5);
    l.tick(1 / 240);
    expect(l.alpha).toBeCloseTo(0.75, 5);
    l.tick(1 / 200);
    expect(l.alpha).toBeCloseTo(0.05, 5);
    expect(l.alpha).toBeGreaterThanOrEqual(0);
  });
});
