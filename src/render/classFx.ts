// Arena visuals of the Mage and Archer: projectiles, zones, elemental statuses on
// enemies and the hero's barrier. Each draw function returns false for kinds it
// does not know, so combatView falls back to its own drawing.

import type { Enemy, Hero, Projectile, Zone } from '../systems/entities';
import { heroShield } from '../systems/hero';

const crit = (kind: string): boolean => kind.endsWith('Crit');

export function drawClassProjectile(ctx: CanvasRenderingContext2D, p: Projectile, t: number): boolean {
  const kind = p.kind.replace(/Crit$/, '');
  const a = Math.atan2(p.vel.y, p.vel.x);
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  switch (kind) {
    case 'bolt': {
      // Mage fire bolt: glowing head with a short tail.
      ctx.rotate(a);
      const g = ctx.createLinearGradient(-18, 0, 0, 0);
      g.addColorStop(0, 'rgba(255, 120, 40, 0)');
      g.addColorStop(1, 'rgba(255, 150, 60, 0.8)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(0, -p.radius * 0.8);
      ctx.lineTo(0, p.radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = crit(p.kind) ? '#ffe066' : '#ffb347';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath();
      ctx.arc(1, -1, p.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arrow':
    case 'bigArrow': {
      const big = kind === 'bigArrow';
      const len = big ? 30 : 18;
      ctx.rotate(a);
      ctx.strokeStyle = big ? '#e8c26a' : '#c9a36b';
      ctx.lineWidth = big ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.fillStyle = crit(p.kind) ? '#ffe066' : big ? '#fff1b8' : '#e8ecf4';
      ctx.beginPath();
      ctx.moveTo(big ? 9 : 6, 0);
      ctx.lineTo(-2, big ? -5 : -3.5);
      ctx.lineTo(-2, big ? 5 : 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7fbf5a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(-len - 4, -4);
      ctx.moveTo(-len, 0);
      ctx.lineTo(-len - 4, 4);
      ctx.stroke();
      if (big) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#fff1b8';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-len * 2, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
      }
      break;
    }
    case 'fireball': {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, p.radius * 1.8);
      g.addColorStop(0, '#fff4d0');
      g.addColorStop(0.4, '#ffb347');
      g.addColorStop(1, 'rgba(229, 83, 75, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * (1.8 + 0.15 * Math.sin(t * 30)), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'missile': {
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(190, 140, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(-6, 0, p.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = crit(p.kind) ? '#ffe066' : '#d4a5ff';
      ctx.beginPath();
      ctx.moveTo(p.radius * 1.4, 0);
      ctx.lineTo(0, -p.radius * 0.7);
      ctx.lineTo(-p.radius, 0);
      ctx.lineTo(0, p.radius * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'net': {
      ctx.rotate(t * 8);
      ctx.strokeStyle = '#d8d2c0';
      ctx.lineWidth = 1.5;
      const r = p.radius;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.5, -r);
        ctx.lineTo(i * r * 0.5, r);
        ctx.moveTo(-r, i * r * 0.5);
        ctx.lineTo(r, i * r * 0.5);
        ctx.stroke();
      }
      break;
    }
    default:
      ctx.restore();
      return false;
  }
  ctx.restore();
  return true;
}

export function drawClassZone(ctx: CanvasRenderingContext2D, z: Zone, t: number): boolean {
  const life = 1 - z.time / Math.max(z.duration, 1e-6);
  ctx.save();
  switch (z.kind) {
    case 'flameWall': {
      if (!z.line) break;
      const { a, b } = z.line;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.35 + 0.25 * life;
      ctx.strokeStyle = '#e5534b';
      ctx.lineWidth = z.radius * 2.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffb347';
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const x = a.x + (b.x - a.x) * k;
        const y = a.y + (b.y - a.y) * k;
        const h = z.radius * (0.9 + 0.5 * Math.sin(t * 14 + i * 1.7));
        ctx.beginPath();
        ctx.moveTo(x - 5, y + 4);
        ctx.quadraticCurveTo(x, y - h, x + 5, y + 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return true;
    }
    case 'burnGround': {
      ctx.translate(z.pos.x, z.pos.y);
      ctx.globalAlpha = 0.5 * life + 0.1;
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, z.radius);
      g.addColorStop(0, 'rgba(255, 179, 71, 0.9)');
      g.addColorStop(1, 'rgba(229, 83, 75, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, z.radius * (0.92 + 0.08 * Math.sin(t * 18 + z.id)), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    }
    case 'frostField': {
      ctx.translate(z.pos.x, z.pos.y);
      ctx.globalAlpha = 0.18 + 0.15 * life;
      ctx.fillStyle = '#bfe6ff';
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6 * life;
      ctx.strokeStyle = '#e8f6ff';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const a = i * 2.39996;
        const rr = z.radius * (0.25 + 0.7 * ((i * 0.618) % 1));
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
      ctx.restore();
      return true;
    }
    case 'vortex': {
      ctx.translate(z.pos.x, z.pos.y);
      ctx.globalAlpha = 0.15 + 0.1 * life;
      ctx.fillStyle = '#7b4bd6';
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#c9a6ff';
      ctx.lineWidth = 2.5;
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const f = k / 24;
          const a = -t * 6 + arm * ((Math.PI * 2) / 3) + f * 4;
          const rr = z.radius * (1 - f);
          if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.stroke();
      }
      ctx.restore();
      return true;
    }
    case 'hunterTrap': {
      ctx.translate(z.pos.x, z.pos.y);
      const blast = z.finale?.radius ?? 0;
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#9fdf7a';
      ctx.setLineDash([5, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, blast, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#d8d2c0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(159, 223, 122, ${0.6 + 0.4 * Math.sin(t * 6)})`;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    }
    case 'arrowRain': {
      ctx.translate(z.pos.x, z.pos.y);
      ctx.globalAlpha = 0.12 + 0.08 * life;
      ctx.fillStyle = '#c9a36b';
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#e8ecf4';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        // Each streak falls and restarts, phase-shifted.
        const phase = (t * 3 + i * 0.37) % 1;
        const a = i * 2.39996;
        const rr = z.radius * ((i * 0.618) % 1);
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr - 24 * (1 - phase);
        ctx.beginPath();
        ctx.moveTo(x + 3, y - 12);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
      return true;
    }
  }
  ctx.restore();
  return false;
}

/** Freeze (ice shell), burn (flames) and vulnerability (red reticle) on an enemy. */
export function drawElementalStatus(ctx: CanvasRenderingContext2D, e: Enemy, t: number): void {
  const r = e.radius;
  if ((e.statuses.freeze?.time ?? 0) > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#bfe6ff';
    ctx.beginPath();
    ctx.arc(e.pos.x, e.pos.y, r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(e.pos.x + Math.cos(a) * (r - 2), e.pos.y + Math.sin(a) * (r - 2));
      ctx.lineTo(e.pos.x + Math.cos(a) * (r + 7), e.pos.y + Math.sin(a) * (r + 7));
      ctx.stroke();
    }
    ctx.restore();
  }
  if ((e.statuses.burn?.time ?? 0) > 0) {
    ctx.save();
    ctx.fillStyle = '#ff9a3c';
    for (let i = 0; i < 3; i++) {
      const x = e.pos.x + (i - 1) * r * 0.6;
      const h = 7 + 3 * Math.sin(t * 16 + i * 2 + e.id);
      const y = e.pos.y - r * 0.4;
      ctx.beginPath();
      ctx.moveTo(x - 3, y);
      ctx.quadraticCurveTo(x, y - h * 2, x + 3, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  if ((e.statuses.vuln?.time ?? 0) > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 90, 80, 0.9)';
    ctx.lineWidth = 1.5;
    const rr = r + 8;
    ctx.beginPath();
    ctx.arc(e.pos.x, e.pos.y, rr, t * 2, t * 2 + Math.PI * 1.6);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + t * 2;
      ctx.beginPath();
      ctx.moveTo(e.pos.x + Math.cos(a) * (rr - 4), e.pos.y + Math.sin(a) * (rr - 4));
      ctx.lineTo(e.pos.x + Math.cos(a) * (rr + 4), e.pos.y + Math.sin(a) * (rr + 4));
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Barrier bubble around the hero (context translated to the hero), brighter while it is full. */
export function drawShieldBubble(ctx: CanvasRenderingContext2D, h: Hero, t: number): void {
  const shield = heroShield(h);
  if (shield <= 0) return;
  const k = Math.min(1, shield / Math.max(1, h.maxHp * 0.3));
  ctx.save();
  ctx.globalAlpha = 0.15 + 0.2 * k;
  ctx.fillStyle = '#9fd8ff';
  ctx.beginPath();
  ctx.arc(0, 0, h.radius + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5 + 0.4 * k;
  ctx.strokeStyle = '#d8f0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.8;
    const x = Math.cos(a) * (h.radius + 14);
    const y = Math.sin(a) * (h.radius + 14);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}
