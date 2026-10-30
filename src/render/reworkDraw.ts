// Drawing the rework's Forest (ROADMAP 20.2–20.4) with code figures until the art comes
// (VISION §10): ground, obstacles, beasts with their warnings, shots, gems. Three-quarter view:
// every body stands on its foot point, and the caller draws them sorted by it.

import { REWORK_CLASSES, REWORK_ENEMIES, REWORK_MAP } from '../data/rework';
import type { Gem, Coin, Obstacle, RunEnemy, RunHero, Shot, Trap, Zone } from '../systems/rework/types';

const OUTLINE = 'rgba(15, 12, 10, 0.85)';

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** The top of the tree crown (for fading it when the hero walks behind). */
export function crownBox(o: Obstacle): { x: number; y: number; r: number } | null {
  if (o.kind === 'tree') return { x: o.pos.x, y: o.pos.y - o.height * 0.62, r: o.radius * 2.3 };
  if (o.kind === 'oak') return { x: o.pos.x, y: o.pos.y - o.height * 0.75, r: o.radius * 2.1 };
  return null;
}

export function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, crownAlpha: number): void {
  const { x, y } = o.pos;
  const r = o.radius;
  drawShadow(ctx, x, y, r * 1.3);
  switch (o.kind) {
    case 'tree':
    case 'oak': {
      const oak = o.kind === 'oak';
      const trunkH = o.height * (oak ? 0.55 : 0.45);
      ctx.fillStyle = oak ? '#5a4128' : '#4e3a26';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - r * 0.45, y - trunkH, r * 0.9, trunkH + 2, 4);
      ctx.fill();
      ctx.stroke();
      const c = crownBox(o)!;
      ctx.globalAlpha = crownAlpha;
      const greens = oak ? ['#4a5a2a', '#5c6e30', '#6f8236'] : ['#21402a', '#2a5232', '#33603a'];
      const lobes = [
        [0, 0.15, 1],
        [-0.55, 0.3, 0.7],
        [0.55, 0.3, 0.7],
        [-0.25, -0.35, 0.75],
        [0.3, -0.3, 0.7],
      ];
      lobes.forEach(([dx, dy, s], i) => blob(ctx, c.x + dx! * c.r, c.y + dy! * c.r * 0.8, c.r * s! * 0.75, c.r * s! * 0.62, greens[i % greens.length]!));
      ctx.globalAlpha = 1;
      return;
    }
    case 'bush':
      blob(ctx, x - r * 0.45, y - r * 0.35, r * 0.75, r * 0.6, '#2f5a2c');
      blob(ctx, x + r * 0.45, y - r * 0.35, r * 0.75, r * 0.6, '#356332');
      blob(ctx, x, y - r * 0.75, r * 0.8, r * 0.62, '#3c6e37');
      return;
    case 'stone':
      blob(ctx, x, y - r * 0.4, r, r * 0.75, '#77797a');
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.75, r * 0.4, r * 0.22, -0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'stoneRing':
      // Standing stones close together: the old ring of the forest folk.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + o.seed;
        const sx = x + Math.cos(a) * r * 0.6;
        const sy = y + Math.sin(a) * r * 0.35;
        const h = r * (0.7 + ((i * 37) % 5) * 0.08);
        ctx.fillStyle = '#6e6f6c';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sx - r * 0.13, sy - h, r * 0.26, h, 6);
        ctx.fill();
        ctx.stroke();
      }
      return;
    case 'log':
      ctx.fillStyle = '#5b4026';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - r * 1.4, y - r * 0.75, r * 2.8, r * 0.75, r * 0.37);
      ctx.fill();
      ctx.stroke();
      blob(ctx, x + r * 1.4, y - r * 0.37, r * 0.3, r * 0.37, '#a07a4c');
  }
}

