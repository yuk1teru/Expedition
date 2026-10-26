// Boss body rendering.

import type { Battle } from '../systems/battle';
import type { Enemy } from '../systems/entities';

export function drawBoss(ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number): void {
  const color = b.biome.palette.enemies[e.defId] ?? '#888888';
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  ctx.fillStyle = b.time - e.hitAt < 0.08 ? '#ffffff' : color;
  ctx.beginPath();
  ctx.arc(0, 0, e.radius * (1 + 0.02 * Math.sin(t * 3)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
