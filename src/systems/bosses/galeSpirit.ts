// Дух бурі (event-wave elemental): lots of HP, keeps its distance, fires fast
// slowing bolts and blinks away with a gust when the hero gets close.

import { ARENA } from '../../data/balance';
import { getBoss } from '../../data/bosses';
import { spawnProjectile } from '../ai';
import { addTelegraph, registerBoss } from '../boss';
import { angleOf, dist, normalize } from '../entities';

registerBoss('galeSpirit', {
  attacks: {
    volley(b, boss, p) {
      const base = angleOf({ x: b.hero.pos.x - boss.pos.x, y: b.hero.pos.y - boss.pos.y });
      const step = (p.spreadDeg! * Math.PI) / 180;
      for (let i = 0; i < p.count!; i++) {
        const a = base + (i - (p.count! - 1) / 2) * step;
        const dir = { x: Math.cos(a), y: Math.sin(a) };
        spawnProjectile(b, {
          pos: { x: boss.pos.x + dir.x * boss.radius, y: boss.pos.y + dir.y * boss.radius },
          vel: { x: dir.x * p.speed!, y: dir.y * p.speed! },
          radius: 7,
          damage: boss.damage,
          team: 'enemy',
          life: p.range! / p.speed!,
          pierce: 0,
          ricochet: 0,
          kind: 'gale',
          melee: false,
          slow: { value: p.slow!, time: p.slowTime! },
        });
      }
      b.events.emit({ type: 'enemyShot', pos: { ...boss.pos } });
    },
    blink(b, boss, p) {
      const def = getBoss('galeSpirit');
      addTelegraph(b, 'gust', boss.pos, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      // Away from the hero, kept inside the arena.
      const away = normalize({ x: boss.pos.x - b.hero.pos.x, y: boss.pos.y - b.hero.pos.y });
      const dir = away.x === 0 && away.y === 0 ? { x: 1, y: 0 } : away;
      const r = boss.radius + 10;
      let to = { x: boss.pos.x + dir.x * p.distance!, y: boss.pos.y + dir.y * p.distance! };
      to = { x: Math.max(ARENA.x + r, Math.min(ARENA.x + ARENA.w - r, to.x)), y: Math.max(ARENA.y + r, Math.min(ARENA.y + ARENA.h - r, to.y)) };
      if (dist(to, boss.pos) < p.distance! * 0.5) {
        // Cornered: jump across to the far side instead.
        to = { x: ARENA.x + ARENA.w - (boss.pos.x - ARENA.x), y: ARENA.y + ARENA.h - (boss.pos.y - ARENA.y) };
      }
      b.events.emit({ type: 'spawn', pos: { ...boss.pos }, radius: boss.radius });
      boss.pos = to;
      b.events.emit({ type: 'spawn', pos: { ...to }, radius: boss.radius });
    },
  },
  canUse: {
    blink: (b, boss, p) => dist(b.hero.pos, boss.pos) <= p.trigger! + boss.radius,
  },
});
