// A location is a trip through several arenas (ROADMAP 13.2): the entrance, then a fork (two
// of: a gift altar, a treasure with an ambush, an objective), then the lair with the
// miniboss and a chest. Transition zones and the prologue road are shorter (entrance and
// lair); a boss lair is an antechamber and the boss. HP does not come back between arenas.

export type ArenaStepKind = 'entrance' | 'altar' | 'treasure' | 'objective' | 'lair' | 'antechamber' | 'boss';

export const EXPEDITION = {
  /** Waves of each kind of arena. */
  waves: { entrance: 2, altar: 1, treasure: 1, objective: 1, lair: 1, antechamber: 1, boss: 0 } as Record<ArenaStepKind, number>,
  /** The fork offers two of these. */
  forkKinds: ['altar', 'treasure'] as ArenaStepKind[],
  /** Regions whose locations are short (entrance and lair only). */
  shortRegions: ['coast', 'swampEdge', 'scrub', 'mountain'],
  /** The treasure chest: × the location's clear bonus in gold, and an item. */
  treasureGold: 1.5,
  /** The treasure's ambush wave is this much bigger. */
  treasureWaveMult: 1.4,
  /** The lair's chest: × the clear bonus in gold. */
  lairGold: 0.5,
};

/** Names and lines of the arenas (the "way on" window, the wiki). */
export const STEP_INFO: Record<ArenaStepKind, { name: string; text: string }> = {
  entrance: { name: 'Вхід', text: 'Перші хвилі на підступах.' },
  altar: { name: 'Вівтар дару', text: 'Старий вівтар. Відбийся — і він дасть дар (раз на локацію).' },
  treasure: { name: 'Скарб і засідка', text: 'Скриня з добром — але її стережуть: більша хвиля.' },
  objective: { name: 'Завдання', text: 'Особлива арена зі своєю ціллю.' },
  lair: { name: 'Лігво', text: 'Остання хвиля з мінібосом і скриня.' },
  antechamber: { name: 'Передпокій', text: 'Варта перед лігвом боса.' },
  boss: { name: 'Бос', text: 'Господар цього краю.' },
};
