// Town scenes: a map per town (bigger than the screen — the camera follows the hero) with
// buildings, water, props, NPCs (src/data/npcs.ts) and the gate to the world map. Buildings
// and water block the hero; props are decoration. Coordinates are town-map pixels from the
// top-left corner. Building labels may hold name references ({name:church}).

export interface TownRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TownStyle = 'capital' | 'port' | 'forest' | 'swamp' | 'desert' | 'ice';

export type TownPropKind =
  | 'tree'
  | 'pine'
  | 'snowPine'
  | 'palm'
  | 'reed'
  | 'well'
  | 'barrel'
  | 'crate'
  | 'lamp'
  | 'boat'
  | 'cactus'
  | 'rock'
  | 'tent'
  | 'fountain'
  | 'stall'
  | 'grave'
  | 'dummy'
  | 'target';

export interface TownBuilding extends TownRect {
  wall: string;
  roof: string;
  /** Sign over the door (Крамниця, Таверна…). */
  label?: string;
}

export interface TownLayout {
  id: string;
  style: TownStyle;
  /** Size of the town map, px. */
  width: number;
  height: number;
  ground: string;
  /** Paths drawn over the ground (no collision). */
  paths: TownRect[];
  pathColor: string;
  /** Blocking water (sea, ponds, canals). */
  water: TownRect[];
  waterColor: string;
  buildings: TownBuilding[];
  props: { kind: TownPropKind; x: number; y: number }[];
  npcs: { id: string; x: number; y: number }[];
  /** Walking into it leads to the world map. */
  gate: TownRect;
  /** Where the hero appears (next to the gate). */
  spawn: { x: number; y: number };
  /** Where the hero wakes up at the start of the adventure (the prologue), if not at the gate. */
  arrival?: { x: number; y: number };
  /** Cemetery plots for the tombstones of fallen heroes, the newest first (ROADMAP 9.6). */
  graves?: { x: number; y: number }[];
}

const P = (kind: TownPropKind, x: number, y: number): { kind: TownPropKind; x: number; y: number } => ({ kind, x, y });

