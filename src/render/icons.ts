// Geometric icons for skills, passives and classes.

import { TROPHY_COLORS, type TrophyKind } from '../data/trophies';
import { CONSUMABLES } from '../data/consumables';
import type { ClassIcon } from '../data/classes';
import type { SkillIcon } from '../data/skills';
import { drawClassPassiveIcon, drawClassSkillIcon } from './classIcons';

export function drawSkillIcon(ctx: CanvasRenderingContext2D, icon: SkillIcon, x: number, y: number, size: number, color: string): void {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineCap = 'round';
  switch (icon) {
    case 'whirl':
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.45 + i * 0.18), a, a + 1.9);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'dash':
      ctx.beginPath();
      ctx.moveTo(r * 0.85, 0);
      ctx.lineTo(r * 0.1, -r * 0.55);
      ctx.lineTo(r * 0.1, r * 0.55);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, (i - 1) * r * 0.35);
        ctx.lineTo(-r * 0.1, (i - 1) * r * 0.35);
        ctx.stroke();
      }
      break;
    case 'shout':
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.25);
      ctx.lineTo(-r * 0.2, -r * 0.25);
      ctx.lineTo(r * 0.2, -r * 0.6);
      ctx.lineTo(r * 0.2, r * 0.6);
      ctx.lineTo(-r * 0.2, r * 0.25);
      ctx.lineTo(-r * 0.7, r * 0.25);
      ctx.closePath();
      ctx.fill();
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(r * 0.2, 0, r * 0.3 * i + r * 0.1, -0.7, 0.7);
        ctx.stroke();
      }
      break;
    case 'slam':
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, r * 0.6);
      ctx.lineTo(0, -r * 0.7);
      ctx.lineTo(r * 0.75, r * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.75);
      ctx.lineTo(r * 0.9, r * 0.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, r * 0.1);
      ctx.lineTo(r * 0.3, r * 0.1);
      ctx.stroke();
      break;
    case 'axe':
      ctx.rotate(-Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.85);
      ctx.lineTo(0, -r * 0.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.65);
      ctx.quadraticCurveTo(r * 0.85, -r * 0.4, 0, -r * 0.05);
      ctx.closePath();
      ctx.fill();
      break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(r * 0.7, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.65, r * 0.4, 0, r * 0.85);
      ctx.quadraticCurveTo(-r * 0.65, r * 0.4, -r * 0.7, -r * 0.55);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'quake':
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.5);
      ctx.lineTo(r * 0.9, r * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, r * 0.5);
      ctx.lineTo(r * 0.15, r * 0.05);
      ctx.lineTo(-r * 0.15, -r * 0.25);
      ctx.lineTo(r * 0.1, -r * 0.75);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(side * r * 0.55, r * 0.15, r * 0.25, Math.PI, 0);
        ctx.stroke();
      }
      break;
    case 'hook':
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.85);
      ctx.lineTo(-r * 0.2, r * 0.2);
      ctx.arc(r * 0.15, r * 0.2, r * 0.35, Math.PI, 0, true);
      ctx.lineTo(r * 0.5, -r * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.3);
      ctx.lineTo(r * 0.68, -r * 0.02);
      ctx.lineTo(r * 0.32, -r * 0.02);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      drawClassSkillIcon(ctx, icon, r);
  }
  ctx.restore();
}

