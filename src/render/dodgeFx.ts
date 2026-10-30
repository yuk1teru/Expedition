// Effects of the dodge on Space (rework, VISION §10), drawn by code — no pictures needed:
// - the warrior's shield dash: air streaks behind, dust at the start, sparks and a small
//   shockwave where it stops;
// - the archer's vault: a ring of wind at the push-off, leaves and grass blown up, streaks;
// - the mage's blink: flashes at both ends, see-through after-images along the way, sparks.

import type { Vec } from '../systems/entities';

export type DodgeKind = 'dash' | 'vault' | 'blink';

interface Particle {
  x: number;
  y: number;
  /** Height above the ground (drawn up from y). */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  age: number;
  size: number;
  color: string;
  kind: 'dot' | 'leaf' | 'spark';
  spin: number;
}

interface Streak {
  x: number;
  y: number;
  angle: number;
  len: number;
  age: number;
  life: number;
  color: string;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
  color: string;
  width: number;
}

interface Ghost {
  x: number;
  y: number;
  age: number;
  life: number;
}

const COLORS = {
  dash: { streak: 'rgba(235, 228, 210, 0.85)', dust: '#b49a76', spark: '#ffd27a', ring: 'rgba(255, 220, 150, 0.9)' },
  vault: { streak: 'rgba(225, 245, 225, 0.8)', ring: 'rgba(220, 245, 230, 0.9)', leaves: ['#6f9a3c', '#8bb24a', '#a5843f', '#5d7f30'] },
  blink: { ring: 'rgba(255, 170, 90, 0.95)', spark: ['#ffb45a', '#ffd88a', '#ff7a3a', '#fff0c0'] },
};

export class DodgeFx {
  private particles: Particle[] = [];
  private streaks: Streak[] = [];
  private rings: Ring[] = [];
  private ghosts: Ghost[] = [];
  /** The dodge in flight: its kind, direction and time to the next trail mark. */
  private active: { kind: DodgeKind; angle: number; trail: number } | null = null;
  private rand: () => number;

  constructor(rand: () => number = Math.random) {
    this.rand = rand;
  }

  reset(): void {
    this.particles = [];
    this.streaks = [];
    this.rings = [];
    this.ghosts = [];
    this.active = null;
  }

  private r(a: number, b: number): number {
    return a + this.rand() * (b - a);
  }

