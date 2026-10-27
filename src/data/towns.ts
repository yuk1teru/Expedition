// Town scenes: a map per town (bigger than the screen — the camera follows the hero) with
// buildings, water, props, NPCs (src/data/npcs.ts) and the gate to the world map. Buildings
// and water block the hero; props are decoration. Coordinates are town-map pixels from the
// top-left corner. Building labels may hold name references ({name:church}).
// A building with an `interior` has a door in the middle of its lower wall: walking into
// it enters the room (INTERIORS — small layouts of the same kind, whose "gate" is the way
// out). An NPC stands either at home (in the room's `npcs`) or near it (in the town's).

export interface TownRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TownStyle = 'capital' | 'port' | 'forest' | 'swamp' | 'desert' | 'ice' | 'interior';

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
  | 'target'
  | 'bench'
  | 'candle'
  | 'chair'
  | 'cat';

export interface TownBuilding extends TownRect {
  wall: string;
  roof: string;
  /** Sign over the door (Крамниця, Таверна…). */
  label?: string;
  /** The room behind the door (INTERIORS id): walking into the door enters it. */
  interior?: string;
  /** Look: a house (default), a stone city wall or tower, a piece of furniture in a room. */
  kind?: 'house' | 'wall' | 'furniture';
}

/** A street drawn as a bent line (no collision): curved streets instead of straight paths. */
export interface TownStreet {
  points: [number, number][];
  width: number;
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
  /** Bent streets over the ground (no collision). */
  streets?: TownStreet[];
  pathColor: string;
  /** Blocking water (sea, ponds, canals). */
  water: TownRect[];
  /** Bridges drawn over gaps between water (the gaps themselves are walkable). */
  bridges?: TownRect[];
  waterColor: string;
  buildings: TownBuilding[];
  props: { kind: TownPropKind; x: number; y: number }[];
  /** NPCs standing here; `home` — the room they live or work in (they stand near it now). */
  npcs: { id: string; x: number; y: number; home?: string }[];
  /** Walking into it leads to the world map (in a room — back out to the street). */
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
    // Squares: the central one with the fountain, the market, the cathedral and palace forecourts.
    paths: [
      { x: 780, y: 460, w: 360, h: 320 },
      { x: 360, y: 460, w: 400, h: 320 },
      { x: 330, y: 335, w: 240, h: 70 },
      { x: 820, y: 280, w: 280, h: 110 },
    ],
    // Bent streets between the squares, the gate, the bridges and the quarters.
    streets: [
      { points: [[960, 1252], [960, 1110], [945, 990], [960, 890], [960, 780]], width: 110 },
      { points: [[960, 460], [948, 380], [960, 290]], width: 100 },
      { points: [[780, 560], [690, 470], [560, 400], [450, 352]], width: 70 },
      { points: [[1140, 580], [1290, 548], [1440, 470], [1515, 370], [1510, 290]], width: 70 },
      { points: [[905, 995], [800, 1105], [680, 1150], [470, 1162], [260, 1190], [130, 1222]], width: 60 },
      { points: [[1015, 995], [1110, 1110], [1240, 1150], [1500, 1162], [1760, 1140]], width: 60 },
      { points: [[520, 780], [430, 830], [395, 890], [385, 960]], width: 60 },
      { points: [[1640, 700], [1560, 800], [1525, 890], [1540, 960]], width: 60 },
      { points: [[330, 370], [180, 365], [150, 340]], width: 40 },
      { points: [[1140, 700], [1300, 760], [1500, 760], [1640, 720]], width: 50 },
    ],
    // The canal across the town; gaps in it are the bridges.
    water: [
      { x: 28, y: 860, w: 332, h: 60 },
      { x: 430, y: 860, w: 470, h: 60 },
      { x: 1020, y: 860, w: 470, h: 60 },
      { x: 1560, y: 860, w: 332, h: 60 },
    ],
    bridges: [
      { x: 360, y: 850, w: 70, h: 80 },
      { x: 900, y: 850, w: 120, h: 80 },
      { x: 1490, y: 850, w: 70, h: 80 },
    ],
    waterColor: '#3b6a9a',
    buildings: [
      // The town wall with the gate towers.
      { x: 0, y: 0, w: 1920, h: 28, wall: '#8a8478', roof: '#6a6458', kind: 'wall' },
      { x: 0, y: 0, w: 28, h: 1280, wall: '#8a8478', roof: '#6a6458', kind: 'wall' },
      { x: 1892, y: 0, w: 28, h: 1280, wall: '#8a8478', roof: '#6a6458', kind: 'wall' },
      { x: 0, y: 1252, w: 880, h: 28, wall: '#8a8478', roof: '#6a6458', kind: 'wall' },
      { x: 1040, y: 1252, w: 880, h: 28, wall: '#8a8478', roof: '#6a6458', kind: 'wall' },
      { x: 836, y: 1212, w: 44, h: 68, wall: '#7a7468', roof: '#5a5448', kind: 'wall' },
      { x: 1040, y: 1212, w: 44, h: 68, wall: '#7a7468', roof: '#5a5448', kind: 'wall' },
      // North: the palace, the cathedral by the cemetery, the barracks.
      { x: 760, y: 56, w: 400, h: 220, wall: '#d4ccb4', roof: '#7a2e2e', label: 'Палац' },
      { x: 300, y: 80, w: 300, h: 250, wall: '#e0dccf', roof: '#3a4a6a', label: '{name:church}', interior: 'cathedral' },
      { x: 1360, y: 70, w: 300, h: 200, wall: '#a8a8b0', roof: '#4a5a7a', label: 'Казарма' },
      { x: 1180, y: 300, w: 150, h: 110, wall: '#c0b090', roof: '#6a3a2a' },
      { x: 1690, y: 300, w: 160, h: 120, wall: '#b8a27a', roof: '#5a4a6a' },
      // Middle: the archery range, the curio shop, the academy.
      { x: 60, y: 400, w: 220, h: 140, wall: '#a89a74', roof: '#4a6a3a', label: 'Стрільбище' },
      { x: 1200, y: 470, w: 220, h: 150, wall: '#9a8aa8', roof: '#4a2a5a', label: 'Лавка дивин', interior: 'curioShop' },
      { x: 1500, y: 480, w: 280, h: 200, wall: '#8a9ab8', roof: '#3a3a7a', label: 'Академія' },
      // South of the canal: the tavern, the clinic and the houses.
      { x: 540, y: 960, w: 280, h: 170, wall: '#b8a27a', roof: '#6a3a2a', label: 'Таверна «Під дубом»', interior: 'capitalTavern' },
      { x: 1120, y: 960, w: 240, h: 160, wall: '#e8e4dc', roof: '#a83a3a', label: 'Лічниця', interior: 'capitalClinic' },
      { x: 90, y: 960, w: 150, h: 120, wall: '#c0b090', roof: '#7a4a2a' },
      { x: 300, y: 990, w: 160, h: 120, wall: '#c8b898', roof: '#5a4a6a', label: 'Хата Орисі', interior: 'houseOrysia' },
      { x: 90, y: 1110, w: 170, h: 110, wall: '#b8a27a', roof: '#6a3a2a' },
      { x: 1440, y: 960, w: 160, h: 120, wall: '#c0b090', roof: '#5a4a6a' },
      { x: 1650, y: 980, w: 180, h: 120, wall: '#b8a27a', roof: '#7a2e2e', label: 'Хата Матвія', interior: 'houseMatvii' },
      { x: 1460, y: 1110, w: 170, h: 110, wall: '#c0b090', roof: '#6a3a2a' },
    ],
    props: [
      P('fountain', 960, 620),
      P('lamp', 900, 1010), P('lamp', 1020, 1010), P('lamp', 895, 805), P('lamp', 1025, 805), P('lamp', 880, 440), P('lamp', 1040, 440),
      P('lamp', 690, 450), P('lamp', 1300, 520),
      P('tree', 680, 320), P('tree', 1150, 330), P('tree', 300, 800), P('tree', 1300, 810), P('tree', 1760, 800), P('tree', 640, 1215),
      P('tree', 1300, 1210), P('tree', 60, 860), P('tree', 1840, 450), P('tree', 470, 1215),
      // The market rows.
      P('stall', 440, 540), P('stall', 580, 540), P('stall', 720, 540),
      P('stall', 440, 690), P('stall', 580, 690), P('stall', 720, 690),
      P('bench', 850, 560), P('bench', 1070, 560), P('bench', 850, 700), P('bench', 1070, 700),
      P('well', 1350, 780), P('well', 230, 1235),
      P('grave', 60, 330), P('grave', 245, 330), P('grave', 150, 330),
      P('dummy', 1720, 140), P('dummy', 1800, 190), P('dummy', 1850, 120),
      P('target', 60, 640), P('target', 60, 720), P('target', 60, 800),
      P('barrel', 830, 1180), P('crate', 1090, 1180), P('barrel', 520, 1150), P('crate', 1380, 1150), P('barrel', 1180, 430),
      P('cat', 1000, 1060),
    ],
    npcs: [
      { id: 'capitalCoach', x: 1130, y: 1168 },
      // The market sellers stand behind their stalls.
      { id: 'capitalSmith', x: 440, y: 514 },
      { id: 'capitalArmorer', x: 580, y: 514 },
      { id: 'capitalHerbalist', x: 720, y: 514 },
      { id: 'capitalMerchant', x: 440, y: 664 },
      { id: 'capitalBaker', x: 580, y: 664 },
      { id: 'capitalFish', x: 720, y: 664 },
      { id: 'capitalAdvisor', x: 960, y: 330 },
      { id: 'capitalGuard', x: 1510, y: 300 },
      { id: 'warriorTeacher', x: 1760, y: 250 },
      { id: 'mageTeacher', x: 1640, y: 730 },
      { id: 'archerTeacher', x: 210, y: 690 },
      { id: 'noticeBoard', x: 1100, y: 815 },
      { id: 'capitalKid', x: 860, y: 640 },
      { id: 'capitalMatvii', x: 1800, y: 1160, home: 'houseMatvii' },
    ],
    gate: { x: 880, y: 1252, w: 160, h: 28 },
    spawn: { x: 960, y: 1200 },
    graves: [140, 210, 280].flatMap((y) => [70, 125, 180, 235].map((x) => ({ x, y }))),
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
/** A room behind a door: a small layout; its `gate` is the way out. */
export interface Interior extends TownLayout {
  name: string;
}

export function getInterior(id: string): Interior | undefined {
  return INTERIORS[id];
}

export function getTownLayout(townId: string): TownLayout {
  return TOWNS[townId] ?? TOWNS.capital!;
}

// ---- Rooms (ROADMAP 11.6) ----

const WOOD = { wall: '#6a4a2a', roof: '#8a6a3a', kind: 'furniture' as const };

/** A room: walls around (the way out in the middle of the bottom wall), the floor and its furniture. */
function room(o: {
  id: string;
  name: string;
  width: number;
  height: number;
  floor: string;
  rugs?: TownRect[];
  furniture: TownBuilding[];
  props?: { kind: TownPropKind; x: number; y: number }[];
  npcs?: { id: string; x: number; y: number }[];
}): Interior {
  const { width: W, height: H } = o;
  const wall = { wall: '#4a3a2a', roof: '#3a2a1e', kind: 'wall' as const };
  return {
    id: o.id,
    name: o.name,
    style: 'interior',
    width: W,
    height: H,
    ground: o.floor,
    paths: o.rugs ?? [],
    pathColor: '#7a2e2e',
    water: [],
    waterColor: '#3b6a9a',
    buildings: [
      { x: 0, y: 0, w: W, h: 24, ...wall },
      { x: 0, y: 0, w: 20, h: H, ...wall },
      { x: W - 20, y: 0, w: 20, h: H, ...wall },
      { x: 0, y: H - 20, w: W / 2 - 50, h: 20, ...wall },
      { x: W / 2 + 50, y: H - 20, w: W / 2 - 50, h: 20, ...wall },
      ...o.furniture,
    ],
    props: o.props ?? [],
    npcs: o.npcs ?? [],
    gate: { x: W / 2 - 50, y: H - 14, w: 100, h: 14 },
    spawn: { x: W / 2, y: H - 46 },
  };
}

export const INTERIORS: Record<string, Interior> = {
  capitalTavern: room({
    id: 'capitalTavern',
    name: 'Таверна «Під дубом»',
    width: 600,
    height: 380,
    floor: '#6a5038',
    rugs: [{ x: 250, y: 280, w: 100, h: 60 }],
    furniture: [
      { x: 160, y: 92, w: 280, h: 24, ...WOOD, label: 'Шинквас' },
      { x: 70, y: 190, w: 70, h: 46, ...WOOD },
      { x: 265, y: 196, w: 70, h: 46, ...WOOD },
      { x: 460, y: 190, w: 70, h: 46, ...WOOD },
    ],
    props: [
      P('barrel', 190, 60), P('barrel', 410, 60), P('barrel', 540, 60), P('crate', 60, 60),
      P('chair', 60, 260), P('chair', 150, 260), P('chair', 255, 266), P('chair', 345, 266), P('chair', 450, 260), P('chair', 540, 260),
      P('candle', 105, 205), P('candle', 300, 211), P('candle', 495, 205),
    ],
    npcs: [
      { id: 'capitalBarman', x: 300, y: 74 },
      { id: 'tavernWanderer', x: 105, y: 286 },
    ],
  }),
  capitalClinic: room({
    id: 'capitalClinic',
    name: 'Лічниця',
    width: 480,
    height: 320,
    floor: '#a8a49a',
    furniture: [
      { x: 40, y: 50, w: 60, h: 110, wall: '#e8e4dc', roof: '#c0392b', kind: 'furniture' },
      { x: 120, y: 50, w: 60, h: 110, wall: '#e8e4dc', roof: '#c0392b', kind: 'furniture' },
      { x: 380, y: 50, w: 60, h: 110, wall: '#e8e4dc', roof: '#c0392b', kind: 'furniture' },
      { x: 220, y: 24, w: 120, h: 28, ...WOOD, label: 'Полиця з травами' },
    ],
    props: [P('candle', 210, 90), P('chair', 330, 200)],
    npcs: [{ id: 'capitalDoctor', x: 280, y: 130 }],
  }),
  cathedral: room({
    id: 'cathedral',
    name: '{name:church}',
    width: 560,
    height: 460,
    floor: '#8a8478',
    rugs: [{ x: 252, y: 110, w: 56, h: 330 }],
    furniture: [
      { x: 230, y: 50, w: 100, h: 40, wall: '#e8e4dc', roof: '#c8a050', kind: 'furniture', label: 'Вівтар' },
      { x: 70, y: 180, w: 170, h: 22, ...WOOD },
      { x: 320, y: 180, w: 170, h: 22, ...WOOD },
      { x: 70, y: 260, w: 170, h: 22, ...WOOD },
      { x: 320, y: 260, w: 170, h: 22, ...WOOD },
      { x: 70, y: 340, w: 170, h: 22, ...WOOD },
      { x: 320, y: 340, w: 170, h: 22, ...WOOD },
    ],
    props: [P('candle', 200, 70), P('candle', 360, 70), P('candle', 60, 60), P('candle', 500, 60)],
    npcs: [{ id: 'capitalPriest', x: 280, y: 124 }],
  }),
  curioShop: room({
    id: 'curioShop',
    name: 'Лавка дивин',
    width: 440,
    height: 300,
    floor: '#5a4a5a',
    rugs: [{ x: 170, y: 160, w: 100, h: 70 }],
    furniture: [
      { x: 120, y: 92, w: 200, h: 22, ...WOOD, label: 'Прилавок' },
      { x: 30, y: 24, w: 80, h: 26, ...WOOD },
      { x: 330, y: 24, w: 80, h: 26, ...WOOD },
    ],
    props: [P('candle', 140, 100), P('candle', 300, 100), P('crate', 60, 200), P('barrel', 380, 200)],
    npcs: [{ id: 'artifactBuyer', x: 220, y: 74 }],
  }),
  houseOrysia: room({
    id: 'houseOrysia',
    name: 'Хата Орисі',
    width: 400,
    height: 280,
    floor: '#7a6044',
    rugs: [{ x: 150, y: 150, w: 100, h: 60 }],
    furniture: [
      { x: 30, y: 30, w: 70, h: 100, wall: '#e8dcc0', roof: '#8a3a3a', kind: 'furniture' },
      { x: 250, y: 110, w: 80, h: 46, ...WOOD },
      { x: 300, y: 24, w: 80, h: 26, ...WOOD },
    ],
    props: [P('chair', 230, 175), P('chair', 350, 175), P('candle', 290, 125), P('cat', 120, 200)],
    npcs: [{ id: 'capitalOrysia', x: 180, y: 120 }],
  }),
  houseMatvii: room({
    id: 'houseMatvii',
    name: 'Хата Матвія',
    width: 400,
    height: 280,
    floor: '#6a5038',
    furniture: [
      { x: 300, y: 30, w: 70, h: 100, wall: '#d8ccb0', roof: '#4a5a6a', kind: 'furniture' },
      { x: 60, y: 110, w: 90, h: 46, ...WOOD },
      { x: 30, y: 24, w: 90, h: 26, ...WOOD, label: 'Старі інструменти' },
    ],
    props: [P('chair', 105, 180), P('barrel', 220, 60), P('cat', 250, 200)],
  }),
};

/** Where an NPC stands: the town, and the room if at home (null — nowhere in the towns). */
export function npcPlace(npcId: string): { town: string; interior?: string } | null {
  for (const town of Object.values(TOWNS)) {
    if (town.npcs.some((n) => n.id === npcId)) return { town: town.id };
    for (const b of town.buildings) {
      if (b.interior && INTERIORS[b.interior]?.npcs.some((n) => n.id === npcId)) return { town: town.id, interior: b.interior };
    }
  }
  return null;
}

/** Every NPC placed in the towns (outside or at home). */
export function allTownNpcs(): string[] {
  const out: string[] = [];
  for (const town of Object.values(TOWNS)) {
    out.push(...town.npcs.map((n) => n.id));
    for (const b of town.buildings) if (b.interior) out.push(...(INTERIORS[b.interior]?.npcs.map((n) => n.id) ?? []));
  }
  return out;
}
