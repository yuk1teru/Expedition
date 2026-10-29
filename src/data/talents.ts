// Talent trees (ROADMAP 12.1, 12.3; the draft is docs/archive/TALENTS.md): every class has three rows of
// skills and passives (the archer — arrow types too). Row 2 opens after 5 points in the tree,
// row 3 after 10. Points come with levels and quests; the whole tree costs far more than a
// hero ever gets, so every hero is a choice. Editable in the wiki.

import type { Element } from './elements';

export interface TalentRow {
  skills: string[];
  passives: string[];
  /** Archer: arrow types opened in this row. */
  arrows?: Element[];
}

export const TALENT_TREES: Record<string, TalentRow[]> = {
  warrior: [
    { skills: ['whirlwind', 'charge', 'groundSlam'], passives: ['armor'] },
    { skills: ['axeThrow', 'hook', 'battleCry'], passives: ['vampirism'] },
    { skills: ['earthquake', 'ironSkin'], passives: ['fervor'] },
  ],
  mage: [
    { skills: ['fireball', 'frostRing', 'magicMissiles'], passives: ['spellPower'] },
    { skills: ['chainLightning', 'teleport', 'iceBarrier'], passives: ['focus'] },
    { skills: ['flameWall', 'vortex'], passives: ['arcaneBarrier'] },
  ],
  archer: [
    { skills: ['multishot', 'arrowRain', 'piercingShot'], passives: ['precision'], arrows: ['fire'] },
    { skills: ['hunterTrap', 'vault', 'hunterMark'], passives: ['agility'], arrows: ['water', 'poison'] },
    { skills: ['net', 'barrage'], passives: ['piercing'], arrows: ['wind'] },
  ],
};

export const TALENTS = {
  /** Points in the tree needed to open each row (row 1, 2, 3). */
  rowUnlock: [0, 5, 10],
  /** Price of each skill rank: opening (rank 1), ranks 2, 3, 4, 5. */
  rankCost: [1, 1, 1, 2, 2],
  /** Price of one passive stack. */
  passiveCost: 1,
  /** Price of an arrow type. */
  arrowCost: 1,
  /** A point every level from this one on. */
  pointsFrom: 4,
  /** …and one more every this many levels. */
  bonusEvery: 5,
  /** Skills on the panel keys 1–5 (the branch ones go to R and F). */
  classSlots: 5,
};

/** The class teacher (ROADMAP 12.9): resets the tree for gold — base + perLevel × hero level. */
export const TEACHERS = {
  /** Who teaches which class (NPCs in the capital). */
  byClass: { warrior: 'warriorTeacher', mage: 'mageTeacher', archer: 'archerTeacher' } as Record<string, string>,
  resetBase: 20,
  resetPerLevel: 10,
};
