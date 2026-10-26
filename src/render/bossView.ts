// Boss rendering and the big boss HP bar.

import { FX } from '../data/fx';
import type { Battle } from '../systems/battle';
import { bossDefOf } from '../systems/boss';
import type { Enemy } from '../systems/entities';
import { drawText, roundRect } from './ui';
import { drawStatusMarks } from './combatView';

type BossPainter = (ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number, flash: boolean) => void;

const painters: Record<string, BossPainter> = {
  enat: drawEnat,
  alpha: drawAlpha,
  galeSpirit: drawGaleSpirit,
};

export function drawBoss(ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number): void {
  const flash = b.time - e.hitAt < FX.hitFlash;
  drawBossMarker(ctx, e, t);
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

/** Alpha wolf: big pale wolf with a mane; glows red while winding up a lunge. */
function drawAlpha(ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number, flash: boolean): void {
  const r = e.radius;
  const windup = (e.boss?.busy ?? 0) > 0 && !e.boss?.dash;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.7, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  if (windup) {
    ctx.fillStyle = `rgba(255, 70, 60, ${0.25 + 0.2 * Math.sin(t * 25)})`;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(e.facing);
  // Mane spikes.
  ctx.fillStyle = flash ? '#ffffff' : '#8f98a6';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.55 + (i / 6) * Math.PI * 0.9;
    ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
    ctx.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25);
    ctx.lineTo(Math.cos(a + 0.25) * r * 0.5, Math.sin(a + 0.25) * r * 0.5);
  }
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : (b.biome.palette.enemies[e.defId] ?? '#dfe4ec');
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 1.4, 0);
  ctx.lineTo(-r, r * 0.7);
  ctx.lineTo(-r * 0.55, 0);
  ctx.lineTo(-r, -r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff4d3a';
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.18, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.55, r * 0.18, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Gale Spirit: a spinning cloud of wind with a bright core. */
function drawGaleSpirit(ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number, flash: boolean): void {
  const r = e.radius;
  const color = flash ? '#ffffff' : (b.biome.palette.enemies[e.defId] ?? '#9fe3ff');
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = t * 4 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.6 + 0.15 * i), a, a + 1.9);
    ctx.stroke();
  }
  ctx.fillStyle = flash ? '#ffffff' : '#e9fbff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(e.facing);
  ctx.fillStyle = '#1b3a52';
  ctx.beginPath();
  ctx.arc(r * 0.18, -r * 0.13, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.18, r * 0.13, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function markerColor(e: Enemy): string {
  return bossDefOf(e)?.miniboss ? FX.bossMarker.miniColor : FX.bossMarker.bossColor;
}

/** Pulsing ring on the ground so the boss stands out in the crowd. */
function drawBossMarker(ctx: CanvasRenderingContext2D, e: Enemy, t: number): void {
  const M = FX.bossMarker;
  const pulse = 1 + M.pulse * Math.sin(t * M.speed);
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = markerColor(e);
  ctx.beginPath();
  ctx.ellipse(0, e.radius * 0.35, e.radius * M.scale * pulse, e.radius * M.scale * 0.6 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = markerColor(e);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.lineDashOffset = -t * 30;
  ctx.stroke();
  ctx.restore();
}

/** Name and a short HP bar floating above a boss / miniboss. */
export function drawBossPlate(ctx: CanvasRenderingContext2D, e: Enemy): void {
  if (e.dead) return;
  const P = FX.bossPlate;
  const w = Math.max(P.minWidth, e.radius * 2.6);
  const x = e.pos.x - w / 2;
  const y = e.pos.y - e.radius - P.gap;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(x - 1, y - 1, w + 2, P.height + 2);
  ctx.fillStyle = markerColor(e);
  ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), P.height);
  drawText(ctx, e.name, e.pos.x, y - 9, { size: 12, bold: true, align: 'center', color: markerColor(e) });
}

/** Boss / miniboss HP bar for the HUD: name inside, phase-2 mark, "Мінібос" tag. */
export function drawBossBar(ctx: CanvasRenderingContext2D, boss: Enemy, r: { x: number; y: number; w: number; h: number }): void {
  const def = bossDefOf(boss);
  const frac = Math.max(0, boss.hp / boss.maxHp);
  const phase2 = boss.boss?.phase === 2;
  roundRect(ctx, r.x, r.y, r.w, r.h, 5);
  ctx.fillStyle = '#3a1416';
  ctx.fill();
  if (frac > 0) {
    roundRect(ctx, r.x, r.y, r.w * frac, r.h, 5);
    ctx.fillStyle = def?.miniboss ? '#d9822b' : phase2 ? '#ff4d3a' : '#c0392b';
    ctx.fill();
  }
  if (def?.phase2) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(r.x + r.w * def.phase2.hpFraction - 1, r.y, 2, r.h);
  }
  roundRect(ctx, r.x, r.y, r.w, r.h, 5);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const tag = def?.miniboss ? 'Мінібос · ' : phase2 ? 'Фаза 2 · ' : '';
  drawText(ctx, `${tag}${boss.name}`, r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 13, bold: true, align: 'center' });
}
