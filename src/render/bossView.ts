// Boss rendering and the big boss HP bar.

import { ARENA } from '../data/balance';
import { FX } from '../data/fx';
import type { Battle } from '../systems/battle';
import type { Enemy } from '../systems/entities';
import { THEME } from './theme';
import { drawText, roundRect } from './ui';
import { drawStatusMarks } from './combatView';

type BossPainter = (ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number, flash: boolean) => void;

const painters: Record<string, BossPainter> = {
  enat: drawEnat,
};

export function drawBoss(ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number): void {
  const flash = b.time - e.hitAt < FX.hitFlash;
  const paint = painters[e.defId] ?? drawGenericBoss;
  paint(ctx, e, b, t, flash);
  drawStatusMarks(ctx, e, t);
}

function drawGenericBoss(ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number, flash: boolean): void {
  ctx.fillStyle = flash ? '#ffffff' : (b.biome.palette.enemies[e.defId] ?? '#888888');
  ctx.beginPath();
  ctx.arc(e.pos.x, e.pos.y, e.radius * (1 + 0.02 * Math.sin(t * 3)), 0, Math.PI * 2);
  ctx.fill();
}

/** Old Enat: a walking tree — bark body, ragged canopy, glowing eyes. */
function drawEnat(ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number, flash: boolean): void {
  const r = e.radius;
  const phase2 = e.boss?.phase === 2;
  const windup = (e.boss?.busy ?? 0) > 0;
  const breathe = 1 + 0.03 * Math.sin(t * (phase2 ? 5 : 2.5)) + (windup ? 0.06 * Math.sin(t * 30) : 0);
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.75, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // Roots / legs.
  ctx.strokeStyle = flash ? '#ffffff' : '#5a3d22';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.sin(t * 2 + i) * 0.12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
    ctx.quadraticCurveTo(Math.cos(a + 0.3) * r * 1.1, Math.sin(a + 0.3) * r * 1.1, Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
    ctx.stroke();
  }
  // Canopy: spiky ragged circle.
  ctx.scale(breathe, breathe);
  const canopy = flash ? '#ffffff' : (b.biome.palette.enemies[e.defId] ?? '#6b8f3a');
  ctx.fillStyle = canopy;
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r * 1.08 : r * 0.86;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = phase2 ? '#e5534b' : '#2f4a1c';
  ctx.stroke();
  // Bark face.
  ctx.fillStyle = flash ? '#ffffff' : '#6e4a2a';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.52, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes.
  ctx.fillStyle = phase2 ? '#ff5a3c' : '#ffe066';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.05, r * 0.09, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.05, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Mouth.
  ctx.strokeStyle = '#2a1a0e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, r * 0.32, r * 0.18, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}

/** Big HP bar at the top of the arena with the boss name. */
export function drawBossBar(ctx: CanvasRenderingContext2D, b: Battle, viewW: number): void {
  const boss = b.boss;
  if (!boss) return;
  const w = 520;
  const h = 20;
  const x = (viewW - w) / 2;
  const y = ARENA.y + 12;
  const frac = Math.max(0, boss.hp / boss.maxHp);
  roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fill();
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = '#3a1416';
  ctx.fill();
  if (frac > 0) {
    roundRect(ctx, x, y, w * frac, h, 4);
    ctx.fillStyle = boss.boss?.phase === 2 ? '#ff4d3a' : '#c0392b';
    ctx.fill();
  }
  // Phase-2 threshold mark.
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(x + w * 0.5 - 1, y - 2, 2, h + 4);
  drawText(ctx, boss.name, viewW / 2, y + h / 2 + 1, { size: 14, bold: true, align: 'center' });
  if (boss.boss?.phase === 2) {
    drawText(ctx, 'Фаза 2', x + w + 12, y + h / 2 + 1, { size: 13, bold: true, color: THEME.bad });
  }
}
