// Крижаний Лицар (Ice boss): rams along a line to the wall (1 s telegraph), sends a
// ring of ice spikes with two gaps; phase 2 — a cold aura slows the hero, two rams in a row.

import { ARENA } from '../../data/balance';
import { getBoss } from '../../data/bosses';
import { addShapedTelegraph, bossBusy, bossDash, registerBoss } from '../boss';
import { type Vec, dist, normalize } from '../entities';
import { addRing } from '../hazards';

/** Where a ray from `from` along `dir` meets the arena wall (kept `pad` px inside). */
function toWall(from: Vec, dir: Vec, pad: number): Vec {
  const x0 = ARENA.x + pad;
  const x1 = ARENA.x + ARENA.w - pad;
  const y0 = ARENA.y + pad;
  const y1 = ARENA.y + ARENA.h - pad;
  let t = Infinity;
  if (dir.x > 1e-6) t = Math.min(t, (x1 - from.x) / dir.x);
  if (dir.x < -1e-6) t = Math.min(t, (x0 - from.x) / dir.x);
  if (dir.y > 1e-6) t = Math.min(t, (y1 - from.y) / dir.y);
  if (dir.y < -1e-6) t = Math.min(t, (y0 - from.y) / dir.y);
  if (!Number.isFinite(t)) t = 0;
  return { x: from.x + dir.x * Math.max(0, t), y: from.y + dir.y * Math.max(0, t) };
}

registerBoss('iceKnight', {
  attacks: {
    ram(b, boss, p) {
      const def = getBoss('iceKnight');
      const rt = boss.boss!;
      let dir = normalize({ x: b.hero.pos.x - boss.pos.x, y: b.hero.pos.y - boss.pos.y });
      if (dir.x === 0 && dir.y === 0) dir = { x: 1, y: 0 };
      const to = toWall(boss.pos, dir, boss.radius);
      addShapedTelegraph(b, 'ram', boss.pos, { kind: 'line', to, width: p.width! }, boss.damage * p.damage!, def.telegraphDelay, () =>
        bossDash(boss, to, p.speed!),
      );
      bossBusy(boss, def.telegraphDelay + dist(boss.pos, to) / p.speed!);
      // Phase 2: a second ram right after the first one.
      if (rt.phase === 2 && !rt.timers.chain) {
        rt.queued = 'ram';
        rt.timers.chain = 1;
      } else rt.timers.chain = 0;
    },
    spikeRing(b, boss, p) {
      const g0 = b.rng.float(0, Math.PI * 2);
      const gaps = [g0];
      if (p.gaps! > 1) gaps.push(g0 + b.rng.float(Math.PI * 0.6, Math.PI * 1.4));
      addRing(b, 'spikeRing', boss.pos, { speed: p.speed!, width: p.width!, damage: boss.damage * p.damage!, maxRadius: p.maxRadius!, gaps, gapDeg: p.gapDeg! });
    },
  },
});
