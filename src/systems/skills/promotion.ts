// Signature skills of the six promotion branches (slot R): Rage, Holy Shield,
// Meteor, Blizzard, Aimed Shot, Call of the Pack.

import { ALLY_WOLF } from '../../data/promotions';
import { spawnProjectile } from '../ai';
import { spawnAlly } from '../allies';
import { addStatus, healHero, heroDamage } from '../combat';
import { addBuff, addZone, blast } from '../effects';
import type { Blast } from '../entities';
import { igniteFor } from '../promotion';
import { nearestEnemy } from '../targeting';
import { aimAngle, areaPoint, clampToArenaPoint, skillAim, skillAmount } from './common';
import type { SkillImpl } from './types';

/** Berserker: a short frenzy — attack speed and lifesteal. */
const rage: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  addBuff(hero, {
    id: def.id,
    time: p.duration!,
    attackSpeedMult: 1 + p.attackSpeed!,
    damageTakenMult: 1 - p.guard!,
    lifesteal: p.lifesteal!,
    ccImmune: p.ccImmune! > 0,
  });
  if (p.ccImmune! > 0) {
    delete hero.statuses.slow;
    delete hero.statuses.root;
    delete hero.statuses.stun;
  }
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

/** Paladin: invulnerability and a heal; rank 3 bursts with light, rank 5 leaves a barrier. */
const holyShield: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  hero.invulnerable = Math.max(hero.invulnerable, p.duration!);
  healHero(b, hero.maxHp * p.heal!, 'show');
  if (p.burst! > 0) blast(b, hero.pos, { kind: 'holyBurst', radius: p.burstRadius!, damage: skillAmount(hero, p.burstDamage!), knockback: 320 });
  // The barrier only starts to matter once the invulnerability is over.
  if (p.afterShield! > 0) addBuff(hero, { id: 'holyAfter', time: p.duration! + p.afterShieldTime!, attackSpeedMult: 1, damageTakenMult: 1, shield: hero.maxHp * p.afterShield! });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

/** Pyromancer: a meteor falls on the point after a visible delay. */
const meteor: SkillImpl = ({ b, hero, p, def, rank, aim }) => {
  const point = areaPoint(b, hero, aim, p.range!, p.radius!);
  if (!point) return false;
  const drop = (at: { x: number; y: number }, radius: number, mult: number, delay: number): void => {
    const finale: Blast = {
      kind: 'meteorBlast',
      radius,
      damage: skillAmount(hero, p.damage! * mult),
      knockback: 220,
      ...igniteFor(hero, def.id),
      zone: p.ground! > 0 ? { kind: 'burnGround', radius: radius * 0.8, duration: p.groundTime!, tickInterval: 0.5, damage: skillAmount(hero, p.groundDamage!) } : undefined,
    };
    addZone(b, { kind: 'meteor', pos: at, radius, duration: delay, tickInterval: delay * 10, damage: 0, finale });
  };
  drop(point, p.radius!, 1, p.delay!);
  for (let i = 0; i < p.extra!; i++) {
    const a = (i / Math.max(1, p.extra!)) * Math.PI * 2 + 0.6;
    const at = clampToArenaPoint({ x: point.x + Math.cos(a) * p.radius! * 0.9, y: point.y + Math.sin(a) * p.radius! * 0.9 }, 0);
    drop(at, p.radius! * 0.6, 0.5, p.delay! + 0.3 * (i + 1));
  }
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: point });
  return true;
};

/** Cryomancer: a slowing storm that follows the hero; rank 5 freezes at random. */
const blizzard: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos, p.castRange!)) return false;
  addZone(b, {
    kind: def.id,
    pos: hero.pos,
    followHero: true,
    radius: p.radius!,
    duration: p.duration!,
    tickInterval: p.tick!,
    damage: skillAmount(hero, p.damage!),
    slow: p.slow!,
    slowTime: p.tick! + 0.2,
    freezeChance: p.freezeChance!,
    freezeTime: 1,
    tickNow: true,
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

/** Sniper: the hero stands still aiming, then fires through the whole arena towards the cursor. */
const aimedShot: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  addStatus(hero, 'root', p.aim!);
  b.charges.push({
    element: b.castElement,
    kind: def.id,
    time: 0,
    delay: p.aim!,
    onFire: () => {
      if (hero.dead) return;
      // The direction is taken when the shot leaves: the cursor at that moment.
      const angle = aimAngle(b, hero, skillAim(b));
      if (angle === null) return;
      hero.facing = angle;
      const shots = 1 + p.extra!;
      const step = (p.spreadDeg! * Math.PI) / 180;
      for (let i = 0; i < shots; i++) {
        const a = angle + (i - (shots - 1) / 2) * step;
        const roll = heroDamage(b, p.damage!, 'skill');
        spawnProjectile(b, {
          pos: { ...hero.pos },
          vel: { x: Math.cos(a) * p.speed!, y: Math.sin(a) * p.speed! },
          radius: 9,
          damage: roll.amount,
          team: 'hero',
          life: p.range! / p.speed!,
          pierce: 999,
          ricochet: 0,
          kind: roll.crit ? 'aimedShotCrit' : 'aimedShot',
          melee: false,
          source: 'skill',
          onHit: p.vuln! > 0 ? { id: 'vuln', time: p.vulnTime!, value: p.vuln! } : undefined,
        });
      }
      b.events.emit({ type: 'skillTick', skillId: def.id, pos: { ...hero.pos }, radius: 30 });
    },
  });
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

/** Beastmaster: a pack of wolves for a few seconds. */
const callOfPack: SkillImpl = ({ b, hero, p, def, rank }) => {
  if (!nearestEnemy(b.enemies, hero.pos)) return false;
  for (let i = 0; i < p.count!; i++) {
    const a = (i / p.count!) * Math.PI * 2;
    spawnAlly(b, {
      pos: clampToArenaPoint({ x: hero.pos.x + Math.cos(a) * 36, y: hero.pos.y + Math.sin(a) * 36 }, ALLY_WOLF.radius),
      hp: hero.maxHp * ALLY_WOLF.packHpFrac,
      damageMult: p.wolfDamage!,
      life: p.duration!,
      stunOnHit: p.stun!,
      companion: false,
    });
  }
  b.events.emit({ type: 'skillCast', skillId: def.id, rank, pos: { ...hero.pos }, target: null });
  return true;
};

export const PROMOTION_SKILLS: Record<string, SkillImpl> = {
  rage,
  holyShield,
  meteor,
  blizzard,
  aimedShot,
  callOfPack,
};
