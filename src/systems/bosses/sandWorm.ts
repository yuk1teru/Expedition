// Піщаний Хробак (Desert boss): burrows (untouchable) and bursts out under the hero,
// spits acid that leaves puddles; phase 2 — a sandstorm slows the hero, burrows more often.

import { ARENA } from '../../data/balance';
import { spawnProjectile } from '../ai';
import { addTelegraph, bossBusy, registerBoss } from '../boss';
import { debuffHero } from '../combat';
import { angleOf, dist } from '../entities';

registerBoss('sandWorm', {
  attacks: {
    burrow(b, boss, p) {
      const at = {
        x: Math.max(ARENA.x + boss.radius, Math.min(ARENA.x + ARENA.w - boss.radius, b.hero.pos.x)),
        y: Math.max(ARENA.y + boss.radius, Math.min(ARENA.y + ARENA.h - boss.radius, b.hero.pos.y)),
      };
      // Under the sand the worm is out of reach: it leaves the field until it bursts out.
      const i = b.enemies.indexOf(boss);
      if (i >= 0) b.enemies.splice(i, 1);
      b.events.emit({ type: 'spawn', pos: { ...boss.pos }, radius: boss.radius });
      bossBusy(boss, p.hideTime! + 0.5);
      addTelegraph(b, 'burrow', at, p.radius!, boss.damage * p.damage!, p.hideTime!, () => {
        if (boss.dead) return;
        boss.pos = { ...at };
        b.enemies.push(boss);
      });
    },
    acid(b, boss, p) {
      const base = angleOf({ x: b.hero.pos.x - boss.pos.x, y: b.hero.pos.y - boss.pos.y });
      const step = (p.spreadDeg! * Math.PI) / 180;
      const reach = Math.min(p.range!, Math.max(120, dist(boss.pos, b.hero.pos)));
      for (let k = 0; k < p.count!; k++) {
        const a = base + (k - (p.count! - 1) / 2) * step;
        spawnProjectile(b, {
          pos: { x: boss.pos.x + Math.cos(a) * boss.radius, y: boss.pos.y + Math.sin(a) * boss.radius },
          vel: { x: Math.cos(a) * p.speed!, y: Math.sin(a) * p.speed! },
          radius: 8,
          damage: boss.damage * p.damage!,
          team: 'enemy',
          life: reach / p.speed!,
          pierce: 0,
          ricochet: 0,
          kind: 'acid',
          melee: false,
          puddle: { kind: 'acid', radius: p.puddleRadius!, duration: p.puddleTime!, dps: boss.damage * p.puddleDps! },
        });
      }
      b.events.emit({ type: 'enemyShot', pos: { ...boss.pos } });
    },
    sandstorm(b, boss, p) {
      debuffHero(b, 'slow', p.time!, p.slow!);
      b.events.emit({ type: 'bossShout', text: 'Піщана буря!', pos: { ...boss.pos } });
    },
  },
});
