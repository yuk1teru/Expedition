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

export type DecorKind = 'tree' | 'bush' | 'rock';

export interface BiomeDef {
  id: string;
  name: string;
  palette: BiomePalette;
  locationNames: string[];
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

export const BIOMES: Record<string, BiomeDef> = {
  forest: {
    id: 'forest',
    name: 'Ліс',
    palette: {
      ground: '#24361f',
      groundDark: '#1a2817',
      accent: '#7fbf5a',
      decor: ['#2f5a2a', '#3c6e31', '#4b3a26'],
      enemies: {
        wolf: '#a9b4c2',
        mushroom: '#c97ad8',
        stump: '#a07a4c',
        enat: '#6b8f3a',
        alpha: '#dfe4ec',
        galeSpirit: '#9fe3ff',
      },
      eliteAura: '#ffd34d',
    },
    locationNames: ['Тихий гай', 'Лігво Старого Ената'],
    enemies: ['wolf', 'mushroom', 'stump'],
    boss: 'enat',
    miniboss: 'alpha',
    decor: { count: 26, kinds: ['tree', 'tree', 'bush', 'rock'], minSize: 10, maxSize: 30, edgeBand: 44 },
  },
  // TODO: full prototype (PLAN.md, етап 5) — enemies, boss, palette.
  desert: emptyBiome('desert', 'Пустеля'),
  // TODO: full prototype (PLAN.md, етап 5).
  swamp: emptyBiome('swamp', 'Болото'),
  // TODO: full prototype (PLAN.md, етап 5).
  ice: emptyBiome('ice', 'Крига'),
};

function emptyBiome(id: string, name: string): BiomeDef {
  return {
    id,
    name,
    palette: { ground: '#333333', groundDark: '#222222', accent: '#888888', decor: [], enemies: {}, eliteAura: '#ffffff' },
    locationNames: [],
    enemies: [],
    boss: '',
    miniboss: '',
    decor: { count: 0, kinds: [], minSize: 0, maxSize: 0, edgeBand: 0 },
  };
}

export function getBiome(id: string): BiomeDef {
  const b = BIOMES[id];
  if (!b) throw new Error(`Unknown biome: ${id}`);
  return b;
}
