// Ватажок зграї (Forest miniboss): telegraphed lunge along a line, howl that calls wolves.

import { ARENA } from '../../data/balance';
import { getBoss } from '../../data/bosses';
import { addShapedTelegraph, bossBusy, bossDash, registerBoss } from '../boss';
import { dist, normalize } from '../entities';
import { spawnEnemy } from '../waves';

registerBoss('alpha', {
  attacks: {
    lunge(b, boss, p) {
      const def = getBoss('alpha');
      const dir = normalize({ x: b.hero.pos.x - boss.pos.x, y: b.hero.pos.y - boss.pos.y });
      const r = boss.radius;
      const to = {
        x: Math.max(ARENA.x + r, Math.min(ARENA.x + ARENA.w - r, boss.pos.x + dir.x * p.length!)),
        y: Math.max(ARENA.y + r, Math.min(ARENA.y + ARENA.h - r, boss.pos.y + dir.y * p.length!)),
      };
      addShapedTelegraph(b, 'lunge', boss.pos, { kind: 'line', to, width: p.width! }, boss.damage * p.damage!, def.telegraphDelay, () =>
        bossDash(boss, to, p.speed!),
      );
      bossBusy(boss, def.telegraphDelay + dist(boss.pos, to) / p.speed!);
    },
    howl(b, boss, p, atk) {
      const id = atk.enemyId;
      if (!id) return;
      for (let i = 0; i < p.count!; i++) {
        const a = (i / p.count!) * Math.PI * 2 + b.rng.float(0, 1);
        spawnEnemy(b, id, { x: boss.pos.x + Math.cos(a) * p.ring!, y: boss.pos.y + Math.sin(a) * p.ring! }, false, true);
      }
    },
  },
  canUse: {
    lunge: (b, boss, p) => {
      const d = dist(b.hero.pos, boss.pos);
      return d >= p.minRange! && d <= p.length!;
    },
  },
});
