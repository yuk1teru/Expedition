// Unique item art: the kind decides the shape, rarity the main colour,
// the item's own look adds an accent colour, a gem and a small shape variation.

import { drawSprite } from './sprites';
import { RARITIES } from '../data/items';
import type { Item } from '../systems/items';

type Painter = (ctx: CanvasRenderingContext2D, r: number, main: string, accent: string, s: number) => void;

const OUTLINE = 'rgba(0,0,0,0.55)';

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

const PAINTERS: Record<string, Painter> = {
  // ---- weapons (drawn diagonally) ----
  sword(ctx, r, main, accent, s) {
    ctx.rotate(-Math.PI / 4);
    const len = r * (0.85 + 0.15 * s);
    poly(ctx, [[-r * 0.1, r * 0.25], [-r * 0.1, -len + r * 0.15], [0, -len], [r * 0.1, -len + r * 0.15], [r * 0.1, r * 0.25]]);
    fillStroke(ctx, accent);
    ctx.fillStyle = main;
    ctx.fillRect(-r * 0.38, r * 0.22, r * 0.76, r * 0.12);
    ctx.fillRect(-r * 0.07, r * 0.34, r * 0.14, r * 0.42);
  },
  axe(ctx, r, main, accent, s) {
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = main;
    ctx.fillRect(-r * 0.07, -r * 0.8, r * 0.14, r * 1.6);
    ctx.beginPath();
    ctx.moveTo(r * 0.07, -r * 0.7);
    ctx.quadraticCurveTo(r * (0.75 + 0.15 * s), -r * 0.45, r * 0.07, -r * 0.1);
    ctx.closePath();
    fillStroke(ctx, accent);
  },
  mace(ctx, r, main, accent) {
    ctx.rotate(-Math.PI / 5);
    ctx.fillStyle = main;
    ctx.fillRect(-r * 0.07, -r * 0.2, r * 0.14, r);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? r * 0.48 : r * 0.33;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, -r * 0.45 + Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, -r * 0.45 + Math.sin(a) * rr);
    }
    ctx.closePath();
    fillStroke(ctx, accent);
  },
  dagger(ctx, r, main, accent, s) {
    ctx.rotate(-Math.PI / 4);
    const len = r * (0.5 + 0.15 * s);
    poly(ctx, [[-r * 0.12, r * 0.05], [0, -len], [r * 0.12, r * 0.05]]);
    fillStroke(ctx, accent);
    ctx.fillStyle = main;
    ctx.fillRect(-r * 0.28, r * 0.05, r * 0.56, r * 0.1);
    ctx.fillRect(-r * 0.06, r * 0.15, r * 0.12, r * 0.4);
  },
  spear(ctx, r, main, accent) {
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = main;
    ctx.fillRect(-r * 0.05, -r * 0.55, r * 0.1, r * 1.45);
    poly(ctx, [[0, -r * 0.95], [r * 0.16, -r * 0.6], [0, -r * 0.48], [-r * 0.16, -r * 0.6]]);
    fillStroke(ctx, accent);
  },
  // ---- hats ----
  brim(ctx, r, main, accent, s) {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * (0.8 + 0.15 * s), r * 0.2, 0, 0, Math.PI * 2);
    fillStroke(ctx, main);
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.28);
    ctx.quadraticCurveTo(-r * 0.4, -r * 0.6, 0, -r * 0.62);
    ctx.quadraticCurveTo(r * 0.4, -r * 0.6, r * 0.42, r * 0.28);
    ctx.closePath();
    fillStroke(ctx, main);
    ctx.fillStyle = accent;
    ctx.fillRect(-r * 0.42, r * 0.08, r * 0.84, r * 0.12);
  },
  hood(ctx, r, main, accent) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.quadraticCurveTo(r * 0.8, -r * 0.1, r * 0.55, r * 0.7);
    ctx.lineTo(-r * 0.55, r * 0.7);
    ctx.quadraticCurveTo(-r * 0.8, -r * 0.1, 0, -r * 0.8);
    fillStroke(ctx, main);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.2, r * 0.3, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  },
  helm(ctx, r, main, accent) {
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.62, Math.PI, 0);
    ctx.lineTo(r * 0.62, r * 0.55);
    ctx.lineTo(-r * 0.62, r * 0.55);
    ctx.closePath();
    fillStroke(ctx, main);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-r * 0.45, r * 0.12, r * 0.9, r * 0.12);
    ctx.fillStyle = accent;
    ctx.fillRect(-r * 0.05, -r * 0.55, r * 0.1, r * 0.65);
  },
  crown(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.7, r * 0.45], [-r * 0.7, -r * 0.35], [-r * 0.35, r * 0.05], [0, -r * 0.6], [r * 0.35, r * 0.05], [r * 0.7, -r * 0.35], [r * 0.7, r * 0.45]]);
    fillStroke(ctx, main);
    ctx.fillStyle = accent;
    ctx.fillRect(-r * 0.7, r * 0.3, r * 1.4, r * 0.15);
  },
  band(ctx, r, main, accent) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.75, r * 0.32, 0, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.22;
    ctx.strokeStyle = main;
    ctx.stroke();
    poly(ctx, [[r * 0.55, r * 0.15], [r * 0.85, r * 0.75], [r * 0.6, r * 0.65]]);
    fillStroke(ctx, accent);
  },
  // ---- armor ----
  jacket(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.8, -r * 0.5], [-r * 0.3, -r * 0.75], [0, -r * 0.5], [r * 0.3, -r * 0.75], [r * 0.8, -r * 0.5], [r * 0.6, -r * 0.05], [r * 0.5, r * 0.8], [-r * 0.5, r * 0.8], [-r * 0.6, -r * 0.05]]);
    fillStroke(ctx, main);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.5);
    ctx.lineTo(0, r * 0.8);
    ctx.stroke();
  },
  mail(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.7, -r * 0.6], [r * 0.7, -r * 0.6], [r * 0.6, r * 0.8], [-r * 0.6, r * 0.8]]);
    fillStroke(ctx, main);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    for (let i = -2; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, i * r * 0.25);
      ctx.lineTo(r * 0.62, i * r * 0.25);
      ctx.stroke();
    }
  },
  plate(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.85, -r * 0.55], [-r * 0.35, -r * 0.7], [r * 0.35, -r * 0.7], [r * 0.85, -r * 0.55], [r * 0.55, r * 0.75], [-r * 0.55, r * 0.75]]);
    fillStroke(ctx, main);
    ctx.fillStyle = accent;
    ctx.fillRect(-r * 0.5, -r * 0.05, r, r * 0.1);
    ctx.fillRect(-r * 0.45, r * 0.3, r * 0.9, r * 0.1);
  },
  robe(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.35, -r * 0.8], [r * 0.35, -r * 0.8], [r * 0.75, r * 0.85], [-r * 0.75, r * 0.85]]);
    fillStroke(ctx, main);
    ctx.fillStyle = accent;
    ctx.fillRect(-r * 0.62, r * 0.55, r * 1.24, r * 0.12);
    ctx.fillRect(-r * 0.06, -r * 0.8, r * 0.12, r * 1.4);
  },
  vest(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.55, -r * 0.75], [-r * 0.15, -r * 0.4], [r * 0.15, -r * 0.4], [r * 0.55, -r * 0.75], [r * 0.6, r * 0.8], [-r * 0.6, r * 0.8]]);
    fillStroke(ctx, main);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  },
  // ---- boots ----
  boots(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.35, -r * 0.85], [r * 0.15, -r * 0.85], [r * 0.15, r * 0.2], [r * 0.8, r * 0.35], [r * 0.8, r * 0.75], [-r * 0.35, r * 0.75]]);
    fillStroke(ctx, main);
    ctx.fillStyle = accent;
    ctx.fillRect(-r * 0.35, -r * 0.85, r * 0.5, r * 0.18);
  },
  shoes(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.6, -r * 0.05], [r * 0.05, -r * 0.05], [r * 0.25, r * 0.2], [r * 0.85, r * 0.35], [r * 0.85, r * 0.65], [-r * 0.6, r * 0.65]]);
    fillStroke(ctx, main);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, r * 0.05);
    ctx.lineTo(r * 0.1, r * 0.25);
    ctx.stroke();
  },
  sandals(ctx, r, main, accent) {
    ctx.fillStyle = main;
    ctx.fillRect(-r * 0.75, r * 0.5, r * 1.5, r * 0.18);
    ctx.strokeStyle = accent;
    ctx.lineWidth = r * 0.1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.55 + i * r * 0.5, r * 0.5);
      ctx.lineTo(-r * 0.3 + i * r * 0.5, -r * 0.2);
      ctx.stroke();
    }
  },
  greaves(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.35, -r * 0.85], [r * 0.35, -r * 0.85], [r * 0.3, r * 0.35], [r * 0.7, r * 0.5], [r * 0.7, r * 0.8], [-r * 0.35, r * 0.8]]);
    fillStroke(ctx, main);
    ctx.fillStyle = accent;
    ctx.fillRect(-r * 0.3, -r * 0.45, r * 0.6, r * 0.12);
    ctx.fillRect(-r * 0.3, -r * 0.1, r * 0.6, r * 0.12);
  },
  wraps(ctx, r, main, accent) {
    poly(ctx, [[-r * 0.3, -r * 0.8], [r * 0.25, -r * 0.8], [r * 0.25, r * 0.25], [r * 0.75, r * 0.4], [r * 0.75, r * 0.75], [-r * 0.3, r * 0.75]]);
    fillStroke(ctx, main);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.7 + i * r * 0.3);
      ctx.lineTo(r * 0.25, -r * 0.55 + i * r * 0.3);
      ctx.stroke();
    }
  },
};

/** Draws an item's unique art; unidentified items are dimmed with a "?" on top. */
export function drawItem(ctx: CanvasRenderingContext2D, item: Item, x: number, y: number, size: number): void {
  // A picture, if there is one (ROADMAP 19.1).
  ctx.save();
  if (!item.identified) ctx.globalAlpha = 0.45;
  const drawn = drawSprite(ctx, 'item', item.kind, x, y, size);
  ctx.restore();
  if (drawn) return;
  const r = size / 2;
  const main = RARITIES[item.rarity].color;
  const paint = PAINTERS[item.kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  if (!item.identified) ctx.globalAlpha = 0.45;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  paint?.(ctx, r, main, item.look.accent, item.look.shape);
  ctx.restore();
  if (item.identified && item.look.gem) {
    ctx.fillStyle = item.look.gem;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(r * 0.55, -r * 0.55, Math.max(2.5, r * 0.13), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (!item.identified) {
    ctx.font = `bold ${Math.round(size * 0.6)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText('?', 0, 2);
    ctx.fillStyle = main;
    ctx.fillText('?', 0, 2);
  }
  ctx.restore();
}
