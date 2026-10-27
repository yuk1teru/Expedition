// Arenas (ROADMAP 13.1): the battlefield of a location — its size (bigger than the screen
// scrolls under the camera), obstacles that block bodies and projectiles (trees, rocks,
// stumps — circles, so bodies slide around them) and terrain: water slows, thorns hurt the
// hero, in tall grass shooters lose sight of the hero. Coordinates are relative to the
// arena's top-left corner. A location without its own arena fights on a plain one.

export type ObstacleKind = 'tree' | 'rock' | 'stump' | 'pillar';
export type ArenaSide = 'left' | 'right' | 'top' | 'bottom';
export type TerrainKind = 'water' | 'thorns' | 'grass';

export interface ArenaObstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  r: number;
}

export interface ArenaTerrain {
  kind: TerrainKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArenaDef {
  id: string;
  /** What makes it special (wiki). */
  note: string;
  w: number;
  h: number;
  obstacles: ArenaObstacle[];
  terrain: ArenaTerrain[];
  /** Monsters come only from these edges (default: all four). */
  spawnSides?: ArenaSide[];
  /** Never mirrored top to bottom (the sea stays below). */
  fixedY?: boolean;
}

export const TERRAIN = {
  /** Water slows everyone in it by this share. */
  waterSlow: 0.35,
  /** Thorns: the hero loses this share of max HP per second in them. */
  thornsDps: 0.04,
  /** In tall grass the hero is seen by shooters only this close, px. */
  grassSight: 140,
  /** No obstacle within this radius of the arena centre (where the hero starts). */
  clearCentre: 90,
};

const T = (x: number, y: number, r = 26): ArenaObstacle => ({ kind: 'tree', x, y, r });
const R = (x: number, y: number, r = 22): ArenaObstacle => ({ kind: 'rock', x, y, r });
const S = (x: number, y: number, r = 18): ArenaObstacle => ({ kind: 'stump', x, y, r });

export const ARENAS: Record<string, ArenaDef> = {
  coastRoad: {
    id: 'coastRoad',
    note: 'Довгий берег: море знизу сповільнює, скелі розбивають бій на кишені.',
    w: 1280,
    h: 416,
    obstacles: [R(220, 120, 30), R(420, 300), R(760, 110, 28), R(980, 260), R(1150, 120, 26), R(320, 220, 18)],
    terrain: [{ kind: 'water', x: 0, y: 340, w: 1280, h: 76 }],
    fixedY: true,
  },
  quietGrove: {
    id: 'quietGrove',
    note: 'Тихий гай: кілька дерев — перша арена з перешкодами.',
    w: 960,
    h: 416,
    obstacles: [T(180, 110), T(780, 120), T(220, 320), T(760, 300), S(480, 70)],
    terrain: [],
  },
  wolfTrail: {
    id: 'wolfTrail',
    note: 'Широка стежка між деревами: зграї заходять лише з обох кінців стежки.',
    w: 1280,
    h: 520,
    obstacles: [T(120, 80), T(300, 60), T(520, 90), T(760, 70), T(980, 90), T(1160, 70), T(140, 450), T(380, 470), T(640, 440), T(900, 460), T(1150, 440), R(640, 140, 20)],
    terrain: [],
    spawnSides: ['left', 'right'],
  },
  mushroomGlade: {
    id: 'mushroomGlade',
    note: 'Висока трава: у ній гриби-плювачі не бачать героя здалеку.',
    w: 960,
    h: 416,
    obstacles: [S(140, 200), S(820, 210), T(480, 60, 22)],
    terrain: [
      { kind: 'grass', x: 60, y: 40, w: 260, h: 140 },
      { kind: 'grass', x: 640, y: 240, w: 270, h: 140 },
      { kind: 'grass', x: 360, y: 300, w: 200, h: 100 },
    ],
  },
  mossyRavine: {
    id: 'mossyRavine',
    note: 'Струмок через яр сповільнює всіх; камені — укриття від стрільців.',
    w: 1120,
    h: 480,
    obstacles: [R(200, 120, 28), R(900, 360, 30), R(330, 380), R(780, 100), T(80, 420), T(1060, 60)],
    terrain: [{ kind: 'water', x: 0, y: 300, w: 1120, h: 60 }],
    fixedY: true,
  },
  darkThicket: {
    id: 'darkThicket',
    note: 'Густа хаща: багато дерев і колючки, що ранять героя.',
    w: 1280,
    h: 560,
    obstacles: [
      T(120, 120), T(260, 420), T(420, 160), T(560, 460), T(760, 140), T(880, 420), T(1060, 160), T(1180, 440), T(300, 270, 20), T(980, 290, 20),
      T(60, 330), T(1220, 260),
    ],
    terrain: [
      { kind: 'thorns', x: 160, y: 220, w: 120, h: 120 },
      { kind: 'thorns', x: 1000, y: 360, w: 120, h: 110 },
      { kind: 'thorns', x: 600, y: 40, w: 140, h: 80 },
    ],
  },
  enatLair: {
    id: 'enatLair',
    note: 'Лігво Ената: коло пнів — тісно, коріння боса важче оминати.',
    w: 960,
    h: 416,
    obstacles: [S(160, 90), S(800, 90), S(120, 300), S(840, 300), S(480, 50), S(480, 370)],
    terrain: [],
  },
};

/** The arena of a location (its own or a plain one of the view's size). */
export function arenaFor(nodeId: string, viewW: number, viewH: number): ArenaDef {
  return ARENAS[nodeId] ?? { id: 'plain', note: '', w: viewW, h: viewH, obstacles: [], terrain: [] };
}
