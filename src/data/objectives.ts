// Arena objectives (ROADMAP 13.3): the fork of a location trip may lead to an arena with its
// own goal instead of plain waves. Nests — break them, they keep hatching the location's
// monsters; rescue — stand by the captive until they are free while the monsters come.

export type ObjectiveKind = 'nests' | 'rescue';

export const OBJECTIVES = {
  nests: {
    count: 3,
    /** Base HP of a nest (tier 1; grows with the location like monsters do). */
    hp: 70,
    radius: 22,
    /** Seconds between hatchings of one nest (the first one comes sooner). */
    hatchEvery: 5,
    firstHatch: 2,
    /** No hatching while this many monsters are alive. */
    maxAlive: 12,
    /** Hatched monsters give this share of XP (no gold). */
    hatchXp: 0.5,
    /** XP of a nest, as a monster's base XP. */
    xp: 12,
  },
  rescue: {
    /** Stand within this many px of the captive. */
    radius: 75,
    /** Seconds next to the captive to free them. */
    time: 20,
    /** A group of monsters comes this often, from the edge. */
    groupEvery: 3.5,
    groupSize: 3,
    maxAlive: 14,
  },
  /** Gold of a won objective arena: × the location's clear bonus. */
  gold: 1,
};

/** Names and lines (the "way on" window, the HUD, the wiki). */
export const OBJECTIVE_INFO: Record<ObjectiveKind, { name: string; text: string; goal: string }> = {
  nests: { name: 'Гнізда', text: 'Гнізда плодять звірину, доки стоять. Розбий усі три.', goal: 'Зруйнуйте гнізда' },
  rescue: { name: 'Порятунок', text: 'Полонений чекає допомоги. Стій поруч, доки його звільниш, — а звірі лізуть.', goal: 'Стійте біля полоненого' },
};
