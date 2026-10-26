// All balance numbers and tunable constants live here.

/** Logical resolution and loop timing. */
export const VIEW = {
  width: 960,
  height: 540,
} as const;

export const LOOP = {
  /** Fixed simulation step, s. */
  step: 1 / 60,
  /** Max real time processed per frame, s. */
  maxFrame: 0.25,
  speeds: [1, 2],
} as const;
