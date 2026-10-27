// Arenas (ROADMAP 13.1): the battlefield of a location — its size (bigger than the screen
// scrolls under the camera), obstacles that block bodies and projectiles (trees, rocks,
// stumps — circles, so bodies slide around them) and terrain: water slows, thorns hurt the
// hero, in tall grass shooters lose sight of the hero. Coordinates are relative to the
// arena's top-left corner. A location without its own arena fights on a plain one.

export type ObstacleKind = 'tree' | 'rock' | 'stump' | 'pillar' | 'deadTree' | 'cactus' | 'bone' | 'ice';
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
const O = (kind: ObstacleKind, x: number, y: number, r: number): ArenaObstacle => ({ kind, x, y, r });

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
  // ---- The rest of the world (ROADMAP 16) ----
  wetwood: {
    id: 'wetwood',
    note: 'Мокролісся: дерева, що тонуть у калюжах, — бій між стовбурами й водою.',
    w: 1120,
    h: 480,
    obstacles: [O('tree', 150, 110, 26), O('tree', 380, 80, 26), O('tree', 820, 90, 26), O('tree', 980, 150, 26), O('tree', 220, 390, 26), O('tree', 900, 380, 26), O('deadTree', 640, 420, 22)],
    terrain: [{ kind: 'water', x: 40, y: 200, w: 160, h: 100 }, { kind: 'water', x: 420, y: 340, w: 180, h: 90 }, { kind: 'water', x: 880, y: 220, w: 180, h: 90 }],
  },
  dryEdge: {
    id: 'dryEdge',
    note: 'Сухе узлісся: колючі кущі й поодинокі дерева — шакали обходять колючки, а ти?',
    w: 1120,
    h: 480,
    obstacles: [O('tree', 160, 100, 26), O('tree', 960, 380, 26), O('cactus', 760, 100, 16), O('cactus', 360, 400, 16), O('rock', 1020, 120, 22)],
    terrain: [{ kind: 'thorns', x: 260, y: 60, w: 150, h: 90 }, { kind: 'thorns', x: 640, y: 330, w: 160, h: 100 }, { kind: 'thorns', x: 60, y: 300, w: 120, h: 100 }, { kind: 'thorns', x: 920, y: 210, w: 130, h: 70 }],
  },
  fogMire: {
    id: 'fogMire',
    note: 'Туманна трясовина: в очереті плювачі не бачать героя здалеку, калюжі сповільнюють.',
    w: 1120,
    h: 480,
    obstacles: [O('deadTree', 150, 100, 22), O('deadTree', 960, 380, 22), O('deadTree', 300, 410, 22), O('deadTree', 820, 90, 22)],
    terrain: [{ kind: 'water', x: 60, y: 180, w: 200, h: 110 }, { kind: 'water', x: 860, y: 190, w: 200, h: 100 }, { kind: 'grass', x: 380, y: 30, w: 280, h: 100 }, { kind: 'grass', x: 460, y: 350, w: 260, h: 100 }],
  },
  rotMarsh: {
    id: 'rotMarsh',
    note: 'Гнилі мочари: гнилі пні всюди — тісно, слизні з’являються з-за кожного.',
    w: 1120,
    h: 480,
    obstacles: [O('stump', 150, 110, 18), O('stump', 330, 90, 18), O('stump', 520, 80, 18), O('stump', 760, 110, 18), O('stump', 940, 120, 18), O('stump', 180, 370, 18), O('stump', 400, 390, 18), O('stump', 700, 400, 18), O('stump', 950, 360, 18)],
    terrain: [{ kind: 'water', x: 30, y: 210, w: 110, h: 90 }, { kind: 'water', x: 980, y: 200, w: 110, h: 100 }],
  },
  frogPond: {
    id: 'frogPond',
    note: 'Жаб’яче озерце: озеро вгорі — жаби стрибають через воду, ти — ні.',
    w: 960,
    h: 480,
    obstacles: [O('deadTree', 110, 130, 22), O('deadTree', 850, 150, 22), O('deadTree', 800, 400, 22), O('stump', 160, 410, 18)],
    terrain: [{ kind: 'water', x: 280, y: 30, w: 400, h: 130 }, { kind: 'water', x: 40, y: 300, w: 150, h: 90 }, { kind: 'grass', x: 700, y: 270, w: 200, h: 90 }],
  },
  blackMuck: {
    id: 'blackMuck',
    note: 'Чорна багнюка: в’язкі калюжі по всій арені, бій на острівцях між ними.',
    w: 1280,
    h: 520,
    obstacles: [O('deadTree', 420, 250, 22), O('deadTree', 860, 260, 22), O('rock', 1180, 50, 22), O('rock', 100, 470, 22)],
    terrain: [{ kind: 'water', x: 100, y: 50, w: 180, h: 120 }, { kind: 'water', x: 500, y: 30, w: 200, h: 110 }, { kind: 'water', x: 900, y: 70, w: 220, h: 120 }, { kind: 'water', x: 200, y: 340, w: 220, h: 120 }, { kind: 'water', x: 620, y: 380, w: 200, h: 110 }, { kind: 'water', x: 1000, y: 330, w: 200, h: 130 }],
  },
  motherNest: {
    id: 'motherNest',
    note: 'Гніздо Отруйної Матері: отруйна вода в кутах і коло пнів — калюжі боса нікуди не дінуться.',
    w: 960,
    h: 480,
    obstacles: [O('stump', 300, 110, 18), O('stump', 660, 110, 18), O('stump', 300, 370, 18), O('stump', 660, 370, 18)],
    terrain: [{ kind: 'water', x: 0, y: 0, w: 150, h: 110 }, { kind: 'water', x: 810, y: 0, w: 150, h: 110 }, { kind: 'water', x: 0, y: 370, w: 150, h: 110 }, { kind: 'water', x: 810, y: 370, w: 150, h: 110 }],
  },
  sandDunes: {
    id: 'sandDunes',
    note: 'Піщані дюни: відкрито й далеко — від стрільців не сховаєшся, лише кактуси.',
    w: 1280,
    h: 480,
    obstacles: [O('cactus', 200, 120, 16), O('cactus', 1060, 360, 16), O('cactus', 420, 400, 16), O('cactus', 860, 90, 16), O('cactus', 1180, 130, 16)],
    terrain: [],
  },
  dryRiver: {
    id: 'dryRiver',
    note: 'Сухе русло: кам’яні береги утворюють коридор — звірі приходять лише з кінців русла.',
    w: 1280,
    h: 480,
    obstacles: [O('rock', 110, 50, 30), O('rock', 310, 50, 30), O('rock', 510, 50, 30), O('rock', 710, 50, 30), O('rock', 910, 50, 30), O('rock', 1110, 50, 30), O('rock', 210, 430, 30), O('rock', 410, 430, 30), O('rock', 610, 430, 30), O('rock', 810, 430, 30), O('rock', 1010, 430, 30)],
    terrain: [],
    spawnSides: ['left', 'right'],
  },
  boneValley: {
    id: 'boneValley',
    note: 'Кістяна долина: ребра велетнів — укриття від плювачів, колючі кущі між ними.',
    w: 1120,
    h: 480,
    obstacles: [O('bone', 200, 120, 18), O('bone', 380, 80, 18), O('bone', 740, 90, 18), O('bone', 920, 130, 18), O('bone', 250, 380, 18), O('bone', 870, 370, 18)],
    terrain: [{ kind: 'thorns', x: 480, y: 380, w: 150, h: 80 }, { kind: 'thorns', x: 60, y: 200, w: 90, h: 90 }, { kind: 'thorns', x: 980, y: 230, w: 100, h: 80 }],
  },
  scorchedPlain: {
    id: 'scorchedPlain',
    note: 'Розпечена рівнина: колючі кущі по всій рівнині — обходь, поки скорпіони ріжуть.',
    w: 1280,
    h: 520,
    obstacles: [O('rock', 1150, 470, 22), O('rock', 120, 470, 22), O('cactus', 640, 80, 16)],
    terrain: [{ kind: 'thorns', x: 150, y: 80, w: 140, h: 100 }, { kind: 'thorns', x: 860, y: 40, w: 160, h: 90 }, { kind: 'thorns', x: 980, y: 220, w: 150, h: 110 }, { kind: 'thorns', x: 300, y: 340, w: 160, h: 100 }, { kind: 'thorns', x: 780, y: 380, w: 170, h: 100 }],
  },
  wormBurrow: {
    id: 'wormBurrow',
    note: 'Нора Хробака: кам’яні стовпи — хробак виринає між ними, а ти ховаєшся за ними від кислоти.',
    w: 960,
    h: 480,
    obstacles: [O('pillar', 220, 120, 24), O('pillar', 740, 120, 24), O('pillar', 220, 360, 24), O('pillar', 740, 360, 24), O('pillar', 480, 60, 24), O('pillar', 480, 420, 24)],
    terrain: [],
  },
  foothills: {
    id: 'foothills',
    note: 'Передгір’я: розсип валунів — бій між ними, гарпії налітають згори.',
    w: 1120,
    h: 480,
    obstacles: [O('rock', 140, 100, 28), O('rock', 330, 380, 30), O('rock', 520, 70, 22), O('rock', 760, 400, 28), O('rock', 930, 120, 30), O('rock', 1020, 330, 22), O('rock', 250, 250, 20), O('rock', 860, 250, 20)],
    terrain: [],
  },
  mountainPass: {
    id: 'mountainPass',
    note: 'Гірський перевал: вузька стежка між скелями — звірі йдуть лише з обох кінців.',
    w: 1280,
    h: 416,
    obstacles: [O('rock', 90, 34, 34), O('rock', 250, 34, 34), O('rock', 410, 34, 34), O('rock', 570, 34, 34), O('rock', 730, 34, 34), O('rock', 890, 34, 34), O('rock', 1050, 34, 34), O('rock', 1210, 34, 34), O('rock', 170, 382, 34), O('rock', 330, 382, 34), O('rock', 490, 382, 34), O('rock', 650, 382, 34), O('rock', 810, 382, 34), O('rock', 970, 382, 34), O('rock', 1130, 382, 34)],
    terrain: [],
    spawnSides: ['left', 'right'],
  },
  whiteSlope: {
    id: 'whiteSlope',
    note: 'Білий схил: у снігових наметах стрільці не бачать героя здалеку; ялини — укриття.',
    w: 1120,
    h: 480,
    obstacles: [O('tree', 150, 100, 26), O('tree', 360, 410, 26), O('tree', 820, 80, 26), O('tree', 980, 380, 26), O('rock', 620, 420, 22)],
    terrain: [{ kind: 'grass', x: 60, y: 260, w: 220, h: 110 }, { kind: 'grass', x: 440, y: 30, w: 250, h: 100 }, { kind: 'grass', x: 820, y: 220, w: 220, h: 100 }],
  },
  iceLake: {
    id: 'iceLake',
    note: 'Крижане озеро: тонкий лід сповільнює всіх — бій на березі чи на кризі.',
    w: 1120,
    h: 480,
    obstacles: [O('ice', 120, 110, 26), O('ice', 1000, 380, 26), O('ice', 980, 100, 26), O('ice', 140, 380, 26)],
    terrain: [{ kind: 'water', x: 280, y: 30, w: 560, h: 150 }, { kind: 'water', x: 300, y: 320, w: 520, h: 130 }],
  },
  glassGlacier: {
    id: 'glassGlacier',
    note: 'Скляний льодовик: крижані брили — лабіринт, у якому легко загнати себе в кут.',
    w: 1280,
    h: 520,
    obstacles: [O('ice', 150, 100, 26), O('ice', 330, 230, 26), O('ice', 300, 430, 26), O('ice', 520, 90, 26), O('ice', 790, 440, 26), O('ice', 760, 80, 26), O('ice', 960, 260, 26), O('ice', 1120, 110, 26), O('ice', 1130, 420, 26), O('ice', 480, 430, 26)],
    terrain: [],
  },
  iceCitadel: {
    id: 'iceCitadel',
    note: 'Цитадель Крижаного Лицаря: колони залу — таран Лицаря об них зупиняється.',
    w: 960,
    h: 480,
    obstacles: [O('pillar', 200, 110, 24), O('pillar', 760, 110, 24), O('pillar', 200, 370, 24), O('pillar', 760, 370, 24)],
    terrain: [],
  },
};

/** The arena of a location (its own or a plain one of the view's size). */
export function arenaFor(nodeId: string, viewW: number, viewH: number): ArenaDef {
  return ARENAS[nodeId] ?? { id: 'plain', note: '', w: viewW, h: viewH, obstacles: [], terrain: [] };
}
