// The Forest's ground and props from generated pictures (rework, VISION §10). The ground is a
// seamless texture (docs/art/locations/forest/ground.png, shrunk to one 640 px tile = 640 world px). The
// props were generated as one sheet (docs/art/locations/forest/obstacles.png) and cut into an atlas by
// scripts/cut-props.py (SCALE=0.65); `pieces` is its output: a rect in the atlas and the foot
// point inside it. Sizes below turn atlas px into world px.

export interface PropPiece {
  /** x, y, w, h in the atlas. */
  rect: [number, number, number, number];
  /** The foot point inside the rect (the middle of the grass base it stands on). */
  anchor: [number, number];
}

/** One piece of a prop: which, how big and how far from the prop's foot (world px). */
export interface PropPart {
  piece: number;
  scale: number;
  dx: number;
  dy: number;
  mirror: boolean;
}

export const FOREST_ART = {
  ground: 'sprites/forest-ground.jpg',
  props: 'sprites/forest-props.png',
  pieces: [
    { rect: [0, 0, 148, 270], anchor: [73, 244] },
    { rect: [150, 0, 306, 360], anchor: [167, 317] },
    { rect: [458, 0, 140, 247], anchor: [65, 224] },
    { rect: [600, 0, 118, 249], anchor: [58, 226] },
    { rect: [720, 0, 161, 241], anchor: [79, 216] },
    { rect: [883, 0, 171, 229], anchor: [86, 201] },
    { rect: [1056, 0, 161, 169], anchor: [63, 142] },
    { rect: [1219, 0, 153, 124], anchor: [85, 105] },
    { rect: [1374, 0, 128, 112], anchor: [63, 96] },
    { rect: [1504, 0, 153, 120], anchor: [82, 101] },
    { rect: [1659, 0, 159, 125], anchor: [92, 106] },
    { rect: [1820, 0, 105, 87], anchor: [47, 73] },
    { rect: [1927, 0, 83, 65], anchor: [40, 53] },
    { rect: [0, 362, 83, 84], anchor: [40, 71] },
    { rect: [85, 362, 144, 215], anchor: [57, 192] },
    { rect: [231, 362, 232, 115], anchor: [49, 99] },
    { rect: [465, 362, 248, 116], anchor: [128, 87] },
    { rect: [715, 362, 130, 172], anchor: [84, 153] },
    { rect: [847, 362, 132, 126], anchor: [68, 108] },
    { rect: [981, 362, 196, 110], anchor: [119, 84] },
    { rect: [1179, 362, 150, 103], anchor: [57, 86] },
    { rect: [1331, 362, 124, 106], anchor: [58, 86] },
  ] as PropPiece[],
  /** Three pines, two old crooked trees, a dead one grown round a stone; drawn `treeScale` × the tree's height. */
  trees: [0, 2, 3, 4, 5, 6],
  treeScale: 0.0064,
  /** The Old Oak (a landmark). */
  oak: 1,
  oakScale: 0.95,
  /** Bushes: as wide as `bushWidth` × the blocking radius. */
  bushes: [7, 8, 9],
  bushWidth: 4.2,
  /** Stones by size: a pebble up to radius 13, a rock up to 17, a boulder above; `stoneWidth` × radius wide. */
  stones: [
    { piece: 12, upTo: 13 },
    { piece: 11, upTo: 17 },
    { piece: 10, upTo: Infinity },
  ],
  stoneWidth: 4,
  /**
   * The Stone Ring: standing stones (and two boulders) on an oval around its foot, each drawn on
   * its own so the hero stands in front of the back ones and behind the front ones. Angle 0° is
   * right, 90° — towards the viewer. The sheet's groups of two and three stones overlap and do not
   * cut apart cleanly, so the ring is built of its one single stone, mirrored and sized.
   */
  stoneRing: [
    { piece: 13, angle: -165, scale: 0.85, mirror: false },
    { piece: 13, angle: -118, scale: 1.0, mirror: true },
    { piece: 12, angle: -90, scale: 0.55, mirror: false },
    { piece: 13, angle: -62, scale: 0.9, mirror: false },
    { piece: 13, angle: -15, scale: 0.8, mirror: true },
    { piece: 13, angle: 35, scale: 0.95, mirror: false },
    { piece: 11, angle: 82, scale: 0.5, mirror: true },
    { piece: 13, angle: 128, scale: 0.85, mirror: true },
  ],
  stoneRingOval: [64, 38] as [number, number],
  log: 15,
  logScale: 0.69,
  den: 16,
  denScale: 0.6,
  /** The shrine's crystal (glows in the colour of its buff), from the foot, world px. */
  shrine: 18,
  shrineScale: 0.63,
  shrineGem: [-4, -33] as [number, number],
  altar: 19,
  altarScale: 0.46,
  /** The altar's candle flame, from the foot, world px. */
  altarFlame: [0, -33] as [number, number],
  chest: 20,
  chestScale: 0.33,
  herb: 21,
  herbScale: 0.26,
};

