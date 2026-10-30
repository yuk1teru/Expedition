// Beasts drawn from generated frames (rework, VISION §10): the pose is read from what the beast is
// doing in the logic (its act and timers), the walk loops by time, a hit shows the hurt frame or
// flashes, a dead beast falls and lies a moment. Three-quarter view: the beast never rotates, it
// only mirrors to face left or right.

import { BEAST_ANIM, BEAST_SHEETS, type BeastPose, type BeastSheet } from '../data/beastAnim';
import { REWORK_BOSS, REWORK_ENEMIES, REWORK_SPIRIT, type ReworkEnemyId } from '../data/rework';
import type { RunEnemy } from '../systems/rework/types';
import { lookSheet, sheet } from './heroAnim';

const A = BEAST_ANIM;

export function beastSheet(def: ReworkEnemyId): BeastSheet | undefined {
  return BEAST_SHEETS[def];
}

/** How much bigger than its kind this beast is drawn (an elite is bigger). */
export function beastSize(def: ReworkEnemyId, radius: number): number {
  return radius / REWORK_ENEMIES[def].radius;
}

/** Which way each beast last faced, by id: standing still it keeps it. */
const sides = new Map<number, number>();

function faceOf(e: RunEnemy): number {
  const act = e.act;
  let x = 0;
  if ('dir' in act) x = act.dir.x;
  else if (act.kind === 'leapWind' || act.kind === 'leapAir') x = act.to.x - e.pos.x;
  else if (Math.abs(e.vel.x) > 1) x = e.vel.x;
  let side = sides.get(e.id) ?? 1;
  if (x > 0.15) side = 1;
  else if (x < -0.15) side = -1;
  if (sides.size > 4000) sides.clear();
  sides.set(e.id, side);
  return side;
}

/** The side a dead beast lay facing (and forget it). */
export function lastSide(id: number): number {
  const side = sides.get(id) ?? 1;
  sides.delete(id);
  return side;
}

function poseOf(e: RunEnemy, sh: BeastSheet, time: number): BeastPose {
  const act = e.act;
  const d = REWORK_ENEMIES[e.def];
  switch (act.kind) {
    case 'crouch':
      return 'crouch';
    case 'leap':
      return 1 - act.time / d.leap!.time >= A.landAt ? 'land' : 'leap';
    case 'aim':
      return 1 - act.time / d.spit!.windup >= A.spitAt ? 'spit' : 'swell';
    case 'stomp':
      return 1 - act.time / d.stomp!.delay >= A.stompAt ? 'stomp' : 'raise';
    case 'cast':
      return 1 - act.time / REWORK_SPIRIT.windup >= A.releaseAt ? 'release' : 'cast';
    case 'dashWind':
    case 'leapWind':
    case 'leapAir':
      return act.kind;
    case 'dash':
      return 1 - act.time / (REWORK_BOSS.alpha.dash.length / REWORK_BOSS.alpha.dash.speed) >= A.skidAt ? 'skid' : 'dash';
    case 'rest':
      return REWORK_BOSS.alpha.rest - act.time < A.slamTime ? 'slam' : 'rest';
    case 'ring':
      return 'stand';
  }
  if (e.def === 'spirit' && e.hp < e.maxHp * REWORK_SPIRIT.fleeAt) return 'flee';
  if (e.boss && (e.howlTimer ?? 0) > REWORK_BOSS.alpha.howl.every - A.howlTime) return 'howl';
  if (d.stomp && e.traitTimer > d.stomp.every - d.stomp.delay - A.afterTime) return 'after';
  if (d.spit && e.traitTimer > d.spit.every - d.spit.windup - A.recoilTime) return 'recoil';
  if (!e.boss && sh.frames.hurt && time - e.hitAt < A.hurtTime) return 'hurt';
  return 'walk';
}

function frameOf(e: RunEnemy, sh: BeastSheet, time: number): number {
  const pose = poseOf(e, sh, time);
  const walk = sh.frames.walk!;
  if (pose !== 'walk') return (sh.frames[pose] ?? walk)[0]!;
  // Frozen or stunned — stands as it was; standing still — the standing frame.
  if (e.freeze > 0 || e.stun > 0) return walk[e.id % walk.length]!;
  if (Math.hypot(e.vel.x, e.vel.y) < 5) return (sh.frames.stand ?? walk)[0]!;
  return walk[Math.floor(time * sh.walkFps + e.id * 0.37) % walk.length]!;
}

/** One cell of the sheet with the feet at (x, y). */
function drawCell(ctx: CanvasRenderingContext2D, pic: CanvasImageSource, sh: BeastSheet, frame: number, x: number, y: number, side: number, size: number): void {
  const [cw, ch] = sh.cell;
  const [ax, ay] = sh.anchor;
  const k = sh.scale * size;
  const flip = sh.facesLeft?.includes(frame) ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side * flip * k, k);
  ctx.drawImage(pic, (frame % sh.columns) * cw, Math.floor(frame / sh.columns) * ch, cw, ch, -ax, -ay, cw, ch);
  ctx.restore();
}

/**
 * Draws a living beast from its frames with its feet `lift` px above its place; false if it has
 * no sheet or the sheet is not loaded yet (the caller draws a figure). A hit flashes it, the boss
 * only half (he is hit all the time in a duel).
 */
export function drawBeastFrames(ctx: CanvasRenderingContext2D, e: RunEnemy, time: number, lift = 0): boolean {
  const sh = BEAST_SHEETS[e.def];
  const img = sh && sheet(sh.src);
  if (!sh || !img) return false;
  const frame = frameOf(e, sh, time);
  const side = faceOf(e);
  const size = beastSize(e.def, e.radius);
  const y = e.pos.y - lift - (sh.hover ?? 0) * size;
  drawCell(ctx, img, sh, frame, e.pos.x, y, side, size);
  if (time - e.hitAt < (e.boss ? 0.05 : 0.08)) {
    ctx.save();
    ctx.globalAlpha *= e.boss ? 0.45 : 1;
    drawCell(ctx, lookSheet(img, sh.src, 'flash'), sh, frame, e.pos.x, y, side, size);
    ctx.restore();
  }
  return true;
}

/** A dead beast left on the ground for a moment (the logic forgets it at once). */
export interface Corpse {
  def: ReworkEnemyId;
  x: number;
  y: number;
  side: number;
  size: number;
  boss: boolean;
  age: number;
}

export function corpseLife(c: Corpse): number {
  return c.boss ? A.bossCorpseTime : A.corpseTime;
}

/** Falls through the death frames, lies on the last one and fades. */
export function drawCorpse(ctx: CanvasRenderingContext2D, c: Corpse): void {
  const sh = BEAST_SHEETS[c.def];
  const img = sh && sheet(sh.src);
  const die = sh?.frames.die;
  if (!sh || !img || !die) return;
  const frame = die[Math.min(die.length - 1, Math.floor(c.age / A.dieFrame))]!;
  const life = corpseLife(c);
  const fade = Math.min(1, (life - c.age) / A.corpseFade);
  if (fade <= 0) return;
  // The spirit melts upwards.
  const rise = c.def === 'spirit' ? 30 * (c.age / life) : 0;
  ctx.save();
  ctx.globalAlpha *= fade;
  drawCell(ctx, img, sh, frame, c.x, c.y - (sh.hover ?? 0) * c.size - rise, c.side, c.size);
  ctx.restore();
}
