// NPC figures (town scenes and the dialogue portrait): a round body in the NPC's colours
// with a hat by role; the notice board is a board on two posts.

import type { NpcDef } from '../data/npcs';

export function drawNpc(ctx: CanvasRenderingContext2D, look: NpcDef['look'], x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (look.hat === 'board') {
    drawBoard(ctx, look, r);
    ctx.restore();
    return;
  }
  // Idle bob.
  const bob = Math.sin(t * 2.2 + x * 0.05) * r * 0.06;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.75, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, bob);
  // Body (robe) and head.
  ctx.fillStyle = look.body;
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.6);
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.4, 0, -r * 0.45);
  ctx.quadraticCurveTo(r * 0.9, -r * 0.4, r, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.accent;
  ctx.fillRect(-r * 0.12, -r * 0.35, r * 0.24, r * 0.9);
  ctx.fillStyle = '#e9c9a0';
  ctx.beginPath();
  ctx.arc(0, -r * 0.75, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  drawHat(ctx, look, r);
  ctx.restore();
}

function drawHat(ctx: CanvasRenderingContext2D, look: NpcDef['look'], r: number): void {
  const hy = -r * 0.75;
  const hr = r * 0.45;
  ctx.fillStyle = look.accent;
  switch (look.hat) {
    case 'hood':
      ctx.fillStyle = look.body;
      ctx.beginPath();
      ctx.arc(0, hy, hr * 1.25, Math.PI, Math.PI * 2);
      ctx.lineTo(hr * 1.25, hy + hr * 0.6);
      ctx.lineTo(-hr * 1.25, hy + hr * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e9c9a0';
      ctx.beginPath();
      ctx.arc(0, hy + hr * 0.15, hr * 0.75, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cap':
      ctx.beginPath();
      ctx.arc(0, hy - hr * 0.2, hr, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-hr * 1.3, hy - hr * 0.25, hr * 2.6, hr * 0.3);
      break;
    case 'turban':
      ctx.beginPath();
      ctx.ellipse(0, hy - hr * 0.45, hr * 1.15, hr * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, hy - hr * 0.5, hr * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'fur':
      ctx.fillStyle = '#8a6a4a';
      ctx.beginPath();
      ctx.ellipse(0, hy - hr * 0.5, hr * 1.2, hr * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.accent;
      ctx.fillRect(-hr * 1.2, hy - hr * 0.3, hr * 2.4, hr * 0.3);
      break;
    case 'helm':
      ctx.fillStyle = '#b8c0cc';
      ctx.beginPath();
      ctx.arc(0, hy - hr * 0.1, hr * 1.1, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-hr * 0.12, hy - hr * 1.5, hr * 0.24, hr * 0.5);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-hr * 0.12, hy - hr * 1.7, hr * 0.24, hr * 0.3);
      break;
    case 'none':
    case 'board':
      break;
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, look: NpcDef['look'], r: number): void {
  ctx.fillStyle = '#4a3622';
  ctx.fillRect(-r * 0.9, -r * 0.6, r * 0.22, r * 1.6);
  ctx.fillRect(r * 0.68, -r * 0.6, r * 0.22, r * 1.6);
  ctx.fillStyle = look.body;
  ctx.fillRect(-r * 1.2, -r * 1.3, r * 2.4, r * 1.3);
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(-r * 1.2, -r * 1.3, r * 2.4, r * 1.3);
  ctx.fillStyle = look.accent;
  ctx.fillRect(-r * 0.95, -r * 1.12, r * 0.8, r * 0.55);
  ctx.fillRect(r * 0.05, -r * 1.05, r * 0.9, r * 0.4);
  ctx.fillRect(-r * 0.6, -r * 0.5, r * 1.1, r * 0.35);
}