/**
 * The deeper forest's webs (docs/art/locations/deep-forest/webs.png, cut by scripts/cut-props.py
 * with SCALE=0.5): the task's cocoon whole, cracked (about to hatch) and torn (destroyed); a web
 * on the ground; two cobwebs for tree crowns; the cocoon and the web blob in flight (facing right).
 */
export const WEB_ART = {
  src: 'sprites/web-props.png',
  pieces: [
    { rect: [0, 0, 216, 224], anchor: [103, 186] },
    { rect: [218, 0, 206, 222], anchor: [102, 186] },
    { rect: [426, 0, 242, 223], anchor: [118, 180] },
    { rect: [670, 0, 234, 115], anchor: [117, 57] },
    { rect: [906, 0, 228, 142], anchor: [114, 71] },
    { rect: [1136, 0, 246, 172], anchor: [123, 86] },
    { rect: [1384, 0, 244, 110], anchor: [162, 55] },
    { rect: [1630, 0, 146, 60], anchor: [110, 30] },
  ] as PropPiece[],
  cocoon: 0,
  cracked: 1,
  torn: 2,
  cocoonScale: 0.32,
  ground: 3,
  /** The ground web is drawn this many times its patch radius wide. */
  groundWidth: 2.4,
  cobwebs: [4, 5],
  cobwebWidth: 74,
  cocoonShot: 6,
  webShot: 7,
  shotScale: 0.32,
};

/** A set of props a location's obstacles are drawn from (the Forest's, the lair's, the Old Enat's boulders). */
export interface PropSet {
  props: string;
  pieces: PropPiece[];
  ground?: string;
  trees?: number[];
  treeScale?: number;
  oak?: number;
  oakScale?: number;
  bushes?: number[];
  bushWidth?: number;
  stones?: { piece: number; upTo: number }[];
  stoneWidth?: number;
  stoneRing?: { piece: number; angle: number; scale: number; mirror: boolean }[];
  stoneRingOval?: [number, number];
  log?: number;
  logScale?: number;
}

/**
 * The lair of the Old Enat (docs/art/locations/lair/, cut with SCALE=0.65): its ground; dead trees
 * and root arches instead of trees, a withered bush, rune stones, a hollow log; the landmarks — a
 * ring of old stumps and bones with antlers among roots.
 */
export const LAIR_ART: PropSet = {
  props: 'sprites/lair-props.png',
  ground: 'sprites/lair-ground.jpg',
  pieces: [
    { rect: [0, 0, 348, 243], anchor: [154, 188] },
    { rect: [350, 0, 331, 244], anchor: [152, 188] },
    { rect: [683, 0, 306, 261], anchor: [177, 210] },
    { rect: [991, 0, 326, 181], anchor: [159, 131] },
    { rect: [1319, 0, 326, 183], anchor: [146, 131] },
    { rect: [1647, 0, 325, 159], anchor: [162, 122] },
    { rect: [0, 263, 280, 209], anchor: [137, 164] },
    { rect: [282, 263, 239, 247], anchor: [114, 212] },
    { rect: [523, 263, 200, 202], anchor: [107, 170] },
    { rect: [725, 263, 163, 195], anchor: [72, 166] },
    { rect: [890, 263, 159, 156], anchor: [82, 129] },
  ],
  /** The dead tree twice as often as each root arch. */
  trees: [7, 7, 0, 1, 2],
  /** Drawn a little smaller than the Forest's; their blocking circle is wider (REWORK_LOCATIONS: treeRadius). */
  treeScale: 0.0052,
  oak: 6,
  oakScale: 0.85,
  bushes: [10],
  bushWidth: 4.2,
  stones: [
    { piece: 9, upTo: 15 },
    { piece: 8, upTo: Infinity },
  ],
  stoneWidth: 4.4,
  stoneRing: [{ piece: 5, angle: 90, scale: 0.75, mirror: false }],
  stoneRingOval: [0, 0],
  log: 3,
  logScale: 0.5,
};

