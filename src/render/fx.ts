// Visual effects driven by game events: particles, floating numbers,
// shake, hit-stop, rings and banners.

import type { EventBus } from '../core/events';
import { FX, type ShakeSpec } from '../data/fx';
import type { GameEvent } from '../systems/gameEvents';
import type { Vec } from '../systems/entities';
import { font } from './theme';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  width: number;
}

interface Cone {
  x: number;
  y: number;
  angle: number;
  width: number;
  range: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Slash {
  x: number;
  y: number;
  angle: number;
  reach: number;
  arc: number;
  life: number;
}

interface Banner {
  text: string;
  color: string;
  life: number;
}

export type ParticleSpec = { count: number; speed: number; life: number; size: number };

export class Fx {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  rings: Ring[] = [];
  cones: Cone[] = [];
  slashes: Slash[] = [];
  banner: Banner | null = null;
  shakeTime = 0;
  shakeDuration = 0;
  shakeStrength = 0;
  /** Fixed frames of hit-stop left. */
  hitStop = 0;
  /** Full-screen flash alpha. */
  flash = 0;
  flashColor = '#ffffff';
  reducedMotion = false;
  private seed = 1;
  private unsub: (() => void)[] = [];

  /** Deterministic-enough cheap random for visuals only. */
  rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  reset(): void {
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.cones = [];
    this.slashes = [];
    this.banner = null;
    this.shakeTime = 0;
    this.hitStop = 0;
    this.flash = 0;
  }

  attach(bus: EventBus<GameEvent>, handler: (e: GameEvent) => void): void {
    this.detach();
    this.unsub.push(bus.onAny(handler));
  }

  detach(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
  }

