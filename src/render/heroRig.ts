// The warrior drawn as a cut-out puppet (rework, VISION §10): the parts from `WARRIOR_RIG` are
// turned at their joints by code — breathing, steps, a swing on each basic attack, a raised
// glowing sword on a skill, a lean behind the shield on a dash, a recoil when hit. Three-quarter
// view: the figure never rotates, it only mirrors to face left or right.

import { type RigFx, type RigPart, type RigPose, WARRIOR_RIG } from '../data/heroRig';
import type { Hero } from '../systems/entities';

const R = WARRIOR_RIG;
const P = R.parts;
const T = R.timing;

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

/** What the puppet is doing; one per battle. */
export interface RigState {
  /** 1 — facing right, −1 — left. */
  side: number;
  last: { x: number; y: number } | null;
  /** Smoothed walking amount 0…1 and the step phase (radians). */
  walk: number;
  phase: number;
  breath: number;
  /** Seconds since the action started (Infinity — none). */
  attack: number;
  cast: number;
  hurt: number;
  dash: number;
  lastHitAt: number;
  dustTimer: number;
  puffs: Puff[];
}

export function newRigState(): RigState {
  return { side: 1, last: null, walk: 0, phase: 0, breath: 0, attack: Infinity, cast: Infinity, hurt: Infinity, dash: 0, lastHitAt: -Infinity, dustTimer: 0, puffs: [] };
}

export function rigAttack(s: RigState): void {
  s.attack = 0;
}

export function rigCast(s: RigState): void {
  s.cast = 0;
}

const KEYS: (RigPart | 'lean' | 'lift')[] = ['head', 'torso', 'cloak', 'armU', 'armF', 'hand', 'shieldU', 'shieldF', 'legBack', 'legFront', 'sword', 'shield', 'lean', 'lift'];

