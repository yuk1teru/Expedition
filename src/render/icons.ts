// Geometric icons for skills, passives and classes.

import type { ClassIcon } from '../data/classes';
import type { SkillIcon } from '../data/skills';

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
  } else {
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