/**
 * The Old Enat's strikes (docs/art/bosses/enat/fx.png, SCALE=0.5): roots — cracks, half out, full;
 * a stone spike — crack, half, full; a row of thorns; his grabbing branch (its base at the anchor,
 * the claw to the right); the mossy boulders that rise when the forest turns to stone.
 */
export const ENAT_FX: PropSet & { roots: number[]; spike: number[]; thorns: number; branch: number } = {
  props: 'sprites/enat-fx.png',
  pieces: [
    { rect: [0, 0, 278, 208], anchor: [141, 160] },
    { rect: [280, 0, 249, 172], anchor: [117, 134] },
    { rect: [531, 0, 227, 118], anchor: [113, 70] },
    { rect: [760, 0, 138, 154], anchor: [70, 130] },
    { rect: [900, 0, 145, 115], anchor: [66, 103] },
    { rect: [1047, 0, 247, 115], anchor: [123, 100] },
    { rect: [1296, 0, 151, 91], anchor: [75, 55] },
    { rect: [1449, 0, 382, 149], anchor: [20, 80] },
    { rect: [1833, 0, 173, 142], anchor: [90, 114] },
    { rect: [0, 210, 198, 138], anchor: [92, 104] },
  ],
  roots: [2, 1, 0],
  spike: [6, 4, 3],
  thorns: 5,
  branch: 7,
  stones: [
    { piece: 8, upTo: 21 },
    { piece: 9, upTo: Infinity },
  ],
  stoneWidth: 4.6,
};

/**
 * Small things on the field (docs/art/fx/items.png, cut along a grid with SCALE=0.2): the experience
 * crystal, the coin, the mushroom's spore. Each frame's centre is the thing's centre; `size` — how
 * many world px the frame's height becomes (the glow included).
 */
export const ITEM_ART = {
  src: 'sprites/anim/items.png',
  gem: { rect: [0, 0, 148, 145] as [number, number, number, number], size: 26, bigSize: 36 },
  coin: { rect: [148, 0, 132, 145] as [number, number, number, number], size: 21 },
  /** The mushroom's spore in flight (docs/art/fx/spore.png, SCALE=0.2): three pulsing frames, nose right. */
  spore: { src: 'sprites/anim/spore.png', frames: [[12, 46, 112, 72], [124, 46, 134, 72], [258, 46, 166, 72]] as [number, number, number, number][], height: 26, fps: 10 },
};

/**
 * Warnings on the ground (docs/art/fx/telegraphs.png, shrunk to half: 768 × 512). Coordinates
 * below are of the full sheet. A strip is laid from three pieces — claw scratches where the beast
 * pushes off (under its paws), the band repeated along the way, the arrowhead at the end — each in
 * an empty version (the warning) and a full one (laid over it as the blow comes). `band` — the
 * band's centre line and its height in the sheet. Circles: centre and the ring's half-width.
 */
export const TELEGRAPH_ART = {
  src: 'sprites/anim/telegraphs.png',
  sheetScale: 0.5,
  strips: [
    { start: [0, 100, 382, 380], startAt: [200, 255], mid: [420, 150, 790, 380], end: [845, 150, 1131, 380], band: [265, 100] },
    { start: [0, 385, 385, 691], startAt: [200, 552], mid: [420, 440, 790, 690], end: [843, 440, 1128, 690], band: [562, 112] },
  ] as { start: number[]; startAt: number[]; mid: number[]; end: number[]; band: number[] }[],
  circles: [
    { rect: [1131, 100, 1536, 380], at: [1324, 253], rx: 175 },
    { rect: [1128, 385, 1536, 691], at: [1324, 551], rx: 185 },
  ] as { rect: number[]; at: number[]; rx: number }[],
  safe: [
    { rect: [0, 691, 718, 1024], at: [476, 842], rx: 237 },
    { rect: [718, 691, 1536, 1024], at: [981, 845], rx: 241 },
  ] as { rect: number[]; at: number[]; rx: number }[],
};

/** The Berehynia's sign, a life (docs/art/ui/signs.png, cut along a grid with SCALE=0.25): lit, out, then three frames of going out. */
export const SIGN_ART = {
  src: 'sprites/ui-signs.png',
  frames: [[0, 10, 102, 130], [102, 10, 99, 130], [201, 10, 120, 130], [321, 10, 104, 130], [425, 10, 135, 130]] as [number, number, number, number][],
  lit: 0,
  out: 1,
  fading: [2, 3, 4],
  fadeTime: 0.9,
};

