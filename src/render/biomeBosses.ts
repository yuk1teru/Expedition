// Looks of the Desert, Swamp and Ice bosses and minibosses, and of boss hazards
// (puddles, expanding rings).

import type { Battle } from '../systems/battle';
import type { Enemy } from '../systems/entities';
import type { Hazard } from '../systems/hazards';

export type BossPainter = (ctx: CanvasRenderingContext2D, e: Enemy, b: Battle, t: number, flash: boolean) => void;

const shade = (ctx: CanvasRenderingContext2D, r: number): void => {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.75, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** Red glow while a boss winds up an attack. */
const windupGlow = (ctx: CanvasRenderingContext2D, e: Enemy, t: number): void => {
  if ((e.boss?.busy ?? 0) <= 0 || e.boss?.dash) return;
  ctx.fillStyle = `rgba(255, 70, 60, ${0.2 + 0.15 * Math.sin(t * 25)})`;
  ctx.beginPath();
  ctx.arc(0, 0, e.radius * 1.5, 0, Math.PI * 2);
  ctx.fill();
};

const color = (b: Battle, e: Enemy, flash: boolean, fallback: string): string => (flash ? '#ffffff' : (b.biome.palette.enemies[e.defId] ?? fallback));

/** Sand Worm: a ringed body rising from the sand, mandibles towards the hero. */
const sandWorm: BossPainter = (ctx, e, b, t, flash) => {
  const r = e.radius;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  // Sand mound.
  ctx.fillStyle = 'rgba(160, 120, 60, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.5, r * 1.5, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  windupGlow(ctx, e, t);
  ctx.rotate(e.facing);
  const body = color(b, e, flash, '#c9a36b');
  for (let i = 3; i >= 0; i--) {
    ctx.fillStyle = i % 2 === 0 ? body : '#a8834f';
    ctx.beginPath();
    ctx.arc(-i * r * 0.32, Math.sin(t * 4 + i) * 2, r * (1 - i * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.arc(r * 0.35, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = flash ? '#ffffff' : '#f2e2b8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const open = 0.3 + 0.15 * Math.sin(t * 6);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(r * 0.6, s * r * 0.2);
    ctx.quadraticCurveTo(r * 1.2, s * r * (0.4 + open), r * 1.35, s * r * 0.05);
    ctx.stroke();
  }
  ctx.restore();
};

/** Royal scorpion: segmented tail arching over a broad body, pincers forward. */
const scorpionKing: BossPainter = (ctx, e, b, t, flash) => {
  const r = e.radius;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  shade(ctx, r);
  windupGlow(ctx, e, t);
  ctx.rotate(e.facing);
  const body = color(b, e, flash, '#e07a3a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = body;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, 0);
  ctx.quadraticCurveTo(-r * 1.9, -r * 0.9 + Math.sin(t * 5) * 3, -r * 0.6, -r * 1.2);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(-r * 0.55, -r * 1.25, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(r * 0.7, s * r * 0.4);
    ctx.lineTo(r * 1.35, s * r * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 1.45, s * r * 0.55, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
  }
  ctx.restore();
};

/** Poison Mother: a big bubbling green mass with smaller blobs orbiting it. */
const poisonMother: BossPainter = (ctx, e, b, t, flash) => {
  const r = e.radius;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  shade(ctx, r);
  windupGlow(ctx, e, t);
  const body = color(b, e, flash, '#7fbf3a');
  ctx.fillStyle = body;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = r * (1 + 0.07 * Math.sin(a * 5 + t * 3));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(220, 255, 160, 0.5)';
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.6 + i * 0.2) % 1;
    ctx.beginPath();
    ctx.arc(Math.cos(i * 2.4) * r * 0.5, Math.sin(i * 2.4) * r * 0.4 - ph * r * 0.3, r * 0.12 * (1 - ph) + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(e.facing);
  ctx.fillStyle = '#1b2a10';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(r * 0.45, s * r * 0.25, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/** Old Toad: wide squat body, big eyes on top. */
const bigToad: BossPainter = (ctx, e, b, t, flash) => {
  const r = e.radius;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  shade(ctx, r);
  windupGlow(ctx, e, t);
  ctx.rotate(e.facing);
  const body = color(b, e, flash, '#5f9a4a');
  const breath = 1 + 0.05 * Math.sin(t * 3);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.05, r * 0.85 * breath, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(r * 0.45, s * r * 0.45, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(r * 0.5, s * r * 0.45, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1e27';
    ctx.fillRect(r * 0.47, s * r * 0.45 - 1, r * 0.1, 3);
  }
  ctx.restore();
};

/** Ice Knight: an armoured block with a helm slit, a long ice lance forward. */
const iceKnight: BossPainter = (ctx, e, b, t, flash) => {
  const r = e.radius;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  shade(ctx, r);
  if (e.boss?.phase === 2) {
    // Cold aura (phase 2).
    ctx.globalAlpha = 0.12 + 0.05 * Math.sin(t * 3);
    ctx.fillStyle = '#bfe6ff';
    ctx.beginPath();
    ctx.arc(0, 0, 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  windupGlow(ctx, e, t);
  ctx.rotate(e.facing);
  const body = color(b, e, flash, '#9fc8e8');
  ctx.strokeStyle = flash ? '#ffffff' : '#e8f6ff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.2, r * 0.6);
  ctx.lineTo(r * 1.8, r * 0.6);
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.strokeStyle = '#3a5a78';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d8ecf7';
  ctx.beginPath();
  ctx.arc(r * 0.15, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b2a3a';
  ctx.fillRect(r * 0.35, -r * 0.3, r * 0.12, r * 0.6);
  ctx.restore();
};

/** Frost Warden: a cluster of ice crystals around a glowing core. */
const frostWarden: BossPainter = (ctx, e, b, t, flash) => {
  const r = e.radius;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  shade(ctx, r);
  windupGlow(ctx, e, t);
  const body = color(b, e, flash, '#bfe6ff');
  ctx.fillStyle = body;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.4;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.25);
    ctx.lineTo(r * 1.2, 0);
    ctx.lineTo(r * 0.2, r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = flash ? '#ffffff' : '#7fd0ff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** {name:lord}: a dark hooded figure in a cloak of shadows, violet eyes and a crown of bones. */
const darkLord: BossPainter = (ctx, e, b, t, flash) => {
  const r = e.radius;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  shade(ctx, r);
  windupGlow(ctx, e, t);
  // The cloak: ragged and waving.
  ctx.fillStyle = color(b, e, flash, '#241a30');
  ctx.beginPath();
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.12 * Math.sin(t * 4 + i * 1.7));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  // The aura.
  ctx.strokeStyle = `rgba(154, 106, 216, ${0.5 + 0.3 * Math.sin(t * 3)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
  ctx.stroke();
  // The hood and the eyes towards the hero.
  ctx.rotate(e.facing);
  ctx.fillStyle = '#0d0a12';
  ctx.beginPath();
  ctx.arc(r * 0.15, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = e.boss?.phase === 2 ? '#ff5ad8' : '#c08aff';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(r * 0.4, s * r * 0.18, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  // The crown of bones.
  ctx.fillStyle = '#e8e0cc';
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.6 + (i / 4) * Math.PI * 0.8;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.6 + r * 0.15, Math.sin(a) * r * 0.6, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

export const BIOME_BOSS_PAINTERS: Record<string, BossPainter> = { sandWorm, scorpionKing, poisonMother, bigToad, iceKnight, frostWarden, darkLord };

const HAZARD_COLORS: Record<string, string> = { acid: '#b6f04a', poison: '#7fbf3a', toxicWave: '#9fdf4a', spikeRing: '#bfe6ff', deathRing: '#9a6ad8' };

/** Puddles (fading at the end) and expanding rings (with their safe gaps). */
export function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, t: number): void {
  const c = HAZARD_COLORS[h.kind] ?? '#9fdf4a';
  ctx.save();
  ctx.translate(h.pos.x, h.pos.y);
  if (!h.ring) {
    const fade = Math.min(1, (h.duration - h.time) / 0.6);
    ctx.globalAlpha = 0.35 * fade;
    ctx.fillStyle = c;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = h.radius * (1 + 0.06 * Math.sin(a * 3 + h.id));
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.6 * fade;
    ctx.fillStyle = '#e8ffd0';
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.8 + i * 0.33 + h.id * 0.1) % 1;
      ctx.beginPath();
      ctx.arc(Math.cos(i * 2.1) * h.radius * 0.5, Math.sin(i * 2.1) * h.radius * 0.4, 3 * (1 - ph) + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const ring = h.ring;
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = c;
  ctx.lineWidth = ring.width;
  ctx.lineCap = 'butt';
  const gaps = ring.gaps.map((g) => [g - ring.gapHalf, g + ring.gapHalf] as const).sort((a, b) => a[0] - b[0]);
  if (gaps.length === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Draw the arcs between the gaps.
    for (let i = 0; i < gaps.length; i++) {
      const from = gaps[i]![1];
      const to = (gaps[(i + 1) % gaps.length]![0]) + (i + 1 === gaps.length ? Math.PI * 2 : 0);
      ctx.beginPath();
      ctx.arc(0, 0, h.radius, from, to);
      ctx.stroke();
    }
  }
  if (h.kind === 'spikeRing') {
    ctx.fillStyle = '#ffffff';
    const n = Math.max(8, Math.floor(h.radius / 10));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (ring.gaps.some((g) => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < ring.gapHalf)) continue;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * h.radius, Math.sin(a) * h.radius, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