  burst(pos: Vec, spec: ParticleSpec, color: string): void {
    for (let i = 0; i < spec.count; i++) {
      if (this.particles.length >= FX.maxParticles) this.particles.shift();
      const a = this.rand() * Math.PI * 2;
      const sp = spec.speed * (0.4 + this.rand() * 0.8);
      const life = spec.life * (0.6 + this.rand() * 0.6);
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        size: spec.size * (0.6 + this.rand() * 0.8),
        color,
      });
    }
  }

  /** Particles spread along a line (dash trails). */
  lineBurst(from: Vec, to: Vec, spec: ParticleSpec, color: string): void {
    for (let i = 0; i < spec.count; i++) {
      const t = this.rand();
      this.burst({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, { ...spec, count: 1 }, color);
    }
  }

  /** Particles along a circle edge (whirlwind, shockwaves). */
  ringBurst(pos: Vec, radius: number, spec: ParticleSpec, color: string): void {
    for (let i = 0; i < spec.count; i++) {
      const a = this.rand() * Math.PI * 2;
      const sp = spec.speed * (0.5 + this.rand() * 0.5);
      const life = spec.life * (0.6 + this.rand() * 0.6);
      this.particles.push({
        x: pos.x + Math.cos(a) * radius,
        y: pos.y + Math.sin(a) * radius,
        vx: -Math.sin(a) * sp,
        vy: Math.cos(a) * sp,
        life,
        maxLife: life,
        size: spec.size,
        color,
      });
    }
  }

  /** Area texts must not cover (the hero), set every frame by the combat view. */
  avoid: { x: number; y: number; r: number } | null = null;

  text(pos: Vec, text: string, color: string, size: number, life: number = FX.damageText.life): void {
    const j = FX.damageText.jitter;
    let x = pos.x + (this.rand() - 0.5) * j;
    const y = pos.y + (this.rand() - 0.5) * j;
    const a = this.avoid;
    // Texts rise, so keep them out of a column above and around the hero.
    if (a && Math.abs(x - a.x) < a.r && y > a.y - FX.damageText.rise - a.r && y < a.y + a.r) {
      const side = x === a.x ? (this.rand() < 0.5 ? -1 : 1) : Math.sign(x - a.x);
      x = a.x + side * (a.r + this.rand() * j);
    }
    this.texts.push({
      x,
      y,
      text,
      color,
      size,
      life,
      maxLife: life,
    });
  }

  ring(pos: Vec, radius: number, color: string, life: number, width = 4): void {
    this.rings.push({ x: pos.x, y: pos.y, radius, color, life, maxLife: life, width });
  }

  cone(pos: Vec, angle: number, width: number, range: number, color: string, life: number): void {
    this.cones.push({ x: pos.x, y: pos.y, angle, width, range, color, life, maxLife: life });
  }

  shake(spec: ShakeSpec): void {
    if (this.reducedMotion) return;
    if (spec.strength >= this.shakeStrength * (this.shakeTime / Math.max(this.shakeDuration, 1e-6))) {
      this.shakeStrength = spec.strength;
      this.shakeDuration = spec.duration;
      this.shakeTime = spec.duration;
    }
  }

  stop(frames: number): void {
    this.hitStop = Math.max(this.hitStop, frames);
  }

  showBanner(text: string, color: string): void {
    this.banner = { text, color, life: FX.banner.life };
  }

  screenFlash(color: string, alpha: number): void {
    this.flash = Math.max(this.flash, alpha);
    this.flashColor = color;
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, 4 * dt);
      p.vy *= 1 - Math.min(1, 4 * dt);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= (FX.damageText.rise / t.maxLife) * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const sl of this.slashes) sl.life -= dt;
    this.lungeTime = Math.max(0, this.lungeTime - dt);
    this.slashes = this.slashes.filter((sl) => sl.life > 0);
    for (const c of this.cones) c.life -= dt;
    this.cones = this.cones.filter((c) => c.life > 0);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  shakeOffset(): Vec {
    if (this.shakeTime <= 0 || this.reducedMotion) return { x: 0, y: 0 };
    const k = this.shakeStrength * (this.shakeTime / this.shakeDuration);
    return { x: (this.rand() * 2 - 1) * k, y: (this.rand() * 2 - 1) * k };
  }

  drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawRings(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Body jerk of the hero after a swing: offset along the swing direction. */
  lungeTime = 0;
  lungeAngle = 0;

  slash(pos: Vec, angle: number, reach: number, arc: number): void {
    this.slashes.push({ x: pos.x, y: pos.y, angle, reach, arc, life: FX.slash.life });
    this.lungeTime = FX.lunge.life;
    this.lungeAngle = angle;
  }

  lungeOffset(): Vec {
    if (this.lungeTime <= 0) return { x: 0, y: 0 };
    const k = Math.sin((this.lungeTime / FX.lunge.life) * Math.PI) * FX.lunge.distance;
    return { x: Math.cos(this.lungeAngle) * k, y: Math.sin(this.lungeAngle) * k };
  }

  /** Swing: a filled crescent sweeping across the attack arc with a bright leading edge. */
  drawSlashes(ctx: CanvasRenderingContext2D): void {
    const S = FX.slash;
    for (const sl of this.slashes) {
      const k = 1 - sl.life / S.life;
      const start = sl.angle - sl.arc / 2;
      const head = start + sl.arc * Math.min(1, k * 1.8);
      const tail = start + sl.arc * Math.max(0, k * 1.8 - 0.8);
      const outer = sl.reach + S.outerExtra;
      const inner = sl.reach * S.innerFrac;
      ctx.globalAlpha = 0.55 * (1 - k);
      ctx.fillStyle = S.color;
      ctx.beginPath();
      ctx.arc(sl.x, sl.y, outer, tail, head);
      ctx.arc(sl.x, sl.y, inner, head, tail, true);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1 - k * 0.6;
      ctx.strokeStyle = S.edge;
      ctx.lineWidth = S.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sl.x + Math.cos(head) * inner, sl.y + Math.sin(head) * inner);
      ctx.lineTo(sl.x + Math.cos(head) * outer, sl.y + Math.sin(head) * outer);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sl.x, sl.y, outer, tail, head);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  drawCones(ctx: CanvasRenderingContext2D): void {
    for (const c of this.cones) {
      const k = c.life / c.maxLife;
      const grow = 0.6 + 0.4 * (1 - k);
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.arc(c.x, c.y, c.range * grow, c.angle - c.width / 2, c.angle + c.width / 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.range * grow, c.angle - c.width / 2, c.angle + c.width / 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.maxLife;
      const pop = k > 0.8 ? 1 + (k - 0.8) * 1.5 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = font(Math.round(t.size * pop), 'bold');
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  drawBanner(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const b = this.banner;
    if (!b) return;
    const total = FX.banner.life;
    const fade = FX.banner.fade;
    const age = total - b.life;
    const a = Math.min(1, age / fade, b.life / fade);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = font(34, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(b.text, cx, cy);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, cx, cy);
    ctx.globalAlpha = 1;
  }

  drawFlash(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.flash <= 0) return;
    ctx.globalAlpha = Math.min(0.6, this.flash);
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
