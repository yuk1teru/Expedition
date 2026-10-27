// The world: a fixed map with towns, locations, roads and terrain. Every location has
// its own enemies, miniboss (or boss), mechanics and difficulty (tier → recommended
// level = tier × 3). Coordinates are world-map pixels (the map zooms from 25%).
//
//            Сніжногір'я ─ Крига (far north-east, only through the mountain pass)
//                 │
//         Гірський перевал
//                 │
//  море ─ Чайкова Гавань ─ Прибережна дорога ─ Златоград (столиця)
//                                                │
//                                        Ліс (Смерекове) ─ Мокролісся ─ Болото (Очеретянка)
//                                                │
//                                         Сухе узлісся
//                                                │
//                                        Пустеля (Барханськ)

import type { NameForms } from './names';
import type { WeatherId } from './weather';

export type WorldNodeKind = 'town' | 'location' | 'boss';

/** What happens on a location besides its waves (all optional, see DEFAULT_MECHANICS). */
export interface LocationMechanics {
  /** Steel traps on the ground from this wave on (null: never). */
  trapsFrom: number | null;
  /** Every 5th wave brings an event, these in turn: bad weather / the Gale Spirit. */
  events: ('weather' | 'elemental')[];
  /** Weather types that can come with a weather event. */
  weathers: WeatherId[];
  /** Herbs grow on the arena. */
  herbs: boolean;
}

export const DEFAULT_MECHANICS: LocationMechanics = {
  trapsFrom: 4,
  events: ['weather', 'elemental'],
  weathers: ['fog', 'rain', 'storm'],
  herbs: true,
};

export interface WorldNodeDef {
  id: string;
  name: string;
  /** Case forms of the name for references in texts ({town:capital:in} → «Ізяславі»). */
  forms?: NameForms;
  kind: WorldNodeKind;
  /** Look of the arena (palette, decor) and the default roster: src/data/biomes.ts. */
  biome: string;
  /** Region on the world map the node belongs to (for labels and the Wiki). */
  region: string;
  /** Monster level (ROADMAP 10.1; towns: 0): enemy strength, rewards and item levels follow it. */
  level: number;
  pos: { x: number; y: number };
  /** One line for the map tooltip and the Wiki. */
  description: string;
  /** Enemy ids of the waves (default: the biome roster). */
  enemies?: string[];
  /** Miniboss of every 3rd wave (default: the biome miniboss; '' — none). */
  miniboss?: string;
  /** Boss of a boss location. */
  boss?: string;
  mechanics?: Partial<LocationMechanics>;
}

export const CAPITAL_ID = 'capital';

