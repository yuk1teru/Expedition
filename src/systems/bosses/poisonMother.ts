// Отруйна Мати (Swamp boss): globs along an arc leave poison puddles, slimes come to
// her call; phase 2 — a toxic wave rolls out from her (dodge it with a skill).

import { spawnProjectile } from '../ai';
import { registerBoss } from '../boss';
import { angleOf, dist } from '../entities';
import { addRing } from '../hazards';
import { spawnEnemy } from '../waves';

registerBoss('poisonMother', {
  attacks: {
    puddles(b, boss, p) {
      const base = angleOf({ x: b.hero.pos.x - boss.pos.x, y: b.hero.pos.y - boss.pos.y });
      const arc = (p.arcDeg! * Math.PI) / 180;
      const reach = Math.min(p.range!, Math.max(140, dist(boss.pos, b.hero.pos)));
      for (let k = 0; k < p.count!; k++) {
        const a = base + (p.count! === 1 ? 0 : (k / (p.count! - 1) - 0.5) * arc);
        spawnProjectile(b, {
          pos: { x: boss.pos.x + Math.cos(a) * boss.radius, y: boss.pos.y + Math.sin(a) * boss.radius },
          vel: { x: Math.cos(a) * p.speed!, y: Math.sin(a) * p.speed! },
          radius: 9,
          damage: boss.damage * p.damage!,
          team: 'enemy',
          life: reach / p.speed!,
          pierce: 0,
          ricochet: 0,
          kind: 'venom',
          melee: false,
          puddle: { kind: 'poison', radius: p.puddleRadius!, duration: p.puddleTime!, dps: boss.damage * p.puddleDps! },
        });
      }
      b.events.emit({ type: 'enemyShot', pos: { ...boss.pos } });
    },
    summon(b, boss, p, atk) {
      if (!atk.enemyId) return;
      for (let i = 0; i < p.count!; i++) {
        const a = (i / p.count!) * Math.PI * 2 + b.rng.float(0, 0.5);
        spawnEnemy(b, atk.enemyId, { x: boss.pos.x + Math.cos(a) * p.ring!, y: boss.pos.y + Math.sin(a) * p.ring! }, false, true);
      }
    },
    toxicWave(b, boss, p) {
      addRing(b, 'toxicWave', boss.pos, { speed: p.speed!, width: p.width!, damage: boss.damage * p.damage!, maxRadius: p.maxRadius! });
      b.events.emit({ type: 'bossShout', text: 'Токсична хвиля!', pos: { ...boss.pos } });
    },
  },
  canUse: {
    // Up close the globs would all hit at once: spits only at range.
    puddles: (b, boss, p) => dist(b.hero.pos, boss.pos) >= p.minRange!,
  },
});
