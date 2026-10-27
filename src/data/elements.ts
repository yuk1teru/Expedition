// Elements (ROADMAP 12.2, VISION 7a): every attack has an element, every enemy a defence
// element of level 1–3. Damage is multiplied by the table (level 1) and the level makes a
// weakness or a resistance stronger. Neutral damage is always 100% — except against shelled
// enemies (crabs, scorpions, golems), whose shell lets only `shell` of it through; elements
// pass the shell. All numbers are editable in the wiki.

export type Element = 'neutral' | 'fire' | 'water' | 'wind' | 'earth' | 'poison' | 'holy' | 'dark';

export const ELEMENT_ORDER: Element[] = ['neutral', 'fire', 'water', 'wind', 'earth', 'poison', 'holy', 'dark'];

export const ELEMENTS: Record<Element, { name: string; color: string }> = {
  neutral: { name: 'Нейтральна', color: '#c8c8c8' },
  fire: { name: 'Вогонь', color: '#ff7a3a' },
  water: { name: 'Вода', color: '#5ab0ff' },
  wind: { name: 'Вітер', color: '#9fe8c8' },
  earth: { name: 'Земля', color: '#b08a50' },
  poison: { name: 'Отрута', color: '#8fd14a' },
  holy: { name: 'Святе', color: '#ffe58a' },
  dark: { name: 'Темрява', color: '#9a6ad8' },
};

/** Damage multiplier: attack element → defence element (defence level 1). */
export const ELEMENT_TABLE: Record<Element, Record<Element, number>> = {
  neutral: { neutral: 1, fire: 1, water: 1, wind: 1, earth: 1, poison: 1, holy: 1, dark: 1 },
  fire: { neutral: 1, fire: 0.25, water: 0.5, wind: 1, earth: 1.5, poison: 1.25, holy: 0.75, dark: 1.25 },
  water: { neutral: 1, fire: 1.5, water: 0.25, wind: 0.5, earth: 1, poison: 1, holy: 0.75, dark: 1 },
  wind: { neutral: 1, fire: 1, water: 1.5, wind: 0.25, earth: 0.5, poison: 1, holy: 0.75, dark: 1 },
  earth: { neutral: 1, fire: 0.5, water: 1, wind: 1.5, earth: 0.25, poison: 1, holy: 0.75, dark: 1 },
  poison: { neutral: 1, fire: 1, water: 1, wind: 1, earth: 1, poison: 0, holy: 0.75, dark: 0.5 },
  holy: { neutral: 1, fire: 1, water: 1, wind: 1, earth: 1, poison: 1, holy: 0, dark: 1.75 },
  dark: { neutral: 1, fire: 1, water: 1, wind: 1, earth: 1, poison: 1, holy: 1.75, dark: 0 },
};

/** Each defence level above 1: a weakness gets +this, a resistance −this (not below 0). */
export const ELEMENT_LEVEL_STEP = 0.25;

/** The strongest multiplier (a weakness of a level-3 enemy). */
export const ELEMENT_MAX = 2;

export interface ElementProfile {
  /** Defence element. */
  type: Element;
  /** 1–3: how fiery, watery… the enemy is. */
  level: number;
  /** Shelled: only this share of neutral damage gets through (0.5–0.75). */
  shell?: number;
}

/** Defence profiles of enemies and bosses (absent — neutral, level 1, no shell). */
export const ENEMY_ELEMENTS: Record<string, ElementProfile> = {
  // Ліс: neutral and a little earth; Енат — earth 2.
  mushroom: { type: 'earth', level: 1 },
  stump: { type: 'earth', level: 1 },
  enat: { type: 'earth', level: 2 },
  // Узбережжя: water; crabs with a shell.
  gull: { type: 'wind', level: 1 },
  crab: { type: 'water', level: 1, shell: 0.6 },
  // Мокролісся.
  mossToad: { type: 'water', level: 1 },
  sporeCap: { type: 'poison', level: 1 },
  rotStump: { type: 'earth', level: 1 },
  // Болото: water and poison; the Mother — poison 3.
  slime: { type: 'poison', level: 1 },
  slimelet: { type: 'poison', level: 1 },
  frog: { type: 'water', level: 1 },
  bogman: { type: 'water', level: 2 },
  bigToad: { type: 'water', level: 2 },
  poisonMother: { type: 'poison', level: 3 },
  // Сухе узлісся.
  thornBush: { type: 'earth', level: 1 },
  dustBoar: { type: 'earth', level: 1 },
  // Пустеля: fire and earth; scorpions with a shell.
  scorpion: { type: 'fire', level: 1, shell: 0.6 },
  cactus: { type: 'earth', level: 1 },
  scarab: { type: 'earth', level: 2, shell: 0.75 },
  scarabling: { type: 'earth', level: 1 },
  scorpionKing: { type: 'fire', level: 2, shell: 0.6 },
  sandWorm: { type: 'earth', level: 2 },
  // Гори: wind (harpies), earth with a shell (rocklings).
  harpy: { type: 'wind', level: 1 },
  rockling: { type: 'earth', level: 2, shell: 0.6 },
  galeSpirit: { type: 'wind', level: 3 },
  // Крига: water (ice) 1–3; golems with a shell.
  iceWolf: { type: 'water', level: 1 },
  snowman: { type: 'water', level: 2 },
  iceGolem: { type: 'water', level: 3, shell: 0.6 },
  frostWarden: { type: 'water', level: 2 },
  iceKnight: { type: 'water', level: 3, shell: 0.75 },
};

/** Damage multiplier of an attack against a defence profile. */
export function elementMultiplier(attack: Element, def: ElementProfile | undefined): number {
  const d = def ?? { type: 'neutral', level: 1 };
  if (attack === 'neutral') return d.shell ?? 1;
  const base = ELEMENT_TABLE[attack][d.type];
  const extra = ELEMENT_LEVEL_STEP * (Math.max(1, d.level) - 1);
  if (base > 1) return Math.min(ELEMENT_MAX, base + extra);
  if (base < 1) return Math.max(0, base - extra);
  return 1;
}
