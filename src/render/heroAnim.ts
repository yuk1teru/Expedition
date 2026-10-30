// The warrior drawn from generated frames (rework, VISION §10): walking steps through the walk
// cycle by the distance covered, standing breathes, a basic attack swings vertically and
// horizontally in turn, skills play their own strike or raise the sword, a dash charges behind
// the shield with dust behind, a hit recoils. Three-quarter view: the figure never rotates, it
// only mirrors to face left or right.

import { type HeroAnimId, WARRIOR_ANIM } from '../data/heroAnim';
import type { Vec } from '../systems/entities';

/** What the animation reads from the hero (the old game's hero or the rework's): only whether a dash is on. */
export interface AnimBody {
  pos: Vec;
  vel: Vec;
  facing: number;
  dash: object | null;
  radius: number;
}

const A = WARRIOR_ANIM;

const sheets = new Map<string, HTMLImageElement>();

function sheet(src: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = sheets.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    sheets.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

interface Puff {
  x: number;
  y: number;
  age: number;
  side: number;
}

type OneShot = Exclude<HeroAnimId, 'walk' | 'idle'>;

/** What the warrior is doing; one per battle. */
export interface HeroAnimState {
  /** 1 — facing right, −1 — left. */
  side: number;
  last: { x: number; y: number } | null;
  moving: boolean;
  /** Seconds since the hero last had speed (walking holds a moment after a stop). */
  still: number;
  /** Walk cycle 0…1 and time at rest. */
  cycle: number;
  rest: number;
  /** The one-shot animation playing and its time. */
  shot: OneShot | null;
  time: number;
  /** The next basic attack swings horizontally (they take turns). */
  nextHorizontal: boolean;
  lastHitAt: number;
  lastHurt: number;
  clock: number;
  dustTimer: number;
  puffs: Puff[];
}

export function newHeroAnim(): HeroAnimState {
  return { side: 1, last: null, moving: false, still: 0, cycle: 0, rest: 0, shot: null, time: 0, nextHorizontal: false, lastHitAt: -Infinity, lastHurt: -Infinity, clock: 0, dustTimer: 0, puffs: [] };
}

/** Higher plays over lower. */
const PRIORITY: Record<OneShot, number> = { hurt: 1, dash: 2, slashV: 3, slashH: 3, lunge: 3, cast: 4 };

function play(s: HeroAnimState, anim: OneShot): void {
  if (s.shot && PRIORITY[s.shot] > PRIORITY[anim]) return;
  s.shot = anim;
  s.time = 0;
}

/** A basic attack: the vertical and the horizontal slash take turns. */
export function heroAnimAttack(s: HeroAnimState): void {
  play(s, s.nextHorizontal ? 'slashH' : 'slashV');
  s.nextHorizontal = !s.nextHorizontal;
}

/** A skill: its own strike if it has one, else the raised sword. */
export function heroAnimCast(s: HeroAnimState, skill?: string): void {
  const anim = skill ? A.skillAnim[skill as keyof typeof A.skillAnim] : undefined;
  play(s, (anim as OneShot | undefined) ?? 'cast');
}

const total = (anim: OneShot): number => A.durations[anim].reduce((a, b) => a + b, 0);

const STRIKES: ReadonlySet<OneShot> = new Set(['slashV', 'slashH', 'lunge', 'cast']);

/** Moves the state on by `dt` (render time) from what the hero does. */
export function stepHeroAnim(s: HeroAnimState, h: AnimBody, dt: number, hitAt: number): void {
  s.clock += dt;
  const moved = s.last ? Math.hypot(h.pos.x - s.last.x, h.pos.y - s.last.y) : 0;
  s.last = { x: h.pos.x, y: h.pos.y };
  // Walking is read from the hero's speed, not from how far it moved since the last frame: the
  // logic steps 60 times a second and a faster screen draws frames with no step between them,
  // which looked like a stop and flashed the idle frame. A short hold covers a quick release.
  s.still = Math.hypot(h.vel.x, h.vel.y) > 20 ? 0 : s.still + dt;
  s.moving = s.still < 0.08;
  s.cycle = (s.cycle + moved / A.stride) % 1;
  s.rest = s.moving ? 0 : s.rest + dt;
  // Faces where it walks (no walking backwards); while striking or casting — where it strikes.
  // Mirror only on a clear turn, so moving or aiming straight up or down does not flicker.
  const striking = s.shot !== null && STRIKES.has(s.shot);
  const speed = Math.hypot(h.vel.x, h.vel.y);
  const c = !striking && speed > 1 ? h.vel.x / speed : Math.cos(h.facing);
  if (c > 0.2) s.side = 1;
  else if (c < -0.2) s.side = -1;
  if (hitAt > s.lastHitAt) {
    s.lastHitAt = hitAt;
    // Walking, a hit only flashes: the recoil would break the steps.
    if (!s.moving && s.clock - s.lastHurt > A.hurtEvery) {
      s.lastHurt = s.clock;
      play(s, 'hurt');
    }
  }
  if (h.dash && s.shot !== 'dash') play(s, 'dash');
  if (s.shot) {
    s.time += dt;
    // A dash holds its last frame while the hero is still dashing.
    const done = s.shot === 'dash' ? !h.dash && s.time > total('dash') * 0.5 : s.time >= total(s.shot);
    if (done) s.shot = null;
  }
  if (h.dash) {
    s.dustTimer -= dt;
    if (s.dustTimer <= 0) {
      s.dustTimer = A.dustEvery;
      s.puffs.push({ x: h.pos.x, y: h.pos.y + h.radius * 0.6, age: 0, side: s.side });
    }
  }
  for (const p of s.puffs) p.age += dt;
  s.puffs = s.puffs.filter((p) => p.age < A.dustLife);
}

/** The animation shown now and its frame (a cell of the sheet). */
function currentFrame(s: HeroAnimState): { anim: HeroAnimId; frame: number } {
  if (s.shot) {
    const durations = A.durations[s.shot];
    let t = s.time;
    for (let i = 0; i < durations.length; i++) {
      if (t < durations[i]! || i === durations.length - 1) return { anim: s.shot, frame: A.frames[s.shot][i]! };
      t -= durations[i]!;
    }
  }
  if (s.moving) return { anim: 'walk', frame: A.frames.walk[Math.floor(s.cycle * A.frames.walk.length) % A.frames.walk.length]! };
  return { anim: 'idle', frame: A.frames.idle[0]! };
}

function drawFx(ctx: CanvasRenderingContext2D, img: HTMLImageElement, rect: number[], x: number, y: number, size: number, alpha: number): void {
  const [x0, y0, x1, y1] = rect as [number, number, number, number];
  const k = A.fxScale;
  const w = x1 - x0;
  const h = y1 - y0;
  const scale = size / Math.max(w, h);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, x0 * k, y0 * k, w * k, h * k, x - (w / 2) * scale, y - (h / 2) * scale, w * scale, h * scale);
  ctx.restore();
}