export const WORLD_NODES: WorldNodeDef[] = [
  // ---------------- Towns ----------------
  { id: CAPITAL_ID, name: 'Ізяслав', kind: 'town', biome: 'forest', region: 'plains', level: 0, pos: { x: 1150, y: 620 }, forms: { of: 'Ізяслава', in: 'Ізяславі' }, description: 'Столиця королівства: звідси дороги ведуть у всі краї.' },
  { id: 'port', name: 'Чайкова Гавань', kind: 'town', biome: 'coast', region: 'coast', level: 0, pos: { x: 430, y: 700 }, forms: { of: 'Чайкової Гавані', in: 'Чайковій Гавані' }, description: 'Портове місто на березі моря: кораблі, рибалки й чутки з-за моря.' },
  { id: 'forestTown', name: 'Смерекове', kind: 'town', biome: 'forest', region: 'forest', level: 0, pos: { x: 1160, y: 930 }, forms: { of: 'Смерекового', in: 'Смерековому' }, description: 'Лісове містечко мисливців посеред Лісу.' },
  { id: 'swampTown', name: 'Очеретянка', kind: 'town', biome: 'swamp', region: 'swamp', level: 0, pos: { x: 1890, y: 780 }, forms: { of: 'Очеретянки', in: 'Очеретянці' }, description: 'Село на палях серед Болота.' },
  { id: 'desertTown', name: 'Барханськ', kind: 'town', biome: 'desert', region: 'desert', level: 0, pos: { x: 1160, y: 1450 }, forms: { of: 'Барханська', in: 'Барханську' }, description: 'Піщане місто-оаза в серці Пустелі.' },
  { id: 'iceTown', name: 'Сніжногір’я', kind: 'town', biome: 'ice', region: 'ice', level: 0, pos: { x: 1700, y: 160 }, forms: { of: 'Сніжногір’я', in: 'Сніжногір’ї' }, description: 'Гірське поселення серед вічних снігів.' },

  // ---------------- Coast (Столиця → порт) ----------------
  { id: 'coastRoad', name: 'Прибережна дорога', kind: 'location', biome: 'coast', region: 'coast', level: 7, pos: { x: 790, y: 650 }, description: 'Скелястий берег: чайки-розбійниці й краби. Погода тут мінлива — злива або туман.', mechanics: { weathers: ['rain', 'fog'], trapsFrom: null } },

  // ---------------- Forest ----------------
  { id: 'quietGrove', name: 'Тихий гай', kind: 'location', biome: 'forest', region: 'forest', level: 5, pos: { x: 1060, y: 790 }, description: 'Найближчий до столиці гай: вовки, гриби й пеньки. Без капканів.', mechanics: { trapsFrom: null } },
  { id: 'wolfTrail', name: 'Вовча стежка', kind: 'location', biome: 'forest', region: 'forest', level: 6, pos: { x: 1260, y: 800 }, description: 'Стежка вовчих зграй: вовків тут удвічі більше.', enemies: ['wolf', 'wolf', 'mushroom', 'stump'] },
  { id: 'mushroomGlade', name: 'Грибна галявина', kind: 'location', biome: 'forest', region: 'forest', level: 8, pos: { x: 980, y: 1010 }, description: 'Галявина грибів-плювак: багато стрільців і туман.', enemies: ['mushroom', 'mushroom', 'wolf', 'stump'], mechanics: { weathers: ['fog'] } },
  { id: 'mossyRavine', name: 'Моховий яр', kind: 'location', biome: 'forest', region: 'forest', level: 9, pos: { x: 1320, y: 1010 }, description: 'Сирий яр на межі з болотом: пеньки й злива.', enemies: ['stump', 'stump', 'wolf', 'mushroom'], mechanics: { weathers: ['rain'] } },
  { id: 'darkThicket', name: 'Темна гущавина', kind: 'location', biome: 'forest', region: 'forest', level: 10, pos: { x: 850, y: 1100 }, description: 'Хаща перед лігвом Ената: гроза й капкани вже з 3-ї хвилі.', mechanics: { trapsFrom: 3, weathers: ['storm'] } },
  { id: 'enatLair', name: 'Лігво Старого Ената', kind: 'boss', biome: 'forest', region: 'forest', level: 14, pos: { x: 720, y: 1180 }, description: 'Старий Енат: коріння, виклик вовків, удар навколо себе.', boss: 'enat' },

  // ---------------- Forest → Swamp ----------------
  { id: 'wetwood', name: 'Мокролісся', kind: 'location', biome: 'swampEdge', region: 'swampEdge', level: 12, pos: { x: 1500, y: 930 }, description: 'Ліс, що тоне в болоті: мохові ропухи, болотяні гриби й гнилі пні.', mechanics: { weathers: ['fog', 'rain'] } },

  // ---------------- Swamp ----------------
  { id: 'fogMire', name: 'Туманна трясовина', kind: 'location', biome: 'swamp', region: 'swamp', level: 13, pos: { x: 1660, y: 840 }, description: 'Вічний туман: погода тут — лише туман.', mechanics: { weathers: ['fog'] } },
  { id: 'rotMarsh', name: 'Гнилі мочари', kind: 'location', biome: 'swamp', region: 'swamp', level: 15, pos: { x: 1740, y: 700 }, description: 'Слизні, що діляться, і болотяники.', enemies: ['slime', 'slime', 'frog', 'bogman'] },
  { id: 'frogPond', name: 'Жаб’яче озерце', kind: 'location', biome: 'swamp', region: 'swamp', level: 16, pos: { x: 2040, y: 680 }, description: 'Царство жаб: стрибки з усіх боків.', enemies: ['frog', 'frog', 'slime', 'bogman'] },
  { id: 'blackMuck', name: 'Чорна багнюка', kind: 'location', biome: 'swamp', region: 'swamp', level: 18, pos: { x: 2080, y: 860 }, description: 'Липка багнюка перед гніздом: капкани з 3-ї хвилі, злива.', mechanics: { trapsFrom: 3, weathers: ['rain'] } },
  { id: 'motherNest', name: 'Гніздо Отруйної Матері', kind: 'boss', biome: 'swamp', region: 'swamp', level: 21, pos: { x: 2250, y: 760 }, description: 'Отруйна Мати: калюжі отрути, слизні, токсична хвиля.', boss: 'poisonMother' },

  // ---------------- Forest → Desert ----------------
  { id: 'dryEdge', name: 'Сухе узлісся', kind: 'location', biome: 'scrub', region: 'scrub', level: 12, pos: { x: 1150, y: 1180 }, description: 'Ліс рідшає, починається пісок: шакали, колючі кущі, пилові вепри.', mechanics: { weathers: ['storm'] } },

  // ---------------- Desert ----------------
  { id: 'sandDunes', name: 'Піщані дюни', kind: 'location', biome: 'desert', region: 'desert', level: 13, pos: { x: 1020, y: 1320 }, description: 'Дюни скорпіонів.', enemies: ['scorpion', 'scorpion', 'cactus', 'scarab'], mechanics: { trapsFrom: null } },
  { id: 'dryRiver', name: 'Сухе русло', kind: 'location', biome: 'desert', region: 'desert', level: 15, pos: { x: 1290, y: 1330 }, description: 'Колишня річка: кактуси вздовж берегів.', enemies: ['cactus', 'cactus', 'scorpion', 'scarab'] },
  { id: 'boneValley', name: 'Кістяна долина', kind: 'location', biome: 'desert', region: 'desert', level: 16, pos: { x: 980, y: 1560 }, description: 'Скарабеї серед кісток: багато розпаду на малих.', enemies: ['scarab', 'scarab', 'scorpion', 'cactus'] },
  { id: 'scorchedPlain', name: 'Розпечена рівнина', kind: 'location', biome: 'desert', region: 'desert', level: 18, pos: { x: 1340, y: 1580 }, description: 'Гроза над піском і капкани з 3-ї хвилі.', mechanics: { trapsFrom: 3, weathers: ['storm'] } },
  { id: 'wormBurrow', name: 'Нора Піщаного Хробака', kind: 'boss', biome: 'desert', region: 'desert', level: 22, pos: { x: 1160, y: 1700 }, description: 'Піщаний Хробак: зарививається, кислота, піщана буря.', boss: 'sandWorm' },

  // ---------------- Mountain pass (Столиця → Крига) ----------------
  { id: 'foothills', name: 'Передгір’я', kind: 'location', biome: 'mountain', region: 'mountain', level: 16, pos: { x: 1200, y: 470 }, description: 'Підніжжя гір: гірські цапи, гарпії, кам’яники.', mechanics: { weathers: ['rain', 'fog'] } },
  { id: 'mountainPass', name: 'Гірський перевал', kind: 'location', biome: 'mountain', region: 'mountain', level: 18, pos: { x: 1330, y: 330 }, description: 'Єдиний шлях у Кригу: вітер, туман і Дух бурі частіше.', miniboss: 'frostWarden', mechanics: { events: ['elemental', 'weather'], weathers: ['fog', 'storm'] } },

  // ---------------- Ice ----------------
  { id: 'whiteSlope', name: 'Білий схил', kind: 'location', biome: 'ice', region: 'ice', level: 20, pos: { x: 1540, y: 230 }, description: 'Крижані вовки на засніженому схилі.', enemies: ['iceWolf', 'iceWolf', 'snowman', 'iceGolem'] },
  { id: 'iceLake', name: 'Крижане озеро', kind: 'location', biome: 'ice', region: 'ice', level: 22, pos: { x: 1880, y: 230 }, description: 'Сніговики на льоду: туман над озером.', enemies: ['snowman', 'snowman', 'iceWolf', 'iceGolem'], mechanics: { weathers: ['fog'] } },
  { id: 'glassGlacier', name: 'Скляний льодовик', kind: 'location', biome: 'ice', region: 'ice', level: 24, pos: { x: 2050, y: 150 }, description: 'Големи перед цитаделлю: капкани з 3-ї хвилі.', enemies: ['iceGolem', 'iceGolem', 'iceWolf', 'snowman'], mechanics: { trapsFrom: 3 } },
  { id: 'iceCitadel', name: 'Цитадель Крижаного Лицаря', kind: 'boss', biome: 'ice', region: 'ice', level: 26, pos: { x: 2220, y: 210 }, description: 'Крижаний Лицар: таран до стіни, кільце шипів, аура холоду.', boss: 'iceKnight' },
];

