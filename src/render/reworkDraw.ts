// Drawing the rework's Forest (ROADMAP 20.2–20.4): ground, obstacles, beasts with their warnings,
// shots, gems. Beasts with a sheet are drawn from frames (beastAnim.ts), the rest with code figures
// until the art comes (VISION §10). Three-quarter view: every body stands on its foot point, and
// the caller draws them sorted by it.

import { REWORK_BOSS, REWORK_CLASSES, REWORK_ELITES, REWORK_ENEMIES, REWORK_MAP, REWORK_PICKUPS, REWORK_TASKS } from '../data/rework';
import { FOREST_ART } from '../data/forestArt';
import { beastSheet, beastSize, drawBeastFrames } from './beastAnim';
import { artCrown, drawPart, drawProp, obstacleParts, partsBox, propsAtlas } from './forestArt';
import type { Altar, Chest, Coin, Gem, Herb, Obstacle, RunEnemy, RunHero, Shot, Shrine, Task, Trap, Zone } from '../systems/rework/types';

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
  if (propsAtlas()) return artCrown(o);
  if (o.kind === 'tree') return { x: o.pos.x, y: o.pos.y - o.height * 0.62, r: o.radius * 2.3 };
  if (o.kind === 'oak') return { x: o.pos.x, y: o.pos.y - o.height * 0.75, r: o.radius * 2.1 };
  return null;
}

interface ObstaclePicture {
  pic: HTMLCanvasElement;
  ox: number;
  oy: number;
  /** Painted from the props atlas (else from code figures, until the atlas loads). */
  art: boolean;
}

const obstaclePictures = new WeakMap<Obstacle, ObstaclePicture>();

function codePicture(o: Obstacle): ObstaclePicture {
  const w = Math.ceil(o.radius * 6 + 60);
  const h = Math.ceil(o.height * 1.4 + o.radius * 3 + 60);
  const pic = document.createElement('canvas');
  pic.width = w;
  pic.height = h;
  const ox = w / 2;
  const oy = h - o.radius - 20;
  const g = pic.getContext('2d')!;
  g.translate(ox - o.pos.x, oy - o.pos.y);
  paintObstacle(g, o);
  return { pic, ox, oy, art: false };
}

function artPicture(o: Obstacle, img: HTMLImageElement): ObstaclePicture {
  const parts = obstacleParts(o);
  const box = partsBox(parts);
  const pic = document.createElement('canvas');
  pic.width = Math.ceil(box.right - box.left) + 4;
  pic.height = Math.ceil(box.bottom - box.top) + 4;
  const ox = 2 - box.left;
  const oy = 2 - box.top;
  const g = pic.getContext('2d')!;
  for (const p of parts) drawPart(g, img, p, ox, oy);
  return { pic, ox, oy, art: true };
}

/**
 * What an obstacle is drawn as, each layer sorted by its own foot: the Stone Ring drawn from the
 * atlas is a ring of separate stones (the hero by it is in front of the back ones and behind the
 * front ones), anything else is one picture.
 */
export function obstacleLayers(o: Obstacle): { y: number; draw: (ctx: CanvasRenderingContext2D, alpha: number) => void }[] {
  const img = propsAtlas();
  if (o.kind !== 'stoneRing' || !img) return [{ y: o.pos.y, draw: (ctx, alpha) => drawObstacle(ctx, o, alpha) }];
  return obstacleParts(o).map((p) => ({ y: o.pos.y + p.dy, draw: (ctx) => drawPart(ctx, img, p, o.pos.x, o.pos.y) }));
}

/**
 * `alpha` — how solid an obstacle is drawn (a tree fades when someone stands behind it). Each
 * obstacle is painted once into a picture of its own (scaling a big piece of the atlas, or a
 * dozen outlined shapes, on every frame for dozens of trees is costly); a code picture is painted
 * again from the atlas once it loads.
 */
export function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, alpha: number): void {
  let c = obstaclePictures.get(o);
  if ((!c || !c.art) && typeof document !== 'undefined') {
    const img = propsAtlas();
    if (!c || img) {
      c = img ? artPicture(o, img) : codePicture(o);
      obstaclePictures.set(o, c);
    }
  }
  if (!c) return paintObstacle(ctx, o);
  ctx.globalAlpha = alpha;
  ctx.drawImage(c.pic, o.pos.x - c.ox, o.pos.y - c.oy);
  ctx.globalAlpha = 1;
}

