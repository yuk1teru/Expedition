// Морозний вартовий (Ice miniboss): ice spikes under and around the hero, a fan of
// slowing shards, a frost nova around itself when the hero comes close.

import { ARENA } from '../../data/balance';
import { getBoss } from '../../data/bosses';
import { spawnProjectile } from '../ai';
import { addTelegraph, bossBusy, registerBoss } from '../boss';
import { angleOf, dist } from '../entities';

registerBoss('frostWarden', {
  attacks: {
    iceSpikes(b, boss, p) {
      const def = getBoss('frostWarden');
      const hero = b.hero;
      const spots = [{ ...hero.pos }];
      for (let i = 1; i < p.count!; i++) {
        const a = b.rng.float(0, Math.PI * 2);
        const r = b.rng.float(p.spreadMin!, p.spread!);
        spots.push({ x: hero.pos.x + Math.cos(a) * r, y: hero.pos.y + Math.sin(a) * r });
      }
      for (const s of spots) {
        s.x = Math.max(ARENA.x, Math.min(ARENA.x + ARENA.w, s.x));
        s.y = Math.max(ARENA.y, Math.min(ARENA.y + ARENA.h, s.y));
        addTelegraph(b, 'iceSpikes', s, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      }
    },
    shardVolley(b, boss, p) {
      const base = angleOf({ x: b.hero.pos.x - boss.pos.x, y: b.hero.pos.y - boss.pos.y });
      const step = (p.spreadDeg! * Math.PI) / 180;
      for (let k = 0; k < p.count!; k++) {
        const a = base + (k - (p.count! - 1) / 2) * step;
        spawnProjectile(b, {
          pos: { x: boss.pos.x + Math.cos(a) * boss.radius, y: boss.pos.y + Math.sin(a) * boss.radius },
          vel: { x: Math.cos(a) * p.speed!, y: Math.sin(a) * p.speed! },
          radius: 6,
          damage: boss.damage * p.damage!,
          team: 'enemy',
          owner: boss.boss?.defId ?? boss.defId,
          life: p.range! / p.speed!,
          pierce: 0,
          ricochet: 0,
          kind: 'iceShard',
          melee: false,
          slow: { value: p.slow!, time: p.slowTime! },
        });
      }
      b.events.emit({ type: 'enemyShot', pos: { ...boss.pos } });
    },
    frostNova(b, boss, p) {
      const def = getBoss('frostWarden');
      addTelegraph(b, 'frostNova', boss.pos, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      bossBusy(boss, def.telegraphDelay);
    },
  },
  canUse: {
    frostNova: (b, boss, p) => dist(b.hero.pos, boss.pos) <= p.trigger! + boss.radius,
  },
});
