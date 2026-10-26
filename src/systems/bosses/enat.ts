// Старий Енат (Forest): roots under the hero, wolf summons, close-range slam.

import { ARENA } from '../../data/balance';
import { getBoss } from '../../data/bosses';
import { addTelegraph, bossBusy, registerBoss } from '../boss';
import { dist } from '../entities';
import { spawnEnemy } from '../waves';

registerBoss('enat', {
  attacks: {
    roots(b, boss, p) {
      const def = getBoss('enat');
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
        addTelegraph(b, 'roots', s, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      }
    },
    summon(b, boss, p, atk) {
      const id = atk.enemyId;
      if (!id) return;
      for (let i = 0; i < p.count!; i++) {
        const a = (i / p.count!) * Math.PI * 2 + b.rng.float(0, 0.5);
        spawnEnemy(b, id, { x: boss.pos.x + Math.cos(a) * p.ring!, y: boss.pos.y + Math.sin(a) * p.ring! }, false, true);
      }
    },
    slam(b, boss, p) {
      const def = getBoss('enat');
      addTelegraph(b, 'slam', boss.pos, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      bossBusy(boss, def.telegraphDelay);
    },
  },
  canUse: {
    slam: (b, boss, p) => dist(b.hero.pos, boss.pos) <= p.trigger!,
  },
});