function paintObstacle(ctx: CanvasRenderingContext2D, o: Obstacle): void {
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
  if (e.def === 'nest') return drawNest(ctx, e, time);
  if (e.def === 'spirit') return drawSpirit(ctx, e, time);
  if (e.def === 'alpha') return drawAlpha(ctx, e, time);
  const r = e.radius;
  const side = e.vel.x < -1 ? -1 : 1;
  const flash = time - e.hitAt < 0.08;
  const bob = Math.abs(Math.sin(time * 9 + e.id)) * (e.act.kind === 'walk' ? 2 : 0);
  const sh = beastSheet(e.def);
  const size = beastSize(e.def, r);
  drawShadow(ctx, e.pos.x, e.pos.y, sh ? sh.shadow * size : r);
  // An elite glows in the colour of its trait.
  if (e.elite) {
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.25 * Math.sin(time * 6);
    ctx.strokeStyle = REWORK_ELITES.traits[e.elite].color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    const ring = sh ? sh.shadow * size * 1.3 : r * 1.5;
    ctx.ellipse(e.pos.x, e.pos.y, ring, ring * 0.53, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const drawn = drawBeastFrames(ctx, e, time);
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y - bob);
  ctx.scale(side, 1);
  if (drawn) {
    // Drawn from its frames.
  } else if (e.def === 'wolf') {
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
  const tall = drawn && sh ? sh.height * size : r * 2.2;
  if (e.freeze > 0) {
    ctx.fillStyle = 'rgba(160, 215, 255, 0.45)';
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.pos.x, e.pos.y - tall * 0.42, Math.max(r * 1.3, tall * 0.75), tall * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.stun > 0) {
    ctx.fillStyle = '#ffe27a';
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(e.pos.x + Math.cos(a) * r * 0.8, e.pos.y - tall - 6 + Math.sin(a) * r * 0.25, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  hpBar(ctx, e, e.pos.y - tall - 8, r * 2.2);
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
  if (s.kind === 'spore') return drawSpore(ctx, s);
  const y = s.pos.y - 18;
  ctx.fillStyle = '#ff9d3a';
  ctx.strokeStyle = '#fff0b0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.pos.x, y, s.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** A mushroom's spore: a glowing pink-red ball with a trail of sparks, as on its spit frame. */
function drawSpore(ctx: CanvasRenderingContext2D, s: Shot): void {
  const y = s.pos.y - 24;
  const speed = Math.hypot(s.vel.x, s.vel.y) || 1;
  const bx = -s.vel.x / speed;
  const by = -s.vel.y / speed;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(s.pos.x, y, 0, s.pos.x, y, s.radius * 2.6);
  glow.addColorStop(0, 'rgba(255, 90, 140, 0.8)');
  glow.addColorStop(1, 'rgba(255, 40, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(s.pos.x - s.radius * 2.6, y - s.radius * 2.6, s.radius * 5.2, s.radius * 5.2);
  ctx.fillStyle = 'rgba(255, 110, 150, 0.7)';
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(s.pos.x + bx * s.radius * 1.6 * i, y + by * s.radius * 1.6 * i, s.radius * (0.55 - i * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#ff5a8c';
  ctx.strokeStyle = '#8a1838';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(s.pos.x, y, s.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd0de';
  ctx.beginPath();
  ctx.arc(s.pos.x - s.radius * 0.3, y - s.radius * 0.3, s.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
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

// ---- 20.9–20.13: what lies on the map, the special beasts, the boss and the ring ----

export function drawChest(ctx: CanvasRenderingContext2D, c: Chest, time: number): void {
  const { x, y } = c.pos;
  const glow = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.3 * glow;
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (drawProp(ctx, FOREST_ART.chest, FOREST_ART.chestScale, x, y)) return;
  drawShadow(ctx, x, y, 16);
  ctx.fillStyle = '#7a4a22';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 20, 30, 20, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9a6030';
  ctx.beginPath();
  ctx.roundRect(x - 16, y - 28, 32, 10, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(x - 3, y - 22, 6, 7);
}

export function drawHerb(ctx: CanvasRenderingContext2D, g: Herb, time: number): void {
  const { x, y } = g.pos;
  const sway = Math.sin(time * 2 + x) * 2;
  if (propsAtlas()) {
    // The white bells glow softly.
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 3 + x);
    ctx.fillStyle = '#e8f4a0';
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawProp(ctx, FOREST_ART.herb, FOREST_ART.herbScale, x, y);
    return;
  }
  ctx.strokeStyle = '#2f6a2a';
  ctx.lineWidth = 2.5;
  for (const [dx, h] of [[-5, 14], [0, 18], [5, 13]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y);
    ctx.quadraticCurveTo(x + dx + sway, y - h / 2, x + dx * 1.6 + sway, y - h);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8f4a0';
  ctx.beginPath();
  ctx.arc(x + sway, y - 19, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawShrine(ctx: CanvasRenderingContext2D, s: Shrine, time: number): void {
  const { x, y } = s.pos;
  const k = REWORK_PICKUPS.shrineKinds[s.kind];
  const ready = s.rest <= 0;
  const r = REWORK_PICKUPS.shrineRadius;
  ctx.strokeStyle = ready ? k.color : 'rgba(150,150,150,0.5)';
  ctx.globalAlpha = ready ? 0.5 + 0.2 * Math.sin(time * 3) : 0.4;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // Charging: the ring fills.
  if (s.charge > 0) {
    ctx.strokeStyle = k.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.55, 0, -Math.PI / 2, -Math.PI / 2 + (s.charge / REWORK_PICKUPS.shrineCharge) * Math.PI * 2);
    ctx.stroke();
  }
  if (drawProp(ctx, FOREST_ART.shrine, FOREST_ART.shrineScale, x, y)) {
    // The crystal glows in the colour of its buff while it is ready.
    if (!ready) return;
    const [gx, gy] = FOREST_ART.shrineGem;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 + 0.25 * Math.sin(time * 3);
    const glow = ctx.createRadialGradient(x + gx, y + gy, 0, x + gx, y + gy, 22);
    glow.addColorStop(0, k.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x + gx - 22, y + gy - 22, 44, 44);
    ctx.restore();
    return;
  }
  drawShadow(ctx, x, y, 14);
  ctx.fillStyle = '#7d7a72';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 9, y - 40, 18, 40, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ready ? k.color : '#55554f';
  ctx.beginPath();
  ctx.arc(x, y - 28, 5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawAltar(ctx: CanvasRenderingContext2D, a: Altar, time: number, near: boolean): void {
  const { x, y } = a.pos;
  if (drawProp(ctx, FOREST_ART.altar, FOREST_ART.altarScale, x, y)) {
    // The candle flickers; brighter when the hero stands by.
    const [fx, fy] = FOREST_ART.altarFlame;
    const r = near ? 26 : 16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (near ? 0.7 : 0.45) + 0.15 * Math.sin(time * 9) * Math.sin(time * 5.3);
    const glow = ctx.createRadialGradient(x + fx, y + fy, 0, x + fx, y + fy, r);
    glow.addColorStop(0, '#ffd27a');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x + fx - r, y + fy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }
  drawShadow(ctx, x, y, 26);
  ctx.fillStyle = '#6b6560';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 24, y - 18, 48, 18, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#857e76';
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 30, 36, 13, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = near ? '#ffe08a' : '#c9a24a';
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 5);
  ctx.beginPath();
  ctx.ellipse(x, y - 32, 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** The way out for the lumberjack, on the ground. */
export function drawTaskGround(ctx: CanvasRenderingContext2D, t: Task, time: number): void {
  if (t.kind !== 'rescue' || t.state !== 'active') return;
  const e = t.exit;
  const R = REWORK_TASKS.rescue.exitRadius;
  ctx.fillStyle = `rgba(255, 210, 120, ${0.12 + 0.08 * Math.sin(time * 3)})`;
  ctx.strokeStyle = 'rgba(255, 210, 120, 0.8)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, R, R * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number): void {
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function drawLumberjack(ctx: CanvasRenderingContext2D, t: Task, time: number): void {
  if (t.kind !== 'rescue' || t.state !== 'active') return;
  const { x, y } = t.man;
  const r = 13;
  drawShadow(ctx, x, y, r);
  const bob = t.following ? Math.abs(Math.sin(time * 9)) * 2 : 0;
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.fillStyle = '#5a7a3a';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, 0);
  ctx.lineTo(r * 0.8, 0);
  ctx.lineTo(r * 0.5, -r * 2.3);
  ctx.lineTo(-r * 0.5, -r * 2.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  blob(ctx, 0, -r * 2.65, r * 0.55, r * 0.55, '#e6c39a');
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r * 0.7, -r * 0.6);
  ctx.lineTo(r * 1.3, -r * 2.2);
  ctx.stroke();
  ctx.fillStyle = '#c9ccd4';
  ctx.fillRect(r * 1.1, -r * 2.5, 7, 6);
  ctx.restore();
  if (!t.following) label(ctx, '!', x, y - r * 3.6, '#ffd27a', 18);
}

function hpBar(ctx: CanvasRenderingContext2D, e: RunEnemy, y: number, w: number): void {
  if (e.hp >= e.maxHp) return;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(e.pos.x - w / 2 - 1, y - 1, w + 2, 5);
  ctx.fillStyle = '#e5534b';
  ctx.fillRect(e.pos.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 3);
}

/** A wolf den: a mound of earth and branches with a dark mouth. */
function drawNest(ctx: CanvasRenderingContext2D, e: RunEnemy, time: number): void {
  const r = e.radius;
  const flash = time - e.hitAt < 0.08;
  if (drawProp(ctx, FOREST_ART.den, FOREST_ART.denScale, e.pos.x, e.pos.y, flash)) {
    hpBar(ctx, e, e.pos.y - 70, r * 2.2);
    return;
  }
  drawShadow(ctx, e.pos.x, e.pos.y, r * 1.3);
  blob(ctx, e.pos.x, e.pos.y - r * 0.5, r * 1.3, r * 0.8, flash ? '#ffffff' : '#5b4630');
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.ellipse(e.pos.x, e.pos.y - r * 0.35, r * 0.6, r * 0.38, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#3d2c1c';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(e.pos.x + Math.cos(a) * r * 0.9, e.pos.y - r * 0.5 + Math.sin(a) * r * 0.5);
    ctx.lineTo(e.pos.x + Math.cos(a) * r * 1.4, e.pos.y - r * 0.5 + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
  hpBar(ctx, e, e.pos.y - r * 1.8, r * 2.2);
}

/** The spirit of decay: a pale drifting shape; it swells and glows before it casts the fog. */
export function drawSpirit(ctx: CanvasRenderingContext2D, e: RunEnemy, time: number): void {
  const r = e.radius;
  const casting = e.act.kind === 'cast';
  const flash = time - e.hitAt < 0.08;
  const float = Math.sin(time * 2.5 + e.id) * 4;
  const y = e.pos.y - 30 + float;
  const sh = beastSheet('spirit');
  if (sh && drawBeastFrames(ctx, e, time, -float)) {
    hpBar(ctx, e, e.pos.y - float - (sh.hover! + sh.height) * beastSize(e.def, r) - 6, r * 2.6);
    return;
  }
  ctx.save();
  if (casting) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#c8d6c0';
    ctx.beginPath();
    ctx.arc(e.pos.x, y, r * (2.4 + Math.sin(time * 20) * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = flash ? '#ffffff' : '#a9b8a2';
  ctx.strokeStyle = 'rgba(40, 50, 40, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(e.pos.x - r, y);
  ctx.quadraticCurveTo(e.pos.x - r, y - r * 1.6, e.pos.x, y - r * 1.6);
  ctx.quadraticCurveTo(e.pos.x + r, y - r * 1.6, e.pos.x + r, y);
  for (let i = 3; i >= 0; i--) ctx.lineTo(e.pos.x - r + (i * 2 * r) / 3, y + (i % 2 ? r * 0.9 : r * 0.4) + Math.sin(time * 6 + i) * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#20281e';
  ctx.beginPath();
  ctx.arc(e.pos.x - r * 0.35, y - r * 0.7, 2.5, 0, Math.PI * 2);
  ctx.arc(e.pos.x + r * 0.35, y - r * 0.7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  hpBar(ctx, e, y - r * 2.2, r * 2.6);
}

/** The pack leader: a big dark wolf with a pale mane and red eyes. */
function drawAlpha(ctx: CanvasRenderingContext2D, e: RunEnemy, time: number): void {
  const r = e.radius;
  const side = e.vel.x < -1 ? -1 : 1;
  // Hit all the time in a duel: a short warm flash, not a white body.
  const flash = time - e.hitAt < 0.05;
  const air = e.act.kind === 'leapAir' ? Math.sin((1 - e.act.time / REWORK_BOSS.alpha.leap.time) * Math.PI) * 40 : 0;
  const sh = beastSheet('alpha');
  drawShadow(ctx, e.pos.x, e.pos.y, (sh ? sh.shadow : r) * (1 - air / 120));
  if (drawBeastFrames(ctx, e, time, air)) {
    if (e.act.kind === 'rest') stars(ctx, e.pos.x, e.pos.y - sh!.height - 8, r * 0.9, time);
    return;
  }
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y - air);
  ctx.scale(side, 1);
  const crouch = e.act.kind === 'dashWind' || e.act.kind === 'leapWind' ? 0.75 : 1;
  const stretch = e.act.kind === 'dash' ? 1.4 : 1;
  ctx.scale(stretch, crouch);
  const body = flash ? '#8a7466' : '#4a4038';
  blob(ctx, -r * 0.1, -r * 0.8, r * 1.2, r * 0.72, body);
  blob(ctx, -r * 0.25, -r * 1.15, r * 0.7, r * 0.45, flash ? '#efe6d6' : '#c9bfae');
  blob(ctx, r * 1.0, -r * 1.25, r * 0.55, r * 0.5, body);
  ctx.fillStyle = '#2c2520';
  ctx.beginPath();
  ctx.moveTo(r * 0.8, -r * 1.6);
  ctx.lineTo(r * 0.95, -r * 2.2);
  ctx.lineTo(r * 1.15, -r * 1.65);
  ctx.fill();
  ctx.fillStyle = '#ff4a3a';
  ctx.beginPath();
  ctx.arc(r * 1.2, -r * 1.3, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Resting after a leap: winded — stars over the head.
  if (e.act.kind === 'rest') stars(ctx, e.pos.x, e.pos.y - r * 2.4, r * 0.9, time);
}

/** Stars over a dazed head. */
function stars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, time: number): void {
  ctx.fillStyle = '#ffe27a';
  for (let i = 0; i < 3; i++) {
    const a = time * 6 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * w, y + Math.sin(a) * w * 0.28, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The boss's warnings on the ground: the dash's line and the leap's landing circle. */
export function drawBossWarning(ctx: CanvasRenderingContext2D, e: RunEnemy): void {
  const A = REWORK_BOSS.alpha;
  const act = e.act;
  if (act.kind === 'dashWind') {
    const k = 1 - act.time / A.dash.windup;
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    ctx.rotate(Math.atan2(act.dir.y, act.dir.x));
    ctx.fillStyle = `rgba(230, 70, 60, ${0.15 + 0.25 * k})`;
    ctx.strokeStyle = 'rgba(230, 70, 60, 0.9)';
    ctx.lineWidth = 2;
    ctx.fillRect(0, -A.dash.width / 2, A.dash.length, A.dash.width);
    ctx.strokeRect(0, -A.dash.width / 2, A.dash.length, A.dash.width);
    ctx.fillStyle = 'rgba(230, 70, 60, 0.5)';
    ctx.fillRect(0, -A.dash.width / 2, A.dash.length * k, A.dash.width);
    ctx.restore();
  } else if (act.kind === 'leapWind' || act.kind === 'leapAir') {
    const R = A.leap.radius;
    const k = act.kind === 'leapWind' ? 1 - act.time / A.leap.windup : 1;
    ctx.fillStyle = `rgba(230, 70, 60, ${0.15 + 0.2 * k})`;
    ctx.strokeStyle = 'rgba(230, 70, 60, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(act.to.x, act.to.y, R, R * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(act.to.x, act.to.y, R * k, R * 0.6 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** The living ring's wall: a dark band on the ground just inside the beasts. */
export function drawRingWall(ctx: CanvasRenderingContext2D, c: { x: number; y: number }, time: number): void {
  const R = REWORK_BOSS.ringRadius;
  ctx.strokeStyle = `rgba(120, 30, 20, ${0.35 + 0.1 * Math.sin(time * 3)})`;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, R, R * 0.62, 0, 0, Math.PI * 2);
  ctx.stroke();
}
