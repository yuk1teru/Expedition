// Королівський скорпіон (Desert miniboss): poisoning sting dash, tail sweep around itself,
// calls scorpions.

import { ARENA } from '../../data/balance';
import { getBoss } from '../../data/bosses';
import { addShapedTelegraph, addTelegraph, bossBusy, bossDash, registerBoss, telegraphContains } from '../boss';
import { addStatus } from '../combat';
import { dist, normalize } from '../entities';
import { spawnEnemy } from '../waves';

registerBoss('scorpionKing', {
  attacks: {
    sting(b, boss, p) {
      const def = getBoss('scorpionKing');
      const dir = normalize({ x: b.hero.pos.x - boss.pos.x, y: b.hero.pos.y - boss.pos.y });
      const r = boss.radius;
      const to = {
        x: Math.max(ARENA.x + r, Math.min(ARENA.x + ARENA.w - r, boss.pos.x + dir.x * p.length!)),
        y: Math.max(ARENA.y + r, Math.min(ARENA.y + ARENA.h - r, boss.pos.y + dir.y * p.length!)),
      };
      const t = addShapedTelegraph(b, 'sting', boss.pos, { kind: 'line', to, width: p.width! }, boss.damage * p.damage!, def.telegraphDelay, () => {
        if (!b.hero.dead && b.hero.invulnerable <= 0 && telegraphContains(t, b.hero.pos, b.hero.radius * 0.5)) {
          addStatus(b.hero, 'poison', p.poisonTime!, boss.damage * p.poisonDps!);
        }
        bossDash(boss, to, p.speed!);
      });
      bossBusy(boss, def.telegraphDelay + dist(boss.pos, to) / p.speed!);
    },
    tailSweep(b, boss, p) {
      const def = getBoss('scorpionKing');
      addTelegraph(b, 'slam', boss.pos, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      bossBusy(boss, def.telegraphDelay);
    },
    brood(b, boss, p, atk) {
      if (!atk.enemyId) return;
      for (let i = 0; i < p.count!; i++) {
        const a = (i / p.count!) * Math.PI * 2 + b.rng.float(0, 1);
        spawnEnemy(b, atk.enemyId, { x: boss.pos.x + Math.cos(a) * p.ring!, y: boss.pos.y + Math.sin(a) * p.ring! }, false, true);
      }
    },
  },
  canUse: {
    sting: (b, boss, p) => {
      const d = dist(b.hero.pos, boss.pos);
      return d >= p.minRange! && d <= p.length! + 40;
    },
    tailSweep: (b, boss, p) => dist(b.hero.pos, boss.pos) <= p.trigger! + boss.radius,
  },
});