function mix(a: RigPose, b: RigPose, k: number): RigPose {
  const out: RigPose = {};
  for (const key of KEYS) out[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * k;
  return out;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Moves the state on by `dt` (render time) from what the hero does. */
export function stepRig(s: RigState, h: Hero, dt: number, hitAt: number): void {
  const pos = h.pos;
  const moved = s.last ? Math.hypot(pos.x - s.last.x, pos.y - s.last.y) : 0;
  s.last = { x: pos.x, y: pos.y };
  const moving = dt > 0 && moved / dt > 20 ? 1 : 0;
  s.walk += (moving - s.walk) * clamp01(dt * 10);
  s.phase += (moved / T.stride) * Math.PI * 2;
  s.breath += dt * T.breath * Math.PI * 2;
  // Mirror only on a clear turn, so aiming straight up or down does not flicker.
  const c = Math.cos(h.facing);
  if (c > 0.2) s.side = 1;
  else if (c < -0.2) s.side = -1;
  s.attack += dt;
  s.cast += dt;
  s.hurt += dt;
  if (hitAt > s.lastHitAt) {
    s.lastHitAt = hitAt;
    s.hurt = 0;
  }
  s.dash += ((h.dash ? 1 : 0) - s.dash) * clamp01(dt * 18);
  if (h.dash) {
    s.dustTimer -= dt;
    if (s.dustTimer <= 0) {
      s.dustTimer = T.dustEvery;
      s.puffs.push({ x: pos.x, y: pos.y + h.radius * 0.6, age: 0, side: s.side });
    }
  }
  for (const p of s.puffs) p.age += dt;
  s.puffs = s.puffs.filter((p) => p.age < T.dustLife);
}

/** A pose written as changes to the rest pose. */
const over = (p: RigPose): RigPose => ({ ...R.poses.idle, ...p });

function currentPose(s: RigState): RigPose {
  const poses = R.poses;
  const step = (Math.sin(s.phase) + 1) / 2;
  let pose = mix(poses.idle, mix(over(poses.stepA), over(poses.stepB), step), s.walk);
  pose.lift = (pose.lift ?? 0) - (1 - s.walk) * (Math.sin(s.breath) + 1) * 0.5 * T.breathLift;
  if (s.dash > 0.01) pose = mix(pose, over(poses.dash), s.dash);
  if (s.attack < T.attackEnd) {
    const t = s.attack;
    if (t < T.windup) pose = mix(pose, over(poses.windup), t / T.windup);
    else if (t < T.swing) pose = mix(over(poses.windup), over(poses.swing), (t - T.windup) / (T.swing - T.windup));
    else pose = mix(pose, over(poses.swing), 1 - (t - T.swing) / (T.attackEnd - T.swing));
  } else if (s.cast < T.castEnd) {
    const t = s.cast;
    const k = t < T.castRise ? t / T.castRise : t < T.castHold ? 1 : 1 - (t - T.castHold) / (T.castEnd - T.castHold);
    pose = mix(pose, over(poses.cast), k);
  }
  // A recoil adds to whatever the body is doing.
  if (s.hurt < T.hurt) {
    const k = 1 - s.hurt / T.hurt;
    const hurt: RigPose = poses.hurt;
    for (const key of KEYS) pose[key] = (pose[key] ?? 0) + (hurt[key] ?? 0) * k;
  }
  return pose;
}

type Vec2 = [number, number];
const rot = (v: Vec2, a: number): Vec2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];

function tipOf(part: RigPart, at: Vec2, angle: number): Vec2 {
  const d = P[part];
  const tip = 'tip' in d ? d.tip : d.pivot;
  return add(at, rot([tip[0] - d.pivot[0], tip[1] - d.pivot[1]], angle));
}

function drawPart(ctx: CanvasRenderingContext2D, img: HTMLImageElement, part: RigPart, at: Vec2, angle: number): void {
  const d = P[part];
  const [x0, y0, x1, y1] = d.rect;
  const k = R.sheetScale;
  ctx.save();
  ctx.translate(at[0], at[1]);
  ctx.rotate(angle);
  ctx.drawImage(img, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, -d.pivot[0], -d.pivot[1], x1 - x0, y1 - y0);
  ctx.restore();
}

function drawFx(ctx: CanvasRenderingContext2D, img: HTMLImageElement, fx: RigFx, at: Vec2, size: number, angle = 0, alpha = 1): void {
  const [x0, y0, x1, y1] = R.fx[fx];
  const k = R.sheetScale;
  const w = x1 - x0;
  const h = y1 - y0;
  const scale = size / Math.max(w, h);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(at[0], at[1]);
  ctx.rotate(angle);
  ctx.drawImage(img, x0 * k, y0 * k, w * k, h * k, (-w / 2) * scale, (-h / 2) * scale, w * scale, h * scale);
  ctx.restore();
}

/** Dust behind a dash, drawn under the hero in world coordinates. */
export function drawRigDust(ctx: CanvasRenderingContext2D, s: RigState): void {
  const fx = sheet(R.fxSheet);
  if (!fx) return;
  for (const p of s.puffs) {
    const k = p.age / T.dustLife;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(-p.side, 1);
    drawFx(ctx, fx, 'dust', [0, 0], 30 + 16 * k, 0, 0.75 * (1 - k));
    ctx.restore();
  }
}

/**
 * Draws the warrior with its feet at (0, `feet`) of the current transform; false if the
 * pictures are not loaded yet (the caller draws the old figure).
 */
export function drawWarriorRig(ctx: CanvasRenderingContext2D, s: RigState, feet: number, flash: boolean): boolean {
  const img = sheet(R.sheet);
  const fx = sheet(R.fxSheet);
  if (!img || !fx) return false;
  const pose = currentPose(s);
  const g = (key: RigPart | 'lean' | 'lift'): number => pose[key] ?? 0;
  const J = R.joints;
  const lean = g('lean');
  const root: Vec2 = [0, g('lift')];
  const onTorso = (j: Vec2): Vec2 => add(root, rot(j, lean));
  const legLift = g('lift') * 0.3;
  const scale = R.height / R.sheetHeight;

  ctx.save();
  ctx.translate(0, feet);
  ctx.scale(s.side * scale, scale);
  ctx.translate(0, -R.ground);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (flash) ctx.filter = 'brightness(1.6)';

  drawPart(ctx, img, 'cloak', onTorso(J.clasp as Vec2), lean + g('cloak'));
  drawPart(ctx, img, 'legFront', add(J.hipFront as Vec2, [0, legLift]), g('legFront'));
  drawPart(ctx, img, 'legBack', add(J.hipBack as Vec2, [0, legLift]), g('legBack'));
  drawPart(ctx, img, 'torso', root, lean);
  drawPart(ctx, img, 'head', onTorso(J.neck as Vec2), lean + g('head'));

  // The sword arm: shoulder → elbow → wrist → grip.
  const a1 = lean + g('armU');
  const shoulder = onTorso(J.swordShoulder as Vec2);
  const elbow = tipOf('armU', shoulder, a1);
  const a2 = a1 + g('armF');
  const wrist = tipOf('armF', elbow, a2);
  const a3 = a2 + g('hand');
  const grip = tipOf('hand', wrist, a3);
  const swordAngle = a3 + g('sword');
  drawPart(ctx, img, 'armU', shoulder, a1);
  drawPart(ctx, img, 'armF', elbow, a2);
  drawPart(ctx, img, 'sword', grip, swordAngle);
  drawPart(ctx, img, 'hand', wrist, a3);

  // The shield arm in front.
  const b1 = lean + g('shieldU');
  const shoulder2 = onTorso(J.shieldShoulder as Vec2);
  const elbow2 = tipOf('shieldU', shoulder2, b1);
  const b2 = b1 + g('shieldF');
  drawPart(ctx, img, 'shieldU', shoulder2, b1);
  drawPart(ctx, img, 'shieldF', elbow2, b2);
  drawPart(ctx, img, 'shield', tipOf('shieldF', elbow2, b2), g('shield'));

  ctx.filter = 'none';
  // A skill: the blade glows and the sign on the chest flares.
  if (s.cast < T.castEnd) {
    const k = s.cast < T.castRise ? s.cast / T.castRise : s.cast < T.castHold ? 1 : 1 - (s.cast - T.castHold) / (T.castEnd - T.castHold);
    const sw = P.sword;
    const mid: Vec2 = add(grip, rot([(sw.rect[2] - sw.rect[0]) / 2 - sw.pivot[0], (sw.rect[3] - sw.rect[1]) / 2 - sw.pivot[1]], swordAngle));
    ctx.globalCompositeOperation = 'lighter';
    drawFx(ctx, fx, 'bladeGlow', mid, 560, swordAngle, k);
    const flare = Math.max(0, 1 - Math.abs(s.cast - T.castRise) / 0.18);
    if (flare > 0) drawFx(ctx, fx, 'signFlare', onTorso(J.chest as Vec2), 220 + 240 * flare, 0, flare);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  return true;
}
