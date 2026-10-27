// Visual reactions to skill events (shake, particles, cones, rings).

import { FX } from '../data/fx';
import { skillParams } from '../data/skills';
import type { GameEvent } from '../systems/gameEvents';
import type { Fx } from './fx';

export function skillFx(fx: Fx, e: GameEvent): void {
  const P = FX.particles;
  const C = FX.classColors;
  if (e.type === 'chain') {
    fx.bolt(e.points, C.lightning, 0.28);
    for (const pt of e.points.slice(1)) fx.burst(pt, P.spark, C.lightning);
    return;
  }
  if (e.type === 'shieldHit') {
    fx.ring(e.pos, 30, C.frost, 0.25, 3);
    if (e.broken) {
      fx.burst(e.pos, P.frost, C.frost);
      fx.text({ x: e.pos.x, y: e.pos.y - 40 }, 'Бар’єр зламано', C.frost, 14, 1.2);
    }
    return;
  }
  if (e.type === 'skillCast') {
    const p = skillParams(e.skillId, e.rank);
    switch (e.skillId) {
      case 'fireball':
      case 'magicMissiles':
        fx.burst(e.pos, P.spark, e.skillId === 'fireball' ? C.fire : C.arcane);
        break;
      case 'teleport':
        if (e.target) {
          fx.lineBurst(e.pos, e.target, P.chargeTrail, C.arcane);
          fx.ring(e.pos, 30, C.arcane, 0.35, 4);
          fx.ring(e.target, 30, C.arcane, 0.35, 4);
        }
        break;
      case 'iceBarrier':
        fx.ring(e.pos, 40, C.frost, 0.5, 6);
        fx.burst(e.pos, P.frost, C.frost);
        break;
      case 'flameWall':
        if (e.target) fx.burst(e.target, P.fire, C.fire);
        break;
      case 'vortex':
        if (e.target) fx.ring(e.target, p.radius ?? 0, C.arcane, 0.5, 5);
        break;
      case 'multishot':
        if (e.target) {
          const angle = Math.atan2(e.target.y - e.pos.y, e.target.x - e.pos.x);
          fx.cone(e.pos, angle, ((p.angle ?? 0) * Math.PI) / 180, 70, C.steel, 0.18);
        }
        break;
      case 'hunterTrap':
      case 'arrowRain':
      case 'hunterMark':
        if (e.target) fx.ring(e.target, e.skillId === 'arrowRain' ? (p.radius ?? 0) : 26, e.skillId === 'hunterMark' ? C.blood : C.nature, 0.4, 4);
        break;
      case 'vault':
      case 'piercingShot':
        if (e.target) fx.lineBurst(e.pos, e.target, P.chargeTrail, e.skillId === 'vault' ? C.nature : '#fff1b8');
        break;
      case 'barrage':
      case 'rage':
        fx.ring(e.pos, 34, FX.battleCryRing.color, 0.4, 5);
        fx.burst(e.pos, P.battleCry, e.skillId === 'rage' ? C.blood : FX.battleCryRing.color);
        if (e.skillId === 'rage') fx.shake(FX.shake.charge);
        break;
      case 'holyShield':
        fx.ring(e.pos, 60, '#f2d16b', 0.6, 7);
        fx.burst(e.pos, P.levelUp, '#f2d16b');
        fx.screenFlash('#fff4c2', 0.25);
        break;
      case 'blizzard':
        fx.ring(e.pos, p.radius ?? 0, C.frost, 0.5, 5);
        break;
      case 'callOfPack':
        fx.ring(e.pos, 50, C.nature, 0.5, 5);
        fx.burst(e.pos, P.battleCry, '#b08a5a');
        break;
      case 'whirlwind':
        fx.shake(FX.shake.whirlwind);
        fx.ringBurst(e.pos, p.radius ?? 0, P.whirl, '#ffffff');
        break;
      case 'charge':
        fx.burst(e.pos, P.charge, FX.chargeRing.color);
        if (e.target) fx.lineBurst(e.pos, e.target, P.chargeTrail, FX.chargeRing.color);
        break;
      case 'battleCry':
        fx.ring(e.pos, p.tauntRadius ?? 0, FX.battleCryRing.color, FX.battleCryRing.life, 6);
        fx.burst(e.pos, P.battleCry, FX.battleCryRing.color);
        break;
      case 'ironSkin':
        fx.ring(e.pos, 40, '#bed2eb', 0.5, 6);
        break;
      case 'hook': {
        if (!e.target) break;
        const angle = Math.atan2(e.target.y - e.pos.y, e.target.x - e.pos.x);
        fx.cone(e.pos, angle, ((p.angle ?? 0) * Math.PI) / 180, p.range ?? 0, '#8fd3ff', FX.slamCone.life);
        fx.lineBurst(e.pos, e.target, P.chargeTrail, '#8fd3ff');
        break;
      }
      case 'groundSlam': {
        if (!e.target) break;
        const angle = Math.atan2(e.target.y - e.pos.y, e.target.x - e.pos.x);
        const width = ((p.angle ?? 0) * Math.PI) / 180;
        fx.cone(e.pos, angle, width, p.range ?? 0, FX.slamCone.color, FX.slamCone.life);
        fx.shake(FX.shake.groundSlam);
        fx.stop(FX.hitStop.skill);
        const mid = { x: (e.pos.x + e.target.x) / 2, y: (e.pos.y + e.target.y) / 2 };
        fx.burst(mid, P.slam, '#c9a36b');
        break;
      }
    }
    return;
  }
  if (e.type === 'skillTick') {
    switch (e.skillId) {
      case 'fireball':
      case 'vortexBlast':
      case 'blinkBlast': {
        const color = e.skillId === 'fireball' ? C.fire : C.arcane;
        fx.ring(e.pos, e.radius, color, 0.4, 6);
        fx.burst(e.pos, P.fire, color);
        fx.shake(FX.shake.fireball);
        fx.stop(FX.hitStop.skill);
        break;
      }
      case 'boltSplash':
        fx.ring(e.pos, e.radius, C.fire, 0.2, 3);
        break;
      case 'meteorBlast':
        fx.ring(e.pos, e.radius, C.fire, 0.55, 8);
        fx.burst(e.pos, P.eliteDeath, C.fire);
        fx.shake(FX.shake.groundSlam);
        fx.stop(FX.hitStop.skill);
        break;
      case 'judgementBlast':
        fx.ring(e.pos, e.radius, '#f2d16b', 0.5, 8);
        fx.ringBurst(e.pos, e.radius * 0.8, P.spark, '#fff4c2');
        fx.shake(FX.shake.groundSlam);
        break;
      case 'iceSpireBlast':
        fx.ring(e.pos, e.radius, C.frost, 0.35, 5);
        fx.burst(e.pos, P.frost, C.frost);
        break;
      case 'burstArrowBlast':
        fx.ring(e.pos, e.radius, '#ff9a5e', 0.4, 6);
        fx.burst(e.pos, P.spark, '#ff9a5e');
        break;
      case 'holyBurst':
        fx.ring(e.pos, e.radius, '#f2d16b', 0.45, 6);
        fx.ringBurst(e.pos, e.radius * 0.8, P.spark, '#fff4c2');
        break;
      case 'shatter':
        fx.burst(e.pos, P.frost, C.frost);
        break;
      case 'aegis':
        fx.ring(e.pos, e.radius, '#f2d16b', 0.4, 4);
        break;
      case 'aimedShot':
        fx.burst(e.pos, P.spark, '#fff1b8');
        fx.shake(FX.shake.charge);
        break;
      case 'frostRing':
      case 'frostNova':
        fx.ring(e.pos, e.radius, C.frost, 0.45, 6);
        fx.ringBurst(e.pos, e.radius * 0.8, P.frost, C.frost);
        if (e.skillId === 'frostRing') fx.shake(FX.shake.whirlwind);
        break;
      case 'trapBlast':
      case 'net':
        fx.ring(e.pos, e.radius, e.skillId === 'net' ? C.steel : C.nature, 0.4, 5);
        fx.burst(e.pos, P.slam, e.skillId === 'net' ? C.steel : '#c9a36b');
        if (e.skillId === 'trapBlast') fx.shake(FX.shake.trap);
        break;
      case 'burnGround':
      case 'flameWall':
        if (fx.rand() < 0.5) fx.burst(e.pos, P.trail, C.fire);
        break;
      case 'vortex':
        fx.ringBurst(e.pos, e.radius, P.spark, C.arcane);
        break;
      case 'arrowRain': {
        const a = fx.rand() * Math.PI * 2;
        const rr = fx.rand() * e.radius;
        fx.burst({ x: e.pos.x + Math.cos(a) * rr, y: e.pos.y + Math.sin(a) * rr }, P.rain, C.steel);
        break;
      }
      case 'whirlwind':
        fx.ringBurst(e.pos, e.radius, P.whirl, '#ffffff');
        fx.shake(FX.shake.whirlwind);
        break;
      case 'charge':
        fx.shake(FX.shake.charge);
        fx.stop(FX.hitStop.skill);
        fx.ring(e.pos, e.radius, FX.chargeRing.color, FX.chargeRing.life, 5);
        fx.burst(e.pos, P.charge, FX.chargeRing.color);
        break;
      case 'earthquake':
        fx.shake(FX.shake.charge);
        fx.ring(e.pos, e.radius, '#c9a36b', 0.45, 6);
        fx.ringBurst(e.pos, e.radius * 0.8, P.slam, '#c9a36b');
        break;
      case 'fireTrail':
        if (fx.rand() < FX.trailSparkChance) fx.burst(e.pos, P.trail, '#ffb347');
        break;
    }
  }
}
