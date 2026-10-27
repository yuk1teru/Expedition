// Стара Жаба (Swamp miniboss): leaps onto the hero, lashes with its tongue (pulls the
// hero in), croaks for frogs.

import { ENEMY_COMMON } from '../../data/balance';
import { getBoss } from '../../data/bosses';
import { addShapedTelegraph, addTelegraph, bossBusy, bossDash, registerBoss, telegraphContains } from '../boss';
import { dist, normalize } from '../entities';
import { spawnEnemy } from '../waves';

registerBoss('bigToad', {
  attacks: {
    leap(b, boss, p) {
      const def = getBoss('bigToad');
      const to = { ...b.hero.pos };
      addTelegraph(b, 'leap', to, p.radius!, boss.damage * p.damage!, def.telegraphDelay);
      bossDash(boss, to, Math.max(1, dist(boss.pos, to)) / def.telegraphDelay);
      bossBusy(boss, def.telegraphDelay);
    },
    tongue(b, boss, p) {
      const def = getBoss('bigToad');
      const dir = normalize({ x: b.hero.pos.x - boss.pos.x, y: b.hero.pos.y - boss.pos.y });
      const to = { x: boss.pos.x + dir.x * p.length!, y: boss.pos.y + dir.y * p.length! };
      const t = addShapedTelegraph(b, 'tongue', boss.pos, { kind: 'line', to, width: p.width! }, boss.damage * p.damage!, def.telegraphDelay, () => {
        const hero = b.hero;
        if (hero.dead || hero.invulnerable > 0 || !telegraphContains(t, hero.pos, hero.radius * 0.5)) return;
        // Yanked towards the toad: an impulse that carries the hero about `pull` px.
        const back = normalize({ x: boss.pos.x - hero.pos.x, y: boss.pos.y - hero.pos.y });
        hero.knockback.x += back.x * p.pull! * ENEMY_COMMON.knockbackDecay;
        hero.knockback.y += back.y * p.pull! * ENEMY_COMMON.knockbackDecay;
      });
      bossBusy(boss, def.telegraphDelay);
    },
    croak(b, boss, p, atk) {
      if (!atk.enemyId) return;
      for (let i = 0; i < p.count!; i++) {
        const a = (i / p.count!) * Math.PI * 2 + b.rng.float(0, 1);
        spawnEnemy(b, atk.enemyId, { x: boss.pos.x + Math.cos(a) * p.ring!, y: boss.pos.y + Math.sin(a) * p.ring! }, false, true);
      }
    },
  },
  canUse: {
    leap: (b, boss, p) => {
      const d = dist(b.hero.pos, boss.pos);
      return d >= p.minRange! && d <= p.maxRange!;
    },
    tongue: (b, boss, p) => {
      const d = dist(b.hero.pos, boss.pos);
      return d >= p.minRange! && d <= p.length!;
    },
  },
});
