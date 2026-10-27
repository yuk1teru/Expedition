// {name:lord} (the siege, ROADMAP 17.3): the abyss opens under the hero, the dead rise around
// him, a ring of death grows from him with gaps to step into, and close by — a reaping blow.

import { ARENA } from '../../data/balance';
import { getBoss } from '../../data/bosses';
import { addTelegraph, bossBusy, registerBoss } from '../boss';
import { dist } from '../entities';
import { addRing } from '../hazards';
import { spawnEnemy } from '../waves';

registerBoss('darkLord', {
  attacks: {
    abyss(b, boss, p) {
      const def = getBoss('darkLord');
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
        addTelegraph(b, 'abyss', s, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      }
    },
    graveRise(b, boss, p, atk) {
      const id = atk.enemyId;
      if (!id) return;
      for (let i = 0; i < p.count!; i++) {
        const a = (i / p.count!) * Math.PI * 2 + b.rng.float(0, 0.5);
        spawnEnemy(b, id, { x: boss.pos.x + Math.cos(a) * p.ring!, y: boss.pos.y + Math.sin(a) * p.ring! }, false, true);
      }
    },
    deathRing(b, boss, p) {
      const g0 = b.rng.float(0, Math.PI * 2);
      const gaps = [g0];
      if (p.gaps! > 1) gaps.push(g0 + b.rng.float(Math.PI * 0.6, Math.PI * 1.4));
      addRing(b, 'deathRing', boss.pos, { speed: p.speed!, width: p.width!, damage: boss.damage * p.damage!, maxRadius: p.maxRadius!, gaps, gapDeg: p.gapDeg! });
    },
    reap(b, boss, p) {
      const def = getBoss('darkLord');
      addTelegraph(b, 'reap', boss.pos, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      bossBusy(boss, def.telegraphDelay);
    },
  },
  canUse: {
    reap: (b, boss, p) => dist(b.hero.pos, boss.pos) <= p.trigger!,
  },
});