/** Roads between nodes (both ways). */
export const WORLD_ROADS: [string, string][] = [
  [CAPITAL_ID, 'coastRoad'],
  ['coastRoad', 'port'],
  [CAPITAL_ID, 'quietGrove'],
  [CAPITAL_ID, 'wolfTrail'],
  ['quietGrove', 'wolfTrail'],
  ['quietGrove', 'forestTown'],
  ['wolfTrail', 'forestTown'],
  ['forestTown', 'mushroomGlade'],
  ['forestTown', 'mossyRavine'],
  ['mushroomGlade', 'darkThicket'],
  ['darkThicket', 'enatLair'],
  ['mossyRavine', 'wetwood'],
  ['wetwood', 'fogMire'],
  ['fogMire', 'rotMarsh'],
  ['fogMire', 'swampTown'],
  ['rotMarsh', 'swampTown'],
  ['swampTown', 'frogPond'],
  ['swampTown', 'blackMuck'],
  ['frogPond', 'motherNest'],
  ['blackMuck', 'motherNest'],
  ['mushroomGlade', 'dryEdge'],
  ['mossyRavine', 'dryEdge'],
  ['dryEdge', 'sandDunes'],
  ['dryEdge', 'dryRiver'],
  ['sandDunes', 'desertTown'],
  ['dryRiver', 'desertTown'],
  ['desertTown', 'boneValley'],
  ['desertTown', 'scorchedPlain'],
  ['boneValley', 'wormBurrow'],
  ['scorchedPlain', 'wormBurrow'],
  [CAPITAL_ID, 'foothills'],
  ['foothills', 'mountainPass'],
  ['mountainPass', 'whiteSlope'],
  ['whiteSlope', 'iceTown'],
  ['iceTown', 'iceLake'],
  ['iceLake', 'glassGlacier'],
  ['glassGlacier', 'iceCitadel'],
];

