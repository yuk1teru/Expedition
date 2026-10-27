// The invasion (ROADMAP 10.3): a visible 0–100% scale that grows with the days and makes
// enemies stronger. Its thresholds bring events (ROADMAP 15.2): raids on cleared locations
// from 25%, a captured land at 50% (a quest wins it back), an attack on a town at 75%;
// at 100% the dead besiege the capital (stage 17).
// Names inside texts — references (src/data/names.ts).

export const INVASION = {
  /** Percent of the scale per day (every won battle is a day). */
  perDay: 1,
  /** Enemy HP and damage at 100%: × (1 + this); in between — in proportion. */
  strengthAt100: 0.4,
  thresholds: [
    {
      at: 25,
      title: 'Навала: набіги',
      text: 'Мерці з {name:dead:of} пробують кордони: загони нападають на дороги й локації. Що довше зволікаєш, то сміливіші вони стають.',
    },
    {
      at: 50,
      title: 'Навала: край захоплено',
      text: 'Мерці захопили цілий край. Без допомоги він не встоїть — шукай доручення, щоб його відбити.',
    },
    {
      at: 75,
      title: 'Навала: місто в небезпеці',
      text: 'Мерці підступили до одного з міст. Ворота тримаються, але недовго.',
    },
    {
      at: 100,
      title: 'Навала: облога столиці',
      text: '{name:lord} веде мерців на {town:capital:acc}. Облога почалася — усі, хто може тримати зброю, мають бути на стінах.',
    },
  ],
};

/** The events of the thresholds (ROADMAP 15.2). */
export const INVASION_EVENTS = {
  raid: {
    /** From this percent on, a raid every `every` days on a cleared location (not a boss lair). */
    from: 25,
    every: 7,
    /** Not driven off in this many days — the location falls (it has to be cleared again). */
    days: 10,
    /** The dead among the beasts: this share of every wave. */
    raider: 'deadRaider',
    raiderShare: 0.35,
    /** Enemies of a raided location (and of a captured land) are this much stronger. */
    enemyMult: 1.25,
    /** Driven off: × the location's clear bonus in gold. */
    gold: 1,
  },
  captured: {
    at: 50,
    /** The lands that can be captured, in this order (the first whose boss lives): the quest that wins each back. */
    quests: { forest: 'reclaimForest' } as Record<string, string>,
  },
  townAttack: {
    at: 75,
    /** Waves of the battle at the gates. */
    waves: 3,
    gold: 150,
  },
};
