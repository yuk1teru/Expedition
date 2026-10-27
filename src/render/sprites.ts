// The sprite layer (ROADMAP 19.1): pictures listed in `sprites/index.json` are loaded once;
// `drawSprite` draws one if it is ready and says so — otherwise the caller draws with code.

import { type SpriteKind, spritePath } from '../data/sprites';

const images = new Map<string, HTMLImageElement>();
let listed: Set<string> | null = null;

/** Reads the list of pictures that exist (once; without it no picture is loaded). */
export function loadSpriteIndex(base = ''): void {
  if (listed !== null || typeof fetch === 'undefined') return;
  listed = new Set();
  fetch(`${base}sprites/index.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((list: unknown) => {
      if (Array.isArray(list)) for (const p of list) if (typeof p === 'string') listed!.add(p);
    })
    .catch(() => {
      // No pictures: everything is drawn with code.
    });
}

function image(kind: SpriteKind, id: string): HTMLImageElement | null {
  const path = spritePath(kind, id);
  if (!listed?.has(path) || typeof Image === 'undefined') return null;
  let img = images.get(path);
  if (!img) {
    img = new Image();
    img.src = path;
    images.set(path, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Draws the picture centred at (x, y), `size` px, turned by `angle`; false — none (draw with code). */
export function drawSprite(ctx: CanvasRenderingContext2D, kind: SpriteKind, id: string, x: number, y: number, size: number, angle = 0): boolean {
  const img = image(kind, id);
  if (!img) return false;
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}
