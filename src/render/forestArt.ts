// The Forest's ground and props drawn from the generated pictures (data/forestArt.ts). Until the
// pictures load (and in Node) the callers draw the old code figures.

import { FOREST_ART, type PropPart, WEB_ART } from '../data/forestArt';
import type { Obstacle } from '../systems/rework/types';
import { lookSheet, sheet } from './heroAnim';

const F = FOREST_ART;

/** The props atlas, or null while it loads. */
export function propsAtlas(): HTMLImageElement | null {
  return sheet(F.props);
}

/**
 * Covers the view (world rect) with the ground texture, one tile = its size in world px; false
 * while it loads. Drawn as whole tiles: a repeating pattern over the screen cost about 9 ms a frame
 * (software canvas), the tiles about a tenth of that.
 */
export function drawGround(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): boolean {
  const img = sheet(F.ground);
  if (!img) return false;
  const t = img.naturalWidth;
  for (let ty = Math.floor(y / t) * t; ty < y + h; ty += t) {
    for (let tx = Math.floor(x / t) * t; tx < x + w; tx += t) ctx.drawImage(img, tx, ty);
  }
  return true;
}

/** A per-obstacle pick out of `n` from its seed; the second pick (mirror) from further digits. */
const pick = (o: Obstacle, n: number): number => Math.floor(o.seed * n) % n;
const mirrored = (o: Obstacle): boolean => Math.floor(o.seed * 997) % 2 === 1;

const part = (piece: number, scale: number, mirror = false, dx = 0, dy = 0): PropPart => ({ piece, scale, dx, dy, mirror });

/** The pieces an obstacle is drawn from. */
export function obstacleParts(o: Obstacle): PropPart[] {
  const width = (piece: number, k: number): number => (o.radius * k) / F.pieces[piece]!.rect[2];
  switch (o.kind) {
    case 'tree':
      return [part(F.trees[pick(o, F.trees.length)]!, o.height * F.treeScale, mirrored(o))];
    case 'oak':
      return [part(F.oak, F.oakScale)];
    case 'bush': {
      const p = F.bushes[pick(o, F.bushes.length)]!;
      return [part(p, width(p, F.bushWidth), mirrored(o))];
    }
    case 'stone': {
      const p = F.stones.find((s) => o.radius <= s.upTo)!.piece;
      return [part(p, width(p, F.stoneWidth), mirrored(o))];
    }
    case 'stoneRing': {
      const [rx, ry] = F.stoneRingOval;
      return F.stoneRing.map((s) => part(s.piece, s.scale, s.mirror, Math.cos((s.angle * Math.PI) / 180) * rx, Math.sin((s.angle * Math.PI) / 180) * ry));
    }
    case 'log':
      return [part(F.log, F.logScale, mirrored(o))];
  }
}

/** The box a set of parts covers around the foot (world px). */
export function partsBox(parts: PropPart[]): { left: number; top: number; right: number; bottom: number } {
  let left = 0;
  let top = 0;
  let right = 0;
  let bottom = 0;
  for (const p of parts) {
    const [, , w, h] = F.pieces[p.piece]!.rect;
    const [ax, ay] = F.pieces[p.piece]!.anchor;
    const ox = p.mirror ? w - ax : ax;
    left = Math.min(left, p.dx - ox * p.scale);
    right = Math.max(right, p.dx + (w - ox) * p.scale);
    top = Math.min(top, p.dy - ay * p.scale);
    bottom = Math.max(bottom, p.dy + (h - ay) * p.scale);
  }
  return { left, top, right, bottom };
}

/** The crown of a tree drawn from a picture (it fades when someone stands behind it). */
export function artCrown(o: Obstacle): { x: number; y: number; r: number } | null {
  if (o.kind !== 'tree' && o.kind !== 'oak') return null;
  const box = partsBox(obstacleParts(o));
  const tall = -box.top;
  return { x: o.pos.x, y: o.pos.y - tall * 0.58, r: tall * 0.4 };
}

/** One piece with its foot at (x, y); `flash` — brightened by a hit. */
export function drawPart(ctx: CanvasRenderingContext2D, img: HTMLImageElement, p: PropPart, x: number, y: number, flash = false): void {
  const [sx, sy, w, h] = F.pieces[p.piece]!.rect;
  const [ax, ay] = F.pieces[p.piece]!.anchor;
  ctx.save();
  ctx.translate(x + p.dx, y + p.dy);
  ctx.scale(p.mirror ? -p.scale : p.scale, p.scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(flash ? lookSheet(img, F.props, 'flash') : img, sx, sy, w, h, -ax, -ay, w, h);
  ctx.restore();
}

/** A single prop piece (den, shrine, altar, chest, herb) at a foot point; false while the atlas loads. */
export function drawProp(ctx: CanvasRenderingContext2D, piece: number, scale: number, x: number, y: number, flash = false): boolean {
  const img = propsAtlas();
  if (!img) return false;
  drawPart(ctx, img, part(piece, scale), x, y, flash);
  return true;
}

const tinted = new Map<string, HTMLCanvasElement>();

/**
 * One piece of the atlas on its own canvas with a filter baked in (the Old Enat as living wood,
 * as stone, flashing; his ghost): drawn often, filtered once.
 */
export function tintedPiece(piece: number, filter: string): { pic: HTMLCanvasElement; anchor: [number, number] } | null {
  const img = propsAtlas();
  if (!img || typeof document === 'undefined') return null;
  const key = `${piece}|${filter}`;
  let c = tinted.get(key);
  const [sx, sy, w, h] = F.pieces[piece]!.rect;
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.filter = filter;
    g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    tinted.set(key, c);
  }
  return { pic: c, anchor: F.pieces[piece]!.anchor };
}

/** The webs atlas, or null while it loads. */
export function webAtlas(): HTMLImageElement | null {
  return sheet(WEB_ART.src);
}

/**
 * A piece of the webs atlas with its anchor at (x, y): scaled, maybe mirrored or turned (a blob in
 * flight), faded, flashing from a hit; false while the atlas loads.
 */
export function drawWebPiece(ctx: CanvasRenderingContext2D, piece: number, x: number, y: number, scale: number, o: { mirror?: boolean; angle?: number; alpha?: number; flash?: boolean } = {}): boolean {
  const img = webAtlas();
  if (!img) return false;
  const [sx, sy, w, h] = WEB_ART.pieces[piece]!.rect;
  const [ax, ay] = WEB_ART.pieces[piece]!.anchor;
  ctx.save();
  ctx.translate(x, y);
  if (o.angle) ctx.rotate(o.angle);
  ctx.scale(o.mirror ? -scale : scale, scale);
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.drawImage(o.flash ? lookSheet(img, WEB_ART.src, 'flash') : img, sx, sy, w, h, -ax, -ay, w, h);
  ctx.restore();
  return true;
}