  /** The dodge starts. */
  start(kind: DodgeKind, from: Vec, to: Vec): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    this.active = { kind, angle, trail: 0 };
    if (kind === 'dash') {
      // A kick of dust behind the feet.
      for (let i = 0; i < 10; i++) this.puff(from, angle + Math.PI + this.r(-0.8, 0.8), this.r(40, 110), COLORS.dash.dust);
    } else if (kind === 'vault') {
      this.rings.push({ x: from.x, y: from.y, radius: 42, age: 0, life: 0.55, color: COLORS.vault.ring, width: 4 });
      for (let i = 0; i < 12; i++) this.leaf(from);
    } else {
      this.flash(from);
    }
  }

  /** The dodge has landed (the hero's dash is over). */
  end(at: Vec): void {
    const a = this.active;
    this.active = null;
    if (!a) return;
    if (a.kind === 'dash') {
      // It stops hard: sparks and a little shockwave in front of the shield.
      const front = { x: at.x + Math.cos(a.angle) * 18, y: at.y + Math.sin(a.angle) * 10 };
      this.rings.push({ x: front.x, y: front.y, radius: 38, age: 0, life: 0.45, color: COLORS.dash.ring, width: 4 });
      for (let i = 0; i < 9; i++) this.spark(front, a.angle + this.r(-1.1, 1.1), COLORS.dash.spark);
    } else if (a.kind === 'vault') {
      for (let i = 0; i < 6; i++) this.puff(at, this.r(0, Math.PI * 2), this.r(30, 70), '#a08a66');
    } else {
      this.flash(at);
    }
  }

  /** While the dodge flies: leave the trail of its kind behind the hero. */
  follow(at: Vec, dt: number): void {
    const a = this.active;
    if (!a) return;
    a.trail -= dt;
    if (a.trail > 0) return;
    if (a.kind === 'blink') {
      a.trail = 0.025;
      this.ghosts.push({ x: at.x, y: at.y, age: 0, life: 0.55 });
      const c = COLORS.blink.spark;
      for (let i = 0; i < 2; i++) this.spark({ x: at.x + this.r(-10, 10), y: at.y + this.r(-6, 6) }, this.r(0, Math.PI * 2), c[Math.floor(this.rand() * c.length)]!, 0.4);
      return;
    }
    a.trail = 0.02;
    const back = a.angle + Math.PI;
    const color = a.kind === 'dash' ? COLORS.dash.streak : COLORS.vault.streak;
    for (let i = 0; i < 2; i++) {
      const side = this.r(-16, 16);
      this.streaks.push({
        x: at.x + Math.cos(back) * 10 - Math.sin(a.angle) * side,
        y: at.y - this.r(10, 50) + Math.cos(a.angle) * side * 0.5,
        angle: a.angle,
        len: this.r(30, 56),
        age: 0,
        life: 0.38,
        color,
      });
    }
    if (a.kind === 'vault' && this.rand() < 0.5) this.leaf(at);
  }

  private puff(at: Vec, angle: number, speed: number, color: string): void {
    this.particles.push({ x: at.x, y: at.y, z: 2, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.5, vz: this.r(10, 40), life: this.r(0.5, 0.8), age: 0, size: this.r(5, 9), color, kind: 'dot', spin: 0 });
  }

  private spark(at: Vec, angle: number, color: string, slow = 1): void {
    const speed = this.r(120, 240) * slow;
    this.particles.push({ x: at.x, y: at.y, z: this.r(14, 34), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.5, vz: this.r(20, 90) * slow, life: this.r(0.35, 0.65), age: 0, size: this.r(2.5, 4), color, kind: 'spark', spin: 0 });
  }

  private leaf(at: Vec): void {
    const c = COLORS.vault.leaves;
    const a = this.r(0, Math.PI * 2);
    const speed = this.r(40, 120);
    this.particles.push({ x: at.x + this.r(-8, 8), y: at.y + this.r(-4, 4), z: 2, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.5, vz: this.r(90, 180), life: this.r(0.6, 0.9), age: 0, size: this.r(3, 5), color: c[Math.floor(this.rand() * c.length)]!, kind: 'leaf', spin: this.r(-12, 12) });
  }

  private flash(at: Vec): void {
    this.rings.push({ x: at.x, y: at.y - 30, radius: 48, age: 0, life: 0.5, color: COLORS.blink.ring, width: 5 });
    const c = COLORS.blink.spark;
    for (let i = 0; i < 14; i++) this.spark({ x: at.x, y: at.y }, this.r(0, Math.PI * 2), c[Math.floor(this.rand() * c.length)]!);
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      p.vz -= (p.kind === 'leaf' ? 260 : p.kind === 'spark' ? 300 : 60) * dt;
      // Leaves flutter and slow down in the air.
      const drag = p.kind === 'leaf' ? 2.2 : 3;
      p.vx -= p.vx * drag * dt;
      p.vy -= p.vy * drag * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const s of this.streaks) s.age += dt;
    this.streaks = this.streaks.filter((s) => s.age < s.life);
    for (const g of this.rings) g.age += dt;
    this.rings = this.rings.filter((g) => g.age < g.life);
    for (const g of this.ghosts) g.age += dt;
    this.ghosts = this.ghosts.filter((g) => g.age < g.life);
  }

  /** On the ground, under the bodies: rings and dust. */
  drawUnder(ctx: CanvasRenderingContext2D): void {
    for (const g of this.rings) {
      const k = g.age / g.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = g.width * (1 - k * 0.5);
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, g.radius * (0.4 + k), g.radius * (0.4 + k) * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** The mage's after-images: `drawFigure` draws the hero's warm-tinted look at a point. */
  drawGhosts(ctx: CanvasRenderingContext2D, drawFigure: (x: number, y: number) => void): void {
    if (this.ghosts.length === 0) return;
    ctx.save();
    for (const g of this.ghosts) {
      ctx.globalAlpha = 0.6 * (1 - g.age / g.life);
      drawFigure(g.x, g.y);
    }
    ctx.restore();
  }

  /** In the air, over the bodies: streaks, sparks, leaves, dust. */
  drawOver(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = 'round';
    for (const s of this.streaks) {
      const k = s.age / s.life;
      ctx.globalAlpha = 0.9 * (1 - k);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3.5;
      const len = s.len * (1 - k * 0.4);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - Math.cos(s.angle) * len, s.y - Math.sin(s.angle) * len * 0.6);
      ctx.stroke();
    }
    for (const p of this.particles) {
      const k = p.age / p.life;
      ctx.globalAlpha = p.kind === 'dot' ? 0.6 * (1 - k) : 1 - k * k;
      ctx.fillStyle = p.color;
      const y = p.y - p.z;
      if (p.kind === 'leaf') {
        ctx.save();
        ctx.translate(p.x, y);
        ctx.rotate(p.age * p.spin);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, y, p.kind === 'dot' ? p.size * (0.6 + k) : p.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
