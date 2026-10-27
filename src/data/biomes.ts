// Biomes: palette, enemy roster, boss, location names, arena decor.

export interface BiomePalette {
  ground: string;
  groundDark: string;
  accent: string;
  /** Decor fill colours. */
  decor: string[];
  /** Enemy def id → colour. */
  enemies: Record<string, string>;
  eliteAura: string;
}

export type DecorKind = 'tree' | 'bush' | 'rock' | 'cactus' | 'reeds' | 'crystal';

export interface BiomeDef {
  id: string;
  name: string;
  palette: BiomePalette;
  /** 8 names for the ordinary locations of a sector (depths 1–3). */
  locationNames: string[];
  /** Name of the boss location (depth 4). */
  bossLocation: string;
  enemies: string[];
  boss: string;
  /** Miniboss of ordinary locations ('' if none). */
  miniboss: string;
  decor: {
    count: number;
    kinds: DecorKind[];
    minSize: number;
    maxSize: number;
    /** How far from the arena edge decor may reach, px. */
    edgeBand: number;
  };
}

const FOREST_ENEMY_COLORS: Record<string, string> = {
  wolf: '#a9b4c2',
  mushroom: '#c97ad8',
  stump: '#a07a4c',
  enat: '#6b8f3a',
  alpha: '#dfe4ec',
  galeSpirit: '#9fe3ff',
};

export const BIOMES: Record<string, BiomeDef> = {
  forest: {
    id: 'forest',
    name: 'Ліс',
    palette: {
      ground: '#24361f',
      groundDark: '#1a2817',
      accent: '#7fbf5a',
      decor: ['#2f5a2a', '#3c6e31', '#4b3a26'],
      enemies: { ...FOREST_ENEMY_COLORS },
      eliteAura: '#ffd34d',
    },
    locationNames: ['Тихий гай', 'Старий бір', 'Вовча стежка', 'Грибна галявина', 'Моховий яр', 'Дубова діброва', 'Темна гущавина', 'Тисова пуща'],
    bossLocation: 'Лігво Старого Ената',
    enemies: ['wolf', 'mushroom', 'stump'],
    boss: 'enat',
    miniboss: 'alpha',
    decor: { count: 26, kinds: ['tree', 'tree', 'bush', 'rock'], minSize: 10, maxSize: 30, edgeBand: 44 },
  },
  desert: {
    id: 'desert',
    name: 'Пустеля',
    palette: {
      ground: '#4a3d24',
      groundDark: '#3a301c',
      accent: '#e2b25a',
      decor: ['#7a6440', '#8c7a52', '#5e7a3a'],
      enemies: { scorpion: '#d9894a', cactus: '#6fae4c', scarab: '#3f6f8f', scarabling: '#5f8faf', galeSpirit: '#9fe3ff', sandWorm: '#c9a36b', scorpionKing: '#e07a3a' },
      eliteAura: '#ffd34d',
    },
    locationNames: ['Сухе русло', 'Піщані дюни', 'Розпечена рівнина', 'Кам’яний каньйон', 'Оаза міражів', 'Кістяна долина', 'Вітряний перевал', 'Соляне плато'],
    bossLocation: 'Нора Піщаного Хробака',
    enemies: ['scorpion', 'cactus', 'scarab'],
    boss: 'sandWorm',
    miniboss: 'scorpionKing',
    decor: { count: 20, kinds: ['cactus', 'cactus', 'rock', 'rock'], minSize: 10, maxSize: 26, edgeBand: 44 },
  },
  swamp: {
    id: 'swamp',
    name: 'Болото',
    palette: {
      ground: '#24302e',
      groundDark: '#1a2524',
      accent: '#5fc7b0',
      decor: ['#2f4a42', '#3d5c4c', '#2e3d3a'],
      enemies: { slime: '#8fd16a', slimelet: '#a7e08a', frog: '#4f9a5a', bogman: '#6a5a3a', galeSpirit: '#9fe3ff', poisonMother: '#7fbf3a', bigToad: '#5f9a4a' },
      eliteAura: '#ffd34d',
    },
    locationNames: ['Туманна трясовина', 'Гнилі мочари', 'Очеретяна заплава', 'Жаб’яче озерце', 'Чорна багнюка', 'Тиха драговина', 'Мертвий рукав', 'Комарині плавні'],
    bossLocation: 'Гніздо Отруйної Матері',
    enemies: ['slime', 'frog', 'bogman'],
    boss: 'poisonMother',
    miniboss: 'bigToad',
    decor: { count: 26, kinds: ['reeds', 'reeds', 'bush', 'tree'], minSize: 10, maxSize: 26, edgeBand: 44 },
  },
  ice: {
    id: 'ice',
    name: 'Крига',
    palette: {
      ground: '#2a3442',
      groundDark: '#212a36',
      accent: '#9fd8ff',
      decor: ['#c8dceb', '#8fb0c8', '#5f7d96'],
      enemies: { iceWolf: '#cfe6f5', snowman: '#f4f7fb', iceGolem: '#7fb0d6', galeSpirit: '#9fe3ff', iceKnight: '#9fc8e8', frostWarden: '#bfe6ff' },
      eliteAura: '#ffd34d',
    },
    locationNames: ['Білий схил', 'Крижане озеро', 'Морозний перевал', 'Сніжна пустка', 'Синя ущелина', 'Скляний льодовик', 'Холодне урвище', 'Інеєвий ліс'],
    bossLocation: 'Цитадель Крижаного Лицаря',
    enemies: ['iceWolf', 'snowman', 'iceGolem'],
    boss: 'iceKnight',
    miniboss: 'frostWarden',
    decor: { count: 22, kinds: ['crystal', 'crystal', 'rock', 'tree'], minSize: 10, maxSize: 28, edgeBand: 44 },
  },
};

export const BIOME_ORDER = ['forest', 'desert', 'swamp', 'ice'] as const;

export function getBiome(id: string): BiomeDef {
  const b = BIOMES[id];
  if (!b) throw new Error(`Unknown biome: ${id}`);
  return b;
}
