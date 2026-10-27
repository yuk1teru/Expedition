// The painted world map behind roads and towns: land, the sea with its shore, soft
// biome regions with little glyphs (trees, reeds, dunes, snow), mountain peaks and region
// names. Painted once into an offscreen canvas (world pixels) and reused.

import { Rng } from '../core/rng';
import { WORLD_MAP } from '../data/world';
import { font } from './theme';

let cache: HTMLCanvasElement | null = null;

export function worldTerrain(): HTMLCanvasElement {
  if (cache) return cache;
  const c = document.createElement('canvas');
  c.width = WORLD_MAP.width;
  c.height = WORLD_MAP.height;
  const ctx = c.getContext('2d')!;
  paint(ctx);
  cache = c;
  return c;
}

function paint(ctx: CanvasRenderingContext2D): void {
  const { width: W, height: H } = WORLD_MAP;
  const rng = new Rng(1234);
  ctx.fillStyle = WORLD_MAP.land;
  ctx.fillRect(0, 0, W, H);

  // Biome regions with soft edges.
  ctx.save();
  ctx.filter = 'blur(28px)';
  for (const r of WORLD_MAP.regions) {
    ctx.fillStyle = r.color;
    for (const [x, y, rad] of r.blobs) {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Glyphs inside regions.
  for (const r of WORLD_MAP.regions) {
    for (const [x, y, rad] of r.blobs) {
      const n = Math.round((rad * rad) / 1800);
      for (let i = 0; i < n; i++) {
        const a = rng.float(0, Math.PI * 2);
        const d = Math.sqrt(rng.next()) * rad * 0.85;
        glyph(ctx, r.id, x + Math.cos(a) * d, y + Math.sin(a) * d, rng);
      }
    }
  }

  // Mountain peaks.
  for (const [x, y] of WORLD_MAP.peaks) peak(ctx, x, y, 34 + rng.float(0, 14));

  // The sea west of the coastline, with a sandy shore and ripples.
  const coast = WORLD_MAP.sea.coast;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (const [x, y] of coast) ctx.lineTo(x, y);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = WORLD_MAP.sea.color;
  ctx.fill();
  ctx.strokeStyle = WORLD_MAP.sea.shore;
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  coast.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160, 200, 230, 0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const y = rng.float(0, H);
    const x = rng.float(20, seaEdgeAt(y) - 40);
    ctx.beginPath();
    ctx.arc(x, y, 9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // Region names.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(44, 'bold');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  for (const r of WORLD_MAP.regions) {
    if (r.id === 'swampEdge' || r.id === 'scrub' || r.id === 'coast') continue;
    const [x, y] = r.blobs[0]!;
    ctx.fillText(r.name.toUpperCase(), x, y - 70);
  }
  ctx.font = font(52, 'bold');
  ctx.fillStyle = 'rgba(180, 210, 240, 0.18)';
  ctx.fillText('МОРЕ', 170, 1100);
  ctx.restore();
}

/** x of the coastline at height y. */
function seaEdgeAt(y: number): number {
  const c = WORLD_MAP.sea.coast;
  for (let i = 1; i < c.length; i++) {
    const [x0, y0] = c[i - 1]!;
    const [x1, y1] = c[i]!;
    if (y >= y0 && y <= y1) return x0 + ((x1 - x0) * (y - y0)) / Math.max(1, y1 - y0);
  }
  return c[c.length - 1]![0];
}

function peak(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#5b5f66';
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.6);
  ctx.lineTo(x, y - s * 0.8);
  ctx.lineTo(x + s, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8eef4';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.32, y - s * 0.28);
  ctx.lineTo(x, y - s * 0.8);
  ctx.lineTo(x + s * 0.32, y - s * 0.28);
  ctx.closePath();
  ctx.fill();
}

function glyph(ctx: CanvasRenderingContext2D, region: string, x: number, y: number, rng: Rng): void {
  switch (region) {
    case 'forest':
    case 'swampEdge': {
      const s = rng.float(7, 12);
      ctx.fillStyle = region === 'forest' ? '#1c3a20' : '#22403a';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.4);
      ctx.lineTo(x + s, y + s * 0.6);
      ctx.lineTo(x - s, y + s * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'swamp': {
      ctx.strokeStyle = '#3f6a5a';
      ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * 4, y + 6);
        ctx.lineTo(x + k * 5, y - 8);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30, 60, 55, 0.6)';
      ctx.beginPath();
      ctx.ellipse(x + 10, y + 6, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'desert':
    case 'scrub': {
      ctx.strokeStyle = region === 'desert' ? '#9a8452' : '#6a6a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + 8, 14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    }
    case 'ice': {
      ctx.fillStyle = 'rgba(240, 248, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(x, y, rng.float(2, 4), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'mountain':
      peak(ctx, x, y, rng.float(14, 22));
      break;
    case 'plains':
    case 'coast': {
      ctx.fillStyle = 'rgba(120, 150, 80, 0.35)';
      ctx.fillRect(x, y, 3, 3);
      break;
    }
  }
}
