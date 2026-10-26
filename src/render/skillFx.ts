// Visual reactions to skill events (shake, particles, cones, rings).

import { FX } from '../data/fx';
import { skillParams } from '../data/skills';
import type { GameEvent } from '../systems/gameEvents';
import type { Fx } from './fx';

export function skillFx(fx: Fx, e: GameEvent): void {
  const P = FX.particles;
  if (e.type === 'skillCast') {
    const p = skillParams(e.skillId, e.rank);
    switch (e.skillId) {
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
      case 'fireTrail':
        if (fx.rand() < FX.trailSparkChance) fx.burst(e.pos, P.trail, '#ffb347');
        break;
    }
  }
}