/**
 * Terrain of the world map (drawn behind the roads): the map size, the sea (west),
 * soft biome regions (unions of circles), mountain ridges and region labels.
 */
export const WORLD_MAP = {
  width: 2400,
  height: 1820,
  land: '#2a3324',
  sea: { color: '#173250', shore: '#c9b98a', /** Coastline x at y (from north to south). */ coast: [[560, 0], [470, 220], [520, 420], [430, 600], [360, 760], [420, 980], [300, 1240], [380, 1500], [260, 1820]] as [number, number][] },
  regions: [
    { id: 'plains', name: 'Королівські поля', color: '#3a4a2a', blobs: [[1150, 620, 230], [900, 640, 170], [1380, 600, 170]] },
    { id: 'coast', name: 'Узбережжя', color: '#4a4a36', blobs: [[560, 680, 150], [720, 650, 120]] },
    { id: 'forest', name: 'Ліс', color: '#24452a', blobs: [[1100, 920, 230], [880, 1080, 200], [1300, 980, 170], [740, 1170, 140]] },
    { id: 'swampEdge', name: 'Мокролісся', color: '#2a4a3e', blobs: [[1500, 930, 120]] },
    { id: 'swamp', name: 'Болото', color: '#25433d', blobs: [[1750, 780, 200], [2000, 770, 200], [2230, 770, 140]] },
    { id: 'scrub', name: 'Сухе узлісся', color: '#4a4a2a', blobs: [[1150, 1190, 140]] },
    { id: 'desert', name: 'Пустеля', color: '#7a6640', blobs: [[1150, 1450, 250], [950, 1580, 200], [1350, 1580, 200], [1160, 1710, 160]] },
    { id: 'mountain', name: 'Гори', color: '#3b3d44', blobs: [[1220, 430, 150], [1340, 320, 150], [1600, 420, 160], [1900, 470, 180], [900, 380, 170]] },
    { id: 'ice', name: 'Крига', color: '#8fa6b8', blobs: [[1560, 220, 150], [1760, 170, 160], [1960, 210, 170], [2200, 190, 170]] },
  ] as { id: string; name: string; color: string; blobs: [number, number, number][] }[],
  /** Peaks drawn as little triangles. */
  peaks: [[880, 340], [960, 420], [1060, 360], [1180, 300], [1440, 400], [1520, 460], [1640, 390], [1760, 470], [1840, 400], [1980, 480], [2080, 420], [2200, 470], [1250, 230]] as [number, number][],
} as const;
