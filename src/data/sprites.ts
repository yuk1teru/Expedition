// Sprites (ROADMAP 19.1): every painter of the game can take a picture instead of its code
// drawing. A picture lives at `public/sprites/<kind>/<id>.png` and is listed in
// `public/sprites/index.json` (only listed pictures are loaded — no failed requests); without
// one the code drawing stays. The kinds and their ids come from the game data.

import { ARENAS } from './arenas';
import { BOSSES } from './bosses';
import { CLASSES } from './classes';
import { ENEMIES } from './enemies';
import { ITEM_KINDS } from './items';
import { PROMOTIONS } from './promotions';
import { TOWNS } from './towns';

export type SpriteKind = 'hero' | 'enemy' | 'boss' | 'item' | 'obstacle' | 'prop';

export interface SpriteKindDef {
  /** What it is (prompts, the wiki). */
  name: string;
  /** Size of the picture, px (square). */
  size: number;
  /** Turned towards where it faces (seen from above, facing right). */
  rotate: boolean;
  /** The ids of this kind. */
  ids: () => string[];
}

export const SPRITE_KINDS: Record<SpriteKind, SpriteKindDef> = {
  hero: { name: 'Герой (клас або гілка)', size: 96, rotate: true, ids: () => [...Object.keys(CLASSES), ...Object.keys(PROMOTIONS), 'novice'] },
  enemy: { name: 'Ворог', size: 96, rotate: true, ids: () => Object.keys(ENEMIES) },
  boss: { name: 'Бос або мінібос', size: 192, rotate: true, ids: () => Object.keys(BOSSES) },
  item: { name: 'Річ (іконка)', size: 64, rotate: false, ids: () => Object.values(ITEM_KINDS).flatMap((k) => k.map((x) => x.id)) },
  obstacle: { name: 'Перешкода арени', size: 128, rotate: false, ids: () => [...new Set(Object.values(ARENAS).flatMap((a) => a.obstacles.map((o) => o.kind)))] },
  prop: { name: 'Предмет у місті', size: 96, rotate: false, ids: () => [...new Set(Object.values(TOWNS).flatMap((t) => t.props.map((p) => p.kind)))] },
};

/** The picture of a sprite, relative to the site root. */
export function spritePath(kind: SpriteKind, id: string): string {
  return `sprites/${kind}/${id}.png`;
}