/** Warnings on the ground, under the bodies: the wolf's leap line, the stump's ring. */
export function drawEnemyWarning(ctx: CanvasRenderingContext2D, e: RunEnemy): void {
  const d = REWORK_ENEMIES[e.def];
  const act = e.act;
  if (act.kind === 'crouch' && d.leap) {
    const len = d.speed * d.leap.speedMult * d.leap.time + e.radius;
    const k = 1 - act.time / d.leap.windup;
    ctx.strokeStyle = `rgba(230, 70, 60, ${0.35 + 0.45 * k})`;
    ctx.lineWidth = e.radius * 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.pos.x, e.pos.y);
    ctx.lineTo(e.pos.x + act.dir.x * len, e.pos.y + act.dir.y * len);
    ctx.stroke();
  } else if (act.kind === 'stomp' && d.stomp) {
    const k = 1 - act.time / d.stomp.delay;
    const reach = d.stomp.reach + e.radius;
    ctx.fillStyle = `rgba(230, 70, 60, ${0.12 + 0.25 * k})`;
    ctx.strokeStyle = 'rgba(230, 70, 60, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.pos.x, e.pos.y, reach, reach * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(e.pos.x, e.pos.y, reach * k, reach * 0.6 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: RunEnemy, time: number): void {
  const r = e.radius;
  const side = e.vel.x < -1 ? -1 : 1;
  const flash = time - e.hitAt < 0.08;
  const bob = Math.abs(Math.sin(time * 9 + e.id)) * (e.act.kind === 'walk' ? 2 : 0);
  drawShadow(ctx, e.pos.x, e.pos.y, r);
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y - bob);
  ctx.scale(side, 1);
  if (e.def === 'wolf') {
    const crouch = e.act.kind === 'crouch' ? 0.7 : 1;
    const stretch = e.act.kind === 'leap' ? 1.35 : 1;
    ctx.scale(stretch, crouch);
    blob(ctx, -r * 0.1, -r * 0.8, r * 1.15, r * 0.7, flash ? '#ffffff' : '#7a6e64');
    blob(ctx, r * 0.95, -r * 1.25, r * 0.55, r * 0.5, flash ? '#ffffff' : '#867a6f');
    ctx.fillStyle = '#5c524a';
    ctx.beginPath();
    ctx.moveTo(r * 0.75, -r * 1.6);
    ctx.lineTo(r * 0.9, -r * 2.15);
    ctx.lineTo(r * 1.1, -r * 1.65);
    ctx.fill();
    ctx.fillStyle = '#f2d36b';
    ctx.beginPath();
    ctx.arc(r * 1.15, -r * 1.3, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.def === 'mushroom') {
    const aiming = e.act.kind === 'aim';
    ctx.fillStyle = flash ? '#ffffff' : '#e7dcc0';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-r * 0.4, -r * 1.1, r * 0.8, r * 1.1, 4);
    ctx.fill();
    ctx.stroke();
    if (aiming) {
      ctx.fillStyle = 'rgba(255, 140, 200, 0.45)';
      ctx.beginPath();
      ctx.arc(0, -r * 1.4, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = flash ? '#ffffff' : aiming ? '#e2588f' : '#b8423a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.15, r * 1.2, r * 0.85, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4ecd8';
    for (const [dx, dy] of [[-0.5, -1.5], [0.15, -1.75], [0.6, -1.4]]) {
      ctx.beginPath();
      ctx.arc(dx! * r, dy! * r, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const shake = e.act.kind === 'stomp' ? Math.sin(time * 60) * 2 : 0;
    ctx.translate(shake, 0);
    ctx.fillStyle = flash ? '#ffffff' : '#6a4a2c';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-r * 0.85, -r * 1.6, r * 1.7, r * 1.6, 6);
    ctx.fill();
    ctx.stroke();
    blob(ctx, 0, -r * 1.6, r * 0.85, r * 0.4, flash ? '#ffffff' : '#a9875a');
    ctx.fillStyle = '#ffcf5a';
    ctx.fillRect(-r * 0.4, -r * 1.05, r * 0.18, r * 0.12);
    ctx.fillRect(r * 0.22, -r * 1.05, r * 0.18, r * 0.12);
  }
  ctx.restore();
  // Skill effects: frozen — an icy shell; stunned — stars over the head; scared — a drop of sweat.
  if (e.freeze > 0) {
    ctx.fillStyle = 'rgba(160, 215, 255, 0.45)';
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.pos.x, e.pos.y - r * 0.9, r * 1.3, r * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.stun > 0) {
    ctx.fillStyle = '#ffe27a';
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(e.pos.x + Math.cos(a) * r * 0.8, e.pos.y - r * 2.4 + Math.sin(a) * r * 0.25, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (e.hp < e.maxHp) {
    const w = r * 2.2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.pos.x - w / 2 - 1, e.pos.y - r * 2.6 - 1, w + 2, 5);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(e.pos.x - w / 2, e.pos.y - r * 2.6, w * Math.max(0, e.hp / e.maxHp), 3);
  }
}

/** The mage and the archer until their frames come: a cloaked figure in the class colour. */
export function drawHeroFigure(ctx: CanvasRenderingContext2D, h: RunHero, side: number, flash: boolean): void {
  const c = REWORK_CLASSES[h.classId];
  const r = h.radius;
  ctx.save();
  ctx.translate(h.pos.x, h.pos.y);
  ctx.scale(side, 1);
  ctx.fillStyle = flash ? '#ffffff' : c.color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, 0);
  ctx.lineTo(r * 0.9, 0);
  ctx.lineTo(r * 0.55, -r * 2.4);
  ctx.lineTo(-r * 0.55, -r * 2.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  blob(ctx, 0, -r * 2.75, r * 0.6, r * 0.6, flash ? '#ffffff' : '#e6c39a');
  ctx.strokeStyle = '#5a3a20';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (h.classId === 'mage') {
    ctx.moveTo(r * 0.9, -r * 0.2);
    ctx.lineTo(r * 1.1, -r * 3.4);
    ctx.stroke();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(r * 1.1, -r * 3.5, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.arc(r * 0.9, -r * 1.5, r * 1.1, -Math.PI / 2.4, Math.PI / 2.4);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawShot(ctx: CanvasRenderingContext2D, s: Shot, time = 0): void {
  if (s.kind === 'axe') {
    ctx.save();
    ctx.translate(s.pos.x, s.pos.y - 18);
    ctx.rotate(time * 18);
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.fillStyle = '#c9ccd4';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, -9);
    ctx.quadraticCurveTo(16, 0, 6, 9);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (s.kind === 'pierceArrow') {
    const a = Math.atan2(s.vel.y, s.vel.x);
    ctx.save();
    ctx.translate(s.pos.x, s.pos.y - 16);
    ctx.rotate(a);
    ctx.strokeStyle = 'rgba(255, 240, 180, 0.5)';
    ctx.lineWidth = Math.max(4, s.radius * 2);
    ctx.beginPath();
    ctx.moveTo(-60, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.strokeStyle = '#fff2c0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (s.kind === 'fireball' || s.kind === 'missile') {
    const fire = s.kind === 'fireball';
    ctx.fillStyle = fire ? '#ff7a2a' : '#b98cff';
    ctx.strokeStyle = fire ? '#ffe08a' : '#efe0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.pos.x, s.pos.y - 18, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (s.kind === 'arrow') {
    const a = Math.atan2(s.vel.y, s.vel.x);
    ctx.save();
    ctx.translate(s.pos.x, s.pos.y - 16);
    ctx.rotate(a);
    ctx.strokeStyle = '#e8dcc0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const y = s.pos.y - (s.kind === 'bolt' ? 18 : 12);
  ctx.fillStyle = s.kind === 'bolt' ? '#ff9d3a' : '#c7e66b';
  ctx.strokeStyle = s.kind === 'bolt' ? '#fff0b0' : '#4c6a20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.pos.x, y, s.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawGem(ctx: CanvasRenderingContext2D, g: Gem, time: number): void {
  const big = g.xp >= 5;
  const s = big ? 7 : 5;
  const y = g.pos.y - 4 - Math.sin(time * 4 + g.pos.x) * 1.5;
  ctx.fillStyle = big ? '#7ad1ff' : '#5fe0a0';
  ctx.strokeStyle = 'rgba(10, 30, 40, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(g.pos.x, y - s);
  ctx.lineTo(g.pos.x + s * 0.7, y);
  ctx.lineTo(g.pos.x, y + s);
  ctx.lineTo(g.pos.x - s * 0.7, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function drawCoin(ctx: CanvasRenderingContext2D, c: Coin): void {
  ctx.fillStyle = '#f2c14e';
  ctx.strokeStyle = '#7a5a12';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(c.pos.x, c.pos.y - 3, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Burning ground and rains of arrows, on the ground under the bodies. */
export function drawZone(ctx: CanvasRenderingContext2D, z: Zone, time: number): void {
  const fire = z.kind === 'fire';
  ctx.fillStyle = fire ? 'rgba(255, 110, 40, 0.28)' : 'rgba(230, 220, 190, 0.18)';
  ctx.strokeStyle = fire ? 'rgba(255, 170, 80, 0.7)' : 'rgba(240, 230, 200, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(z.pos.x, z.pos.y, z.radius, z.radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!fire) {
    // Falling arrows: short strokes that move down.
    ctx.strokeStyle = 'rgba(245, 235, 210, 0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = i * 2.39996 + z.pos.x;
      const rr = ((i * 37) % 10) / 10;
      const x = z.pos.x + Math.cos(a) * z.radius * rr;
      const y = z.pos.y + Math.sin(a) * z.radius * 0.6 * rr - 40 + ((time * 160 + i * 23) % 40);
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
}

export function drawTrap(ctx: CanvasRenderingContext2D, t: Trap): void {
  ctx.strokeStyle = '#c9c3b6';
  ctx.fillStyle = 'rgba(60, 50, 40, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(t.pos.x, t.pos.y, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(t.pos.x + Math.cos(a) * 8, t.pos.y + Math.sin(a) * 5);
    ctx.lineTo(t.pos.x + Math.cos(a) * 14, t.pos.y + Math.sin(a) * 8 - 3);
    ctx.stroke();
  }
}

/** Re-export for the screen: how strongly a crown fades. */
export const CROWN_FADE = REWORK_MAP.crownFade;
