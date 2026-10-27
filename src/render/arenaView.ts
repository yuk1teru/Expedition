// Arena obstacles and terrain on the battlefield (ROADMAP 13.1): water with ripples,
// thorn patches, tall grass; trees, rocks, stumps and pillars seen from above.

import type { ArenaObstacle } from '../data/arenas';
import type { Battle } from '../systems/battle';

/** Water and grass take the look of the land: murky bog water, thin ice, snowdrifts (ROADMAP 16). */
const WATER_LOOK: Record<string, string> = { swamp: 'rgba(58, 84, 52, 0.88)', swampEdge: 'rgba(52, 90, 70, 0.85)', ice: 'rgba(170, 210, 235, 0.75)' };
const GRASS_LOOK: Record<string, { fill: string; blade: string }> = {
  ice: { fill: 'rgba(235, 242, 250, 0.7)', blade: 'rgba(255, 255, 255, 0.9)' },
  swamp: { fill: 'rgba(90, 110, 50, 0.55)', blade: 'rgba(170, 170, 90, 0.85)' },
};

export function drawArenaTerrain(ctx: CanvasRenderingContext2D, b: Battle, t: number): void {
  const land = b.node.biome ?? '';
  for (const a of b.arena.terrain) {
    ctx.save();
    if (a.kind === 'water') {
      ctx.fillStyle = WATER_LOOK[land] ?? 'rgba(52, 104, 158, 0.85)';
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
      const look = GRASS_LOOK[land];
      ctx.fillStyle = look?.fill ?? 'rgba(74, 120, 50, 0.55)';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.strokeStyle = look?.blade ?? 'rgba(140, 190, 90, 0.8)';
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
  } else if (o.kind === 'deadTree') {
    // A bare grey trunk with crooked branches (the bog).
    ctx.strokeStyle = '#5a5248';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * o.r, Math.sin(a) * o.r * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = '#4a4238';
    ctx.beginPath();
    ctx.arc(0, 0, o.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.kind === 'cactus') {
    ctx.fillStyle = '#4f8a3a';
    ctx.beginPath();
    ctx.arc(0, 0, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8e0b0';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * o.r * 0.8, Math.sin(a) * o.r * 0.8);
      ctx.lineTo(Math.cos(a) * o.r * 1.25, Math.sin(a) * o.r * 1.25);
      ctx.stroke();
    }
  } else if (o.kind === 'bone') {
    // A giant's rib arching out of the sand.
    ctx.strokeStyle = '#e8e0cc';
    ctx.lineWidth = o.r * 0.45;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, o.r * 0.4, o.r, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = '#d8d0b8';
    ctx.beginPath();
    ctx.arc(0, 0, o.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.kind === 'ice') {
    ctx.fillStyle = 'rgba(190, 225, 245, 0.95)';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const rr = o.r * (0.8 + 0.2 * Math.sin(i * 1.7));
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 170, 210, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(-o.r * 0.3, -o.r * 0.3, o.r * 0.25, 0, Math.PI * 2);
    ctx.fill();
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
