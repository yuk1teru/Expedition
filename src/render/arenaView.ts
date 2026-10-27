// Arena obstacles and terrain on the battlefield (ROADMAP 13.1): water with ripples,
// thorn patches, tall grass; trees, rocks, stumps and pillars seen from above.

import type { ArenaObstacle } from '../data/arenas';
import type { Battle } from '../systems/battle';

export function drawArenaTerrain(ctx: CanvasRenderingContext2D, b: Battle, t: number): void {
  for (const a of b.arena.terrain) {
    ctx.save();
    if (a.kind === 'water') {
      ctx.fillStyle = 'rgba(52, 104, 158, 0.85)';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      const n = Math.max(3, Math.round((a.w * a.h) / 6000));
      for (let i = 0; i < n; i++) {
        const x = a.x + (((i * 0.618 + t * 0.04) % 1) * (a.w - 30)) + 15;
        const y = a.y + ((i * 0.381) % 1) * (a.h - 14) + 7;
        ctx.beginPath();
        ctx.arc(x, y + Math.sin(t * 2 + i) * 2, 8, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else if (a.kind === 'thorns') {
      ctx.fillStyle = 'rgba(70, 40, 40, 0.55)';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.strokeStyle = '#8a4a3a';
      ctx.lineWidth = 2;
      for (let x = a.x + 8; x < a.x + a.w - 4; x += 16) {
        for (let y = a.y + 10; y < a.y + a.h - 4; y += 18) {
          const k = (x * 7 + y * 13) % 5;
          ctx.beginPath();
          ctx.moveTo(x - 5, y + 4);
          ctx.lineTo(x + k - 2, y - 6);
          ctx.lineTo(x + 5, y + 4);
          ctx.stroke();
        }
      }
    } else {
      ctx.fillStyle = 'rgba(74, 120, 50, 0.55)';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.strokeStyle = 'rgba(140, 190, 90, 0.8)';
      ctx.lineWidth = 2;
      for (let x = a.x + 6; x < a.x + a.w - 2; x += 12) {
        for (let y = a.y + 12; y < a.y + a.h; y += 14) {
          const sway = Math.sin(t * 2 + x * 0.05) * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + sway, y - 10);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: ArenaObstacle): void {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 6, o.r, o.r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (o.kind === 'tree') {
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath();
    ctx.arc(0, 0, o.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(46, 92, 46, 0.95)';
    ctx.beginPath();
    ctx.arc(0, -4, o.r * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(90, 140, 70, 0.6)';
    ctx.beginPath();
    ctx.arc(-o.r * 0.3, -o.r * 0.4, o.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.kind === 'rock') {
    ctx.fillStyle = '#7a7a82';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const rr = o.r * (0.85 + 0.15 * Math.sin(i * 2.3));
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(-o.r * 0.3, -o.r * 0.3, o.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.kind === 'stump') {
    ctx.fillStyle = '#6a4a2a';
    ctx.beginPath();
    ctx.arc(0, 0, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a07a50';
    ctx.lineWidth = 1.5;
    for (const k of [0.35, 0.65]) {
      ctx.beginPath();
      ctx.arc(0, 0, o.r * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#9a9488';
    ctx.beginPath();
    ctx.arc(0, 0, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6a6458';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawObstacles(ctx: CanvasRenderingContext2D, b: Battle): void {
  for (const o of b.arena.obstacles) drawObstacle(ctx, o);
}
