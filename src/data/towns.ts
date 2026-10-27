// Town scenes: one screen per town (960×540 minus the top bar) with buildings, water,
// props, NPCs (src/data/npcs.ts) and the gate to the world map. Buildings and water block
// the hero; props are decoration. Coordinates are logical screen pixels.

export interface TownRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TownStyle = 'capital' | 'port' | 'forest' | 'swamp' | 'desert' | 'ice';

export type TownPropKind = 'tree' | 'pine' | 'snowPine' | 'palm' | 'reed' | 'well' | 'barrel' | 'crate' | 'lamp' | 'boat' | 'cactus' | 'rock' | 'tent' | 'fountain' | 'stall';

export interface TownBuilding extends TownRect {
  wall: string;
  roof: string;
  /** Sign over the door (Крамниця, Таверна…). */
  label?: string;
}

export interface TownLayout {
  id: string;
  style: TownStyle;
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
}

const TOP = 44;

export const TOWNS: Record<string, TownLayout> = {
  capital: {
    id: 'capital',
    style: 'capital',
    ground: '#4f6b3a',
    pathColor: '#a89a7a',
    paths: [
      { x: 430, y: TOP, w: 100, h: 496 },
      { x: 80, y: 260, w: 800, h: 70 },
      { x: 380, y: 210, w: 200, h: 170 },
    ],
    water: [],
    waterColor: '#3b6a9a',
    buildings: [
      { x: 360, y: TOP + 10, w: 240, h: 120, wall: '#c9c0aa', roof: '#7a2e2e', label: 'Палац' },
      { x: 90, y: 110, w: 170, h: 110, wall: '#b8a27a', roof: '#8a4a2a', label: 'Крамниця' },
      { x: 680, y: 110, w: 180, h: 110, wall: '#a8a8b0', roof: '#4a5a7a', label: 'Казарма' },
      { x: 90, y: 380, w: 150, h: 100, wall: '#b8a27a', roof: '#6a3a2a', label: 'Таверна' },
      { x: 700, y: 380, w: 170, h: 100, wall: '#c0b090', roof: '#5a4a6a' },
    ],
    props: [
      { kind: 'fountain', x: 480, y: 295 },
      { kind: 'lamp', x: 400, y: 230 },
      { kind: 'lamp', x: 560, y: 230 },
      { kind: 'tree', x: 300, y: 420 },
      { kind: 'tree', x: 640, y: 440 },
      { kind: 'tree', x: 40, y: 330 },
      { kind: 'tree', x: 920, y: 330 },
      { kind: 'stall', x: 290, y: 240 },
      { kind: 'barrel', x: 250, y: 470 },
      { kind: 'crate', x: 660, y: 240 },
    ],
    npcs: [
      { id: 'capitalMerchant', x: 175, y: 240 },
      { id: 'capitalGuard', x: 770, y: 240 },
      { id: 'noticeBoard', x: 600, y: 350 },
    ],
    gate: { x: 430, y: 505, w: 100, h: 35 },
    spawn: { x: 480, y: 470 },
  },
  port: {
    id: 'port',
    style: 'port',
    ground: '#8a7d5a',
    pathColor: '#6e5a3a',
    paths: [
      { x: 330, y: 250, w: 630, h: 60 },
      { x: 200, y: 140, w: 140, h: 40 },
      { x: 200, y: 380, w: 140, h: 40 },
    ],
    water: [
      { x: 0, y: TOP, w: 200, h: 496 },
      { x: 200, y: TOP, w: 130, h: 90 },
      { x: 200, y: 450, w: 130, h: 90 },
    ],
    waterColor: '#2f5a85',
    buildings: [
      { x: 400, y: 90, w: 170, h: 110, wall: '#a88a64', roof: '#2f4a6a', label: 'Крамниця' },
      { x: 640, y: 80, w: 200, h: 120, wall: '#9a8a74', roof: '#6a3a2a', label: 'Таверна «Якір»' },
      { x: 420, y: 370, w: 200, h: 110, wall: '#8a7a64', roof: '#4a4a5a', label: 'Склад' },
      { x: 700, y: 370, w: 150, h: 100, wall: '#a89a7a', roof: '#3a5a6a' },
    ],
    props: [
      { kind: 'boat', x: 110, y: 160 },
      { kind: 'boat', x: 100, y: 400 },
      { kind: 'barrel', x: 360, y: 220 },
      { kind: 'barrel', x: 380, y: 340 },
      { kind: 'crate', x: 640, y: 340 },
      { kind: 'crate', x: 660, y: 330 },
      { kind: 'lamp', x: 320, y: 240 },
      { kind: 'rock', x: 900, y: 500 },
    ],
    npcs: [
      { id: 'portMerchant', x: 485, y: 225 },
      { id: 'portFisher', x: 260, y: 160 },
    ],
    gate: { x: 925, y: 250, w: 35, h: 60 },
    spawn: { x: 880, y: 280 },
  },
  forestTown: {
    id: 'forestTown',
    style: 'forest',
    ground: '#2f4f2a',
    pathColor: '#6a5a3a',
    paths: [
      { x: 430, y: TOP, w: 90, h: 496 },
      { x: 150, y: 260, w: 660, h: 60 },
    ],
    water: [{ x: 720, y: 400, w: 150, h: 90 }],
    waterColor: '#2f5a5a',
    buildings: [
      { x: 160, y: 120, w: 160, h: 100, wall: '#7a5a3a', roof: '#3a5a2a', label: 'Крамниця' },
      { x: 600, y: 110, w: 170, h: 110, wall: '#6a4a2a', roof: '#4a3a2a', label: 'Мисливська хата' },
      { x: 170, y: 370, w: 150, h: 100, wall: '#7a5a3a', roof: '#2f4a2a' },
    ],
    props: [
      { kind: 'pine', x: 60, y: 90 },
      { kind: 'pine', x: 380, y: 100 },
      { kind: 'pine', x: 560, y: 380 },
      { kind: 'pine', x: 900, y: 120 },
      { kind: 'pine', x: 60, y: 460 },
      { kind: 'pine', x: 380, y: 470 },
      { kind: 'pine', x: 900, y: 300 },
      { kind: 'tree', x: 820, y: 230 },
      { kind: 'well', x: 560, y: 290 },
      { kind: 'crate', x: 340, y: 240 },
    ],
    npcs: [
      { id: 'forestMerchant', x: 240, y: 240 },
      { id: 'forestHunter', x: 685, y: 240 },
    ],
    gate: { x: 430, y: TOP, w: 90, h: 30 },
    spawn: { x: 475, y: 105 },
  },
  swampTown: {
    id: 'swampTown',
    style: 'swamp',
    ground: '#3a4a34',
    pathColor: '#6a5a40',
    paths: [
      { x: 60, y: 270, w: 840, h: 44 },
      { x: 456, y: 120, w: 44, h: 300 },
    ],
    water: [
      { x: 0, y: TOP, w: 960, h: 50 },
      { x: 0, y: 480, w: 960, h: 60 },
      { x: 560, y: 120, w: 160, h: 120 },
      { x: 220, y: 340, w: 160, h: 110 },
    ],
    waterColor: '#2a4a3e',
    buildings: [
      { x: 160, y: 130, w: 150, h: 100, wall: '#5a4a3a', roof: '#6a7a3a', label: 'Травниця' },
      { x: 600, y: 350, w: 160, h: 100, wall: '#5a4a3a', roof: '#4a5a3a', label: 'Човнярня' },
      { x: 780, y: 120, w: 130, h: 100, wall: '#5a4a3a', roof: '#5a6a3a' },
    ],
    props: [
      { kind: 'reed', x: 550, y: 250 },
      { kind: 'reed', x: 730, y: 130 },
      { kind: 'reed', x: 390, y: 360 },
      { kind: 'reed', x: 210, y: 440 },
      { kind: 'reed', x: 100, y: 470 },
      { kind: 'reed', x: 870, y: 470 },
      { kind: 'boat', x: 640, y: 180 },
      { kind: 'lamp', x: 440, y: 250 },
      { kind: 'barrel', x: 330, y: 250 },
    ],
    npcs: [
      { id: 'swampMerchant', x: 235, y: 250 },
      { id: 'swampBoatman', x: 680, y: 330 },
    ],
    gate: { x: 0, y: 270, w: 30, h: 44 },
    spawn: { x: 60, y: 292 },
  },
  desertTown: {
    id: 'desertTown',
    style: 'desert',
    ground: '#c9a86a',
    pathColor: '#b08a52',
    paths: [
      { x: 430, y: TOP, w: 100, h: 496 },
      { x: 120, y: 270, w: 720, h: 60 },
    ],
    water: [{ x: 410, y: 200, w: 140, h: 50 }],
    waterColor: '#3a8aa0',
    buildings: [
      { x: 120, y: 110, w: 170, h: 110, wall: '#d8b88a', roof: '#a86a3a', label: 'Базар' },
      { x: 660, y: 110, w: 170, h: 110, wall: '#d0b080', roof: '#8a5a3a', label: 'Караван-сарай' },
      { x: 130, y: 380, w: 150, h: 100, wall: '#d8c09a', roof: '#a87a4a' },
      { x: 680, y: 380, w: 150, h: 100, wall: '#d0b088', roof: '#9a6a3a' },
    ],
    props: [
      { kind: 'palm', x: 400, y: 190 },
      { kind: 'palm', x: 565, y: 190 },
      { kind: 'palm', x: 380, y: 260 },
      { kind: 'tent', x: 340, y: 400 },
      { kind: 'cactus', x: 60, y: 200 },
      { kind: 'cactus', x: 900, y: 460 },
      { kind: 'rock', x: 900, y: 220 },
      { kind: 'stall', x: 590, y: 400 },
      { kind: 'crate', x: 320, y: 250 },
    ],
    npcs: [
      { id: 'desertMerchant', x: 205, y: 250 },
      { id: 'desertCaravan', x: 745, y: 250 },
    ],
    gate: { x: 430, y: TOP, w: 100, h: 30 },
    spawn: { x: 480, y: 100 },
  },
  iceTown: {
    id: 'iceTown',
    style: 'ice',
    ground: '#d8e4ee',
    pathColor: '#a8b8c8',
    paths: [
      { x: 430, y: 200, w: 100, h: 340 },
      { x: 140, y: 260, w: 680, h: 60 },
    ],
    water: [{ x: 700, y: 410, w: 180, h: 80 }],
    waterColor: '#9ac4e0',
    buildings: [
      { x: 140, y: 110, w: 170, h: 110, wall: '#6a5a4a', roof: '#e8f0f8', label: 'Крамниця' },
      { x: 380, y: 70, w: 200, h: 110, wall: '#5a4a3a', roof: '#f4f8ff', label: 'Корчма' },
      { x: 650, y: 110, w: 170, h: 110, wall: '#6a5a4a', roof: '#e8f0f8' },
      { x: 150, y: 380, w: 150, h: 100, wall: '#5a4a3a', roof: '#f0f4fa' },
    ],
    props: [
      { kind: 'snowPine', x: 40, y: 200 },
      { kind: 'snowPine', x: 900, y: 100 },
      { kind: 'snowPine', x: 60, y: 300 },
      { kind: 'snowPine', x: 900, y: 300 },
      { kind: 'snowPine', x: 360, y: 460 },
      { kind: 'snowPine', x: 620, y: 470 },
      { kind: 'rock', x: 610, y: 380 },
      { kind: 'lamp', x: 410, y: 240 },
      { kind: 'barrel', x: 330, y: 240 },
    ],
    npcs: [
      { id: 'iceMerchant', x: 225, y: 240 },
      { id: 'iceSeeker', x: 735, y: 240 },
    ],
    gate: { x: 430, y: 505, w: 100, h: 35 },
    spawn: { x: 480, y: 470 },
  },
};

/** Layout of a town node (the slice town uses the capital). */
export function getTownLayout(townId: string): TownLayout {
  return TOWNS[townId] ?? TOWNS.capital!;
}
