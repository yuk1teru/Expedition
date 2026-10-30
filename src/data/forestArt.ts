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
