// The Endless tower (ROADMAP 18): it rises over the capital after the siege. Floor by floor
// the lands' monsters (the lands in turn), the level growing; a boss every 10 floors with
// modifiers — more of them the higher; {name:lord} on the 100th.

export interface BossModifier {
  name: string;
  hp?: number;
  damage?: number;
  speed?: number;
}

export const TOWER = {
  floors: 100,
  bossEvery: 10,
  /** Monster level of a floor: level0 + levelPerFloor × floor. */
  level0: 24,
  levelPerFloor: 0.5,
  /** Waves of an ordinary floor. */
  waves: 2,
  /** The lands whose monsters (and arenas) the floors take in turn. */
  lands: ['forest', 'swamp', 'desert', 'ice'],
  /** Bosses of the floors 10, 20, …, 90 in turn; the 100th — the lord. */
  bosses: ['enat', 'poisonMother', 'sandWorm', 'iceKnight', 'alpha', 'bigToad', 'scorpionKing', 'frostWarden', 'galeSpirit'],
  finalBoss: 'darkLord',
  /** A boss floor has 1 modifier, +1 every `modifierEvery` floors. */
  modifierEvery: 30,
  modifiers: {
    furious: { name: 'Розлючений', damage: 1.3 },
    armored: { name: 'Броньований', hp: 1.4 },
    swift: { name: 'Швидкий', speed: 1.25 },
    giant: { name: 'Велетенський', hp: 1.25, damage: 1.15 },
  } as Record<string, BossModifier>,
  /** Gold for every floor won: × the floor. */
  goldPerFloor: 6,
};