export function drawPassiveIcon(ctx: CanvasRenderingContext2D, stat: string, x: number, y: number, size: number, color: string): void {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.08);
  if (stat === 'armor') {
    shieldPath(ctx, r);
    ctx.fill();
  } else if (stat === 'lifesteal') {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.quadraticCurveTo(r * 0.7, 0, 0, r * 0.75);
    ctx.quadraticCurveTo(-r * 0.7, 0, 0, -r * 0.8);
    ctx.fill();
  } else if (stat === 'killCdr') {
    // Crossed swords with a spark: kills speed up skills.
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, r * 0.7);
    ctx.lineTo(r * 0.6, -r * 0.6);
    ctx.moveTo(r * 0.7, r * 0.7);
    ctx.lineTo(-r * 0.6, -r * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.95);
    ctx.lineTo(r * 0.18, -r * 0.55);
    ctx.lineTo(-r * 0.18, -r * 0.55);
    ctx.closePath();
    ctx.fill();
  } else if (stat === 'thorns') {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? r * 0.85 : r * 0.45;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else if (!drawClassPassiveIcon(ctx, stat, r)) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawClassIcon(ctx: CanvasRenderingContext2D, icon: ClassIcon, x: number, y: number, size: number, color: string): void {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.07);
  ctx.lineCap = 'round';
  if (icon === 'shield') {
    shieldPath(ctx, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(0, r * 0.6);
    ctx.moveTo(-r * 0.45, -r * 0.15);
    ctx.lineTo(r * 0.45, -r * 0.15);
    ctx.stroke();
  } else if (icon === 'orb') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.2, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(-r * 0.2, 0, r * 0.75, -Math.PI / 2.4, Math.PI / 2.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.2 + Math.cos(-Math.PI / 2.4) * r * 0.75, Math.sin(-Math.PI / 2.4) * r * 0.75);
    ctx.lineTo(-r * 0.2 + Math.cos(Math.PI / 2.4) * r * 0.75, Math.sin(Math.PI / 2.4) * r * 0.75);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, 0);
    ctx.lineTo(r * 0.85, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function shieldPath(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(r * 0.7, -r * 0.55);
  ctx.quadraticCurveTo(r * 0.65, r * 0.4, 0, r * 0.85);
  ctx.quadraticCurveTo(-r * 0.65, r * 0.4, -r * 0.7, -r * 0.55);
  ctx.closePath();
}

/** Item icons by slot: sword, hat, chestplate, boot. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, slot: string, x: number, y: number, size: number, color: string): void {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (slot === 'weapon') {
    ctx.rotate(-Math.PI / 4);
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.lineTo(0, -r * 0.9);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, r * 0.35);
    ctx.lineTo(r * 0.35, r * 0.35);
    ctx.moveTo(0, r * 0.35);
    ctx.lineTo(0, r * 0.8);
    ctx.stroke();
  } else if (slot === 'hat') {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r * 0.9, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.4, -r * 0.65, 0, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.4, -r * 0.65, r * 0.45, r * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (slot === 'armor') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, -r * 0.55);
    ctx.lineTo(-r * 0.3, -r * 0.75);
    ctx.quadraticCurveTo(0, -r * 0.45, r * 0.3, -r * 0.75);
    ctx.lineTo(r * 0.85, -r * 0.55);
    ctx.lineTo(r * 0.6, -r * 0.1);
    ctx.lineTo(r * 0.55, r * 0.8);
    ctx.lineTo(-r * 0.55, r * 0.8);
    ctx.lineTo(-r * 0.6, -r * 0.1);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, -r * 0.8);
    ctx.lineTo(r * 0.15, -r * 0.8);
    ctx.lineTo(r * 0.15, r * 0.2);
    ctx.lineTo(r * 0.8, r * 0.35);
    ctx.lineTo(r * 0.8, r * 0.75);
    ctx.lineTo(-r * 0.35, r * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Consumables: magnifier (lens + handle), herbs (sprig in the herb's colour), potions (flask). */
export function drawConsumableIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number): void {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  if (id === 'magnifier') {
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = r * 0.25;
    ctx.beginPath();
    ctx.moveTo(r * 0.25, r * 0.25);
    ctx.lineTo(r * 0.85, r * 0.85);
    ctx.stroke();
    ctx.fillStyle = 'rgba(160, 210, 255, 0.45)';
    ctx.strokeStyle = '#d9c9a3';
    ctx.lineWidth = r * 0.15;
    ctx.beginPath();
    ctx.arc(-r * 0.15, -r * 0.15, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.arc(-r * 0.15, -r * 0.15, r * 0.3, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
  } else if (id.startsWith('potion')) {
    const big = id === 'potionLarge' ? 1.1 : id === 'potionMedium' ? 1 : 0.88;
    const color = (CONSUMABLES as Record<string, { color: string }>)[id]?.color ?? '#e05a5a';
    const br = r * 0.55 * big;
    // Round flask with a neck and a cork.
    ctx.fillStyle = 'rgba(220, 235, 255, 0.25)';
    ctx.strokeStyle = '#d8e2ee';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.arc(0, r * 0.25, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Liquid: the lower part of the bulb.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, r * 0.25, br * 0.86, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(-br, r * 0.25 - br * 0.25, br * 2, br * 2);
    ctx.restore();
    ctx.fillStyle = 'rgba(220, 235, 255, 0.35)';
    ctx.fillRect(-r * 0.14, r * 0.25 - br - r * 0.32, r * 0.28, r * 0.36);
    ctx.strokeRect(-r * 0.14, r * 0.25 - br - r * 0.32, r * 0.28, r * 0.36);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-r * 0.17, r * 0.25 - br - r * 0.48, r * 0.34, r * 0.18);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(-br * 0.35, r * 0.25 - br * 0.25, br * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#3f7a32';
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.85);
    ctx.quadraticCurveTo(-r * 0.1, 0, r * 0.05, -r * 0.8);
    ctx.stroke();
    ctx.fillStyle = (CONSUMABLES as Record<string, { color: string }>)[id]?.color ?? '#6fd16f';
    for (const [lx, ly, a] of [[-0.3, 0.2, -0.8], [0.3, -0.1, 0.8], [-0.25, -0.4, -0.6], [0.25, -0.6, 0.6]] as [number, number, number][]) {
      ctx.save();
      ctx.translate(lx * r, ly * r);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.32, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** A trophy in the bag: its kind's shape and colour (pelt, rare gem, boss star, relic coin). */
export function drawTrophyIcon(ctx: CanvasRenderingContext2D, kind: TrophyKind, x: number, y: number, size: number): void {
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = TROPHY_COLORS[kind];
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (kind === 'common') {
    // A pelt / a piece: a rounded blob with a notch.
    ctx.ellipse(0, 0, r * 0.85, r * 0.65, -0.3, 0, Math.PI * 2);
  } else if (kind === 'rare') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.75, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.75, 0);
    ctx.closePath();
  } else if (kind === 'boss') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else {
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  if (kind === 'relic') {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.ellipse(-r * 0.25, -r * 0.25, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