export const TOWNS: Record<string, TownLayout> = {
  capital: {
    id: 'capital',
    style: 'capital',
    width: 1920,
    height: 1280,
    ground: '#4f6b3a',
    pathColor: '#a89a7a',
    paths: [
      { x: 900, y: 280, w: 120, h: 1000 },
      { x: 120, y: 600, w: 1680, h: 80 },
      { x: 200, y: 1000, w: 1520, h: 70 },
      { x: 760, y: 500, w: 400, h: 280 },
      { x: 380, y: 380, w: 60, h: 220 },
      { x: 1480, y: 330, w: 60, h: 270 },
    ],
    water: [],
    waterColor: '#3b6a9a',
    buildings: [
      { x: 720, y: 40, w: 480, h: 240, wall: '#d4ccb4', roof: '#7a2e2e', label: 'Палац' },
      { x: 260, y: 100, w: 300, h: 280, wall: '#e0dccf', roof: '#3a4a6a', label: '{name:church}' },
      { x: 1360, y: 110, w: 300, h: 220, wall: '#a8a8b0', roof: '#4a5a7a', label: 'Казарма' },
      { x: 520, y: 400, w: 200, h: 150, wall: '#b8a27a', roof: '#8a4a2a', label: 'Крамниця' },
      { x: 1200, y: 400, w: 200, h: 150, wall: '#9a8aa8', roof: '#4a2a5a', label: 'Лавка дивин' },
      { x: 480, y: 760, w: 260, h: 160, wall: '#b8a27a', roof: '#6a3a2a', label: 'Таверна «Під дубом»' },
      { x: 1180, y: 760, w: 240, h: 160, wall: '#e8e4dc', roof: '#a83a3a', label: 'Лічниця' },
      { x: 1500, y: 720, w: 260, h: 200, wall: '#8a9ab8', roof: '#3a3a7a', label: 'Академія' },
      { x: 140, y: 720, w: 220, h: 160, wall: '#a89a74', roof: '#4a6a3a', label: 'Стрільбище' },
      { x: 120, y: 1110, w: 180, h: 130, wall: '#c0b090', roof: '#5a4a6a' },
      { x: 420, y: 1110, w: 200, h: 130, wall: '#b8a27a', roof: '#7a4a2a' },
      { x: 1300, y: 1110, w: 200, h: 130, wall: '#c0b090', roof: '#6a3a2a' },
      { x: 1620, y: 1110, w: 180, h: 130, wall: '#b8a27a', roof: '#5a4a6a' },
      { x: 1700, y: 420, w: 160, h: 130, wall: '#c0b090', roof: '#7a2e2e' },
    ],
    props: [
      P('fountain', 960, 640),
      P('lamp', 880, 400), P('lamp', 1040, 400), P('lamp', 880, 860), P('lamp', 1040, 860),
      P('tree', 70, 560), P('tree', 1860, 640), P('tree', 760, 1180), P('tree', 1180, 1190), P('tree', 640, 300), P('tree', 1280, 300),
      P('stall', 830, 470), P('stall', 1090, 470),
      P('grave', 45, 470), P('grave', 210, 470), P('grave', 100, 470),
      P('dummy', 1720, 210), P('dummy', 1800, 260), P('dummy', 1870, 210),
      P('target', 60, 780), P('target', 60, 860),
      P('barrel', 760, 900), P('crate', 1450, 960), P('well', 1700, 1000),
    ],
    npcs: [
      { id: 'capitalCoach', x: 1100, y: 1185 },
      { id: 'capitalMerchant', x: 620, y: 582 },
      { id: 'capitalGuard', x: 1510, y: 372 },
      { id: 'warriorTeacher', x: 1760, y: 360 },
      { id: 'capitalAdvisor', x: 960, y: 320 },
      { id: 'capitalPriest', x: 410, y: 420 },
      { id: 'artifactBuyer', x: 1300, y: 582 },
      { id: 'noticeBoard', x: 1100, y: 740 },
      { id: 'tavernWanderer', x: 610, y: 955 },
      { id: 'capitalDoctor', x: 1300, y: 955 },
      { id: 'mageTeacher', x: 1630, y: 955 },
      { id: 'archerTeacher', x: 250, y: 918 },
    ],
    gate: { x: 900, y: 1250, w: 120, h: 30 },
    spawn: { x: 960, y: 1200 },
    graves: [230, 310, 390].flatMap((y) => [45, 100, 155, 210].map((x) => ({ x, y }))),
  },
  port: {
    id: 'port',
    style: 'port',
    width: 1600,
    height: 960,
    ground: '#8a7d5a',
    pathColor: '#6e5a3a',
    paths: [
      { x: 120, y: 200, w: 180, h: 60 },
      { x: 120, y: 560, w: 180, h: 60 },
      { x: 300, y: 440, w: 1300, h: 80 },
      { x: 700, y: 120, w: 70, h: 320 },
    ],
    water: [
      { x: 0, y: 0, w: 120, h: 960 },
      { x: 120, y: 0, w: 180, h: 200 },
      { x: 120, y: 260, w: 180, h: 300 },
      { x: 120, y: 620, w: 180, h: 340 },
    ],
    waterColor: '#2f5a85',
    buildings: [
      { x: 330, y: 40, w: 120, h: 180, wall: '#e8e4dc', roof: '#a83a3a', label: 'Маяк' },
      { x: 480, y: 250, w: 200, h: 150, wall: '#a88a64', roof: '#2f4a6a', label: 'Крамниця' },
      { x: 820, y: 220, w: 260, h: 170, wall: '#9a8a74', roof: '#6a3a2a', label: 'Таверна «Якір»' },
      { x: 1180, y: 230, w: 220, h: 150, wall: '#a89a7a', roof: '#3a5a6a', label: 'Портова контора' },
      { x: 480, y: 600, w: 280, h: 160, wall: '#8a7a64', roof: '#4a4a5a', label: 'Склад' },
      { x: 880, y: 600, w: 200, h: 140, wall: '#a89a7a', roof: '#3a5a6a' },
      { x: 1180, y: 600, w: 200, h: 140, wall: '#9a8a74', roof: '#6a4a3a' },
      { x: 1180, y: 790, w: 200, h: 130, wall: '#a88a64', roof: '#2f4a6a' },
    ],
    props: [
      P('boat', 60, 150), P('boat', 60, 420), P('boat', 60, 760), P('boat', 210, 720),
      P('barrel', 330, 480), P('barrel', 460, 560), P('crate', 790, 560), P('crate', 810, 585),
      P('lamp', 300, 430), P('lamp', 1000, 430), P('lamp', 1420, 430),
      P('rock', 1550, 900), P('rock', 1520, 120),
    ],
    npcs: [
      { id: 'portCoach', x: 1480, y: 370 },
      { id: 'portFisher', x: 210, y: 230 },
      { id: 'portMerchant', x: 580, y: 428 },
      { id: 'portKeeper', x: 390, y: 250 },
    ],
    gate: { x: 1570, y: 440, w: 30, h: 80 },
    arrival: { x: 268, y: 230 },
    spawn: { x: 1520, y: 480 },
  },
  forestTown: {
    id: 'forestTown',
    style: 'forest',
    width: 1600,
    height: 960,
    ground: '#2f4f2a',
    pathColor: '#6a5a3a',
    paths: [
      { x: 740, y: 0, w: 120, h: 960 },
      { x: 160, y: 440, w: 1280, h: 80 },
    ],
    water: [{ x: 1380, y: 800, w: 180, h: 120 }],
    waterColor: '#2f5a5a',
    buildings: [
      { x: 300, y: 230, w: 220, h: 160, wall: '#7a5a3a', roof: '#3a5a2a', label: 'Крамниця' },
      { x: 1060, y: 210, w: 260, h: 180, wall: '#6a4a2a', roof: '#4a3a2a', label: 'Мисливська хата' },
      { x: 280, y: 640, w: 240, h: 160, wall: '#7a5a3a', roof: '#2f4a2a', label: 'Хата старости' },
      { x: 1100, y: 640, w: 240, h: 150, wall: '#8a6a44', roof: '#4a3a2a', label: 'Лісопилка' },
      { x: 900, y: 820, w: 160, h: 110, wall: '#7a5a3a', roof: '#3a5a2a' },
    ],
    props: [
      P('pine', 80, 100), P('pine', 260, 110), P('pine', 580, 120), P('pine', 980, 110), P('pine', 1420, 110),
      P('pine', 1520, 320), P('pine', 80, 330), P('pine', 620, 640), P('pine', 80, 860), P('pine', 620, 880), P('pine', 1260, 900),
      P('tree', 1540, 560), P('tree', 980, 600),
      P('well', 900, 580), P('crate', 560, 420), P('barrel', 1000, 420),
    ],
    npcs: [
      { id: 'forestCoach', x: 930, y: 95 },
      { id: 'forestMerchant', x: 410, y: 420 },
      { id: 'forestHunter', x: 1190, y: 420 },
      { id: 'forestElder', x: 400, y: 830 },
    ],
    gate: { x: 740, y: 0, w: 120, h: 30 },
    spawn: { x: 800, y: 70 },
  },
  swampTown: {
    id: 'swampTown',
    style: 'swamp',
    width: 1600,
    height: 960,
    ground: '#3a4a34',
    pathColor: '#6a5a40',
    paths: [
      { x: 0, y: 450, w: 1500, h: 60 },
      { x: 760, y: 120, w: 60, h: 720 },
    ],
    water: [
      { x: 0, y: 0, w: 1600, h: 90 },
      { x: 0, y: 870, w: 1600, h: 90 },
      { x: 900, y: 150, w: 260, h: 200 },
      { x: 300, y: 600, w: 260, h: 200 },
      { x: 1260, y: 620, w: 240, h: 160 },
    ],
    waterColor: '#2a4a3e',
    buildings: [
      { x: 260, y: 200, w: 240, h: 160, wall: '#5a4a3a', roof: '#6a7a3a', label: 'Травниця' },
      { x: 980, y: 600, w: 240, h: 150, wall: '#5a4a3a', roof: '#4a5a3a', label: 'Човнярня' },
      { x: 1250, y: 170, w: 200, h: 150, wall: '#4a3a3a', roof: '#3a4a3a', label: 'Хата знахарки' },
      { x: 560, y: 180, w: 160, h: 120, wall: '#5a4a3a', roof: '#5a6a3a' },
      { x: 40, y: 640, w: 180, h: 140, wall: '#5a4a3a', roof: '#6a7a3a' },
    ],
    props: [
      P('reed', 890, 370), P('reed', 1170, 160), P('reed', 570, 620), P('reed', 290, 820), P('reed', 100, 850),
      P('reed', 1500, 850), P('reed', 1250, 800), P('reed', 1540, 140),
      P('boat', 1030, 250), P('boat', 430, 700), P('boat', 1380, 700),
      P('lamp', 740, 430), P('lamp', 1480, 430), P('barrel', 600, 480),
    ],
    npcs: [
      { id: 'swampCoach', x: 120, y: 370 },
      { id: 'swampMerchant', x: 380, y: 400 },
      { id: 'swampBoatman', x: 1100, y: 560 },
      { id: 'swampWitch', x: 1350, y: 380 },
    ],
    gate: { x: 0, y: 440, w: 30, h: 80 },
    spawn: { x: 70, y: 480 },
  },
  desertTown: {
    id: 'desertTown',
    style: 'desert',
    width: 1600,
    height: 960,
    ground: '#c9a86a',
    pathColor: '#b08a52',
    paths: [
      { x: 740, y: 0, w: 120, h: 960 },
      { x: 160, y: 440, w: 1280, h: 80 },
    ],
    water: [{ x: 1000, y: 220, w: 280, h: 140 }],
    waterColor: '#3a8aa0',
    buildings: [
      { x: 260, y: 220, w: 280, h: 170, wall: '#d8b88a', roof: '#a86a3a', label: 'Базар' },
      { x: 1080, y: 620, w: 320, h: 180, wall: '#d0b080', roof: '#8a5a3a', label: 'Караван-сарай' },
      { x: 260, y: 640, w: 220, h: 150, wall: '#d8c09a', roof: '#a87a4a' },
      { x: 540, y: 720, w: 160, h: 130, wall: '#d0b088', roof: '#9a6a3a' },
      { x: 1320, y: 140, w: 180, h: 130, wall: '#d8c09a', roof: '#a86a3a' },
    ],
    props: [
      P('palm', 980, 200), P('palm', 1300, 390), P('palm', 960, 380), P('palm', 1290, 210),
      P('tent', 620, 320), P('tent', 140, 860), P('cactus', 80, 200), P('cactus', 1520, 880), P('cactus', 960, 880),
      P('rock', 1520, 520), P('stall', 580, 560), P('crate', 560, 420), P('barrel', 1060, 420),
    ],
    npcs: [
      { id: 'desertCoach', x: 930, y: 95 },
      { id: 'desertMerchant', x: 400, y: 420 },
      { id: 'desertCaravan', x: 1240, y: 580 },
      { id: 'desertWater', x: 1140, y: 400 },
    ],
    gate: { x: 740, y: 0, w: 120, h: 30 },
    spawn: { x: 800, y: 70 },
  },
  iceTown: {
    id: 'iceTown',
    style: 'ice',
    width: 1600,
    height: 960,
    ground: '#d8e4ee',
    pathColor: '#a8b8c8',
    paths: [
      { x: 740, y: 260, w: 120, h: 700 },
      { x: 160, y: 420, w: 1280, h: 80 },
    ],
    water: [{ x: 1320, y: 700, w: 220, h: 150 }],
    waterColor: '#9ac4e0',
    buildings: [
      { x: 660, y: 40, w: 280, h: 180, wall: '#5a4a3a', roof: '#f4f8ff', label: 'Корчма' },
      { x: 260, y: 200, w: 240, h: 160, wall: '#6a5a4a', roof: '#e8f0f8', label: 'Крамниця' },
      { x: 1060, y: 200, w: 240, h: 160, wall: '#6a5a4a', roof: '#e8f0f8', label: 'Хата шукача' },
      { x: 300, y: 600, w: 240, h: 150, wall: '#4a3a3a', roof: '#f0f4fa', label: 'Кузня' },
      { x: 1060, y: 600, w: 220, h: 150, wall: '#5a4a3a', roof: '#f0f4fa' },
    ],
    props: [
      P('snowPine', 80, 100), P('snowPine', 1500, 100), P('snowPine', 80, 330), P('snowPine', 1520, 330),
      P('snowPine', 360, 860), P('snowPine', 620, 880), P('snowPine', 1000, 880), P('snowPine', 560, 120),
      P('rock', 960, 560), P('lamp', 720, 400), P('barrel', 580, 460), P('crate', 1000, 460),
    ],
    npcs: [
      { id: 'iceCoach', x: 930, y: 860 },
      { id: 'iceMerchant', x: 380, y: 390 },
      { id: 'iceSeeker', x: 1180, y: 390 },
      { id: 'iceSmith', x: 420, y: 570 },
    ],
    gate: { x: 740, y: 930, w: 120, h: 30 },
    spawn: { x: 800, y: 880 },
  },
};

/** Layout of a town node (the slice town uses the capital). */
export function getTownLayout(townId: string): TownLayout {
  return TOWNS[townId] ?? TOWNS.capital!;
}
