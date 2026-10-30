// The rework's new core (ROADMAP stage 20, VISION.md): numbers of the "Реворк: Ліс" mode.
// Step 20.1 — an empty field, the hero walking on it and a stress test with dummy enemies.

export const REWORK_FIELD = {
  /** The location: about 4 × 4 screens, world px. */
  width: 3840,
  height: 2160,
  /** Grass patches on the ground (so walking is visible). */
  patches: 900,
  hero: {
    /** World px per second. */
    speed: 120,
    radius: 14,
  },
};

/** Stress test (20.1): how many dummies the buttons put on the field and how they move. */
export const REWORK_STRESS = {
  counts: [100, 300, 500],
  /** Dummies appear on a ring around the hero, this far (world px). */
  spawnMin: 500,
  spawnMax: 1100,
  speed: 70,
  radius: 12,
  /** Drawn from the warrior's walk frames, this tall on screen. */
  height: 48,
  /** Neighbour search cell (world px) for pushing dummies apart. */
  cell: 32,
};