/** Dust behind a dash, drawn under the hero in world coordinates. */
export function drawHeroDust(ctx: CanvasRenderingContext2D, s: HeroAnimState): void {
  const fx = sheet(A.fxSheet);
  if (!fx) return;
  for (const p of s.puffs) {
    const k = p.age / A.dustLife;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(-p.side, 1);
    drawFx(ctx, fx, A.fx.dust, 0, 0, 30 + 16 * k, 0.75 * (1 - k));
    ctx.restore();
  }
}

/**
 * Draws the warrior with its feet at (0, `feet`) of the current transform; false if the
 * frames are not loaded yet (the caller draws the old figure).
 */
export function drawWarrior(ctx: CanvasRenderingContext2D, s: HeroAnimState, feet: number, flash: boolean): boolean {
  const img = sheet(A.sheet.src);
  if (!img) return false;
  const { anim, frame } = currentFrame(s);
  const sh = A.sheet;
  const [cw, ch] = sh.cell;
  const [ax, ay] = sh.anchor;
  const sx = (frame % sh.columns) * cw;
  const sy = Math.floor(frame / sh.columns) * ch;
  const scale = A.height / sh.frameHeight;
  // Walking: the body lifts between steps.
  const step = (s.cycle * A.frames.walk.length) % 1;
  const lift = anim === 'walk' ? A.walkBob * Math.sin(Math.PI * step) : 0;
  // Standing: the chest rises and falls (a slight stretch up from the feet).
  const breath = anim === 'idle' ? 1 + A.breathScale * (0.5 + 0.5 * Math.sin((s.rest / A.breathPeriod) * Math.PI * 2)) : 1;
  // A hit: tilted back from the feet, easing out.
  const tilt = anim === 'hurt' ? -A.hurtTilt * (1 - s.time / total('hurt')) : 0;
  ctx.save();
  ctx.translate(0, feet);
  ctx.scale(s.side * scale, scale * breath);
  ctx.rotate(tilt);
  ctx.translate(0, -lift);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (flash) ctx.filter = 'brightness(1.6)';
  ctx.drawImage(img, sx, sy, cw, ch, -ax, -ay, cw, ch);
  ctx.filter = 'none';
  // A skill: the sign on the chest flares while the sword is raised.
  const fx = sheet(A.fxSheet);
  if (fx && s.shot === 'cast') {
    const k = Math.max(0, 1 - Math.abs(s.time - A.durations.cast[0]! - 0.08) / 0.2);
    if (k > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawFx(ctx, fx, A.fx.signFlare, A.chest[0], A.chest[1], 40 + 60 * k, k);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
  return true;
}
