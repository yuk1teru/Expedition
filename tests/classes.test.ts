import { describe, expect, it } from 'vitest';
import { CLASSES, CLASS_ORDER } from '../src/data/classes';
import { PASSIVES, SKILLS } from '../src/data/skills';
import { type Battle, createBattle, stepBattle } from '../src/systems/battle';
import { damageHero, killEnemy } from '../src/systems/combat';
import { type Enemy, dist } from '../src/systems/entities';
import { assignClass, healFull, heroShield, recomputeHeroStats } from '../src/systems/hero';
import { createGameState, teleport } from '../src/systems/run';
import { SKILL_IMPLS, useSkill } from '../src/systems/skills';
import { spawnEnemy } from '../src/systems/waves';

function battle(classId: string, skills: string[]): Battle {
  const s = createGameState(5);
  s.hero.immortal = true;
  s.hero.level = 3;
  assignClass(s.hero, classId, skills);
  teleport(s, 'quietGrove');
  const b = createBattle(s, 'quietGrove');
  b.waves = null;
  b.input.control = 'player';
  return b;
}

function tough(b: Battle, defId: string, dx: number, dy = 0): Enemy {
  const e = spawnEnemy(b, defId, { x: b.hero.pos.x + dx, y: b.hero.pos.y + dy });
  e.hp = e.maxHp = 1e6;
  e.speed = 0;
  e.damage = 0;
  return e;
}

function run(b: Battle, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) stepBattle(b, 1 / 60);
}

describe('classes', () => {
  it('all three classes are playable: 8 skills with implementations, 3 passives, 3 default picks', () => {
    for (const id of CLASS_ORDER) {
      const c = CLASSES[id]!;
      expect(c.locked).toBe(false);
      expect(c.skills).toHaveLength(8);
      expect(c.passives).toHaveLength(3);
      for (const s of c.skills) {
        expect(SKILLS[s]?.classId).toBe(id);
        expect(SKILL_IMPLS[s]).toBeTypeOf('function');
      }
      for (const p of c.passives) expect(PASSIVES[p]?.classId).toBe(id);
      expect(c.defaultPicks.every((s) => c.skills.includes(s))).toBe(true);
    }
  });

  it('Mage: stronger skills; Archer: faster attacks; both shoot', () => {
    const w = battle('warrior', CLASSES.warrior!.defaultPicks).hero;
    const m = battle('mage', CLASSES.mage!.defaultPicks).hero;
    const a = battle('archer', CLASSES.archer!.defaultPicks).hero;
    expect(m.stats.skillDamageMult).toBeGreaterThan(1);
    expect(a.stats.attackSpeed).toBeGreaterThan(w.stats.attackSpeed);
    expect(m.stats.ranged && a.stats.ranged).toBe(true);
  });
});

describe('ranged basic attacks', () => {
  it('Mage bolt: full damage to the target, splash to its neighbours', () => {
    const b = battle('mage', CLASSES.mage!.defaultPicks);
    const target = tough(b, 'stump', 150);
    const near = tough(b, 'stump', 175, 20);
    b.input.aim = { ...target.pos };
    run(b, 0.6);
    const hitTarget = target.maxHp - target.hp;
    const hitNear = near.maxHp - near.hp;
    expect(hitTarget).toBeGreaterThan(0);
    expect(hitNear).toBeGreaterThan(0);
    expect(hitNear).toBeLessThan(hitTarget);
  });

  it('Archer arrow pierces the first enemy; the one behind takes less', () => {
    const b = battle('archer', CLASSES.archer!.defaultPicks);
    b.hero.stats.critChance = 0;
    const first = tough(b, 'wolf', 120);
    const second = tough(b, 'wolf', 170);
    b.input.aim = { ...first.pos };
    run(b, 0.45);
    const a = first.maxHp - first.hp;
    const c = second.maxHp - second.hp;
    expect(a).toBeGreaterThan(0);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(a);
  });

  it('Piercing passive: arrows pass through one more enemy', () => {
    const b = battle('archer', CLASSES.archer!.defaultPicks);
    b.hero.passives.piercing = 1;
    recomputeHeroStats(b.hero);
    expect(b.hero.stats.pierce).toBe(1);
  });
});

describe('Mage skills', () => {
  it('Fireball bursts at the cursor and hits everyone in the radius', () => {
    const b = battle('mage', ['fireball', 'frostRing', 'chainLightning']);
    const a = tough(b, 'wolf', 200);
    const c = tough(b, 'wolf', 230, 30);
    b.input.aim = { ...a.pos };
    expect(useSkill(b, 0)).toBe('cast');
    run(b, 0.6);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(c.hp).toBeLessThan(c.maxHp);
  });

  it('Frost Ring freezes the enemies around the hero', () => {
    const b = battle('mage', ['frostRing', 'fireball', 'chainLightning']);
    const e = tough(b, 'wolf', 80);
    expect(useSkill(b, 0)).toBe('cast');
    expect(e.statuses.freeze?.time ?? 0).toBeGreaterThan(1);
  });

  it('Chain Lightning jumps between up to `jumps` enemies', () => {
    const b = battle('mage', ['chainLightning', 'fireball', 'frostRing']);
    const enemies = [0, 1, 2, 3, 4, 5].map((i) => tough(b, 'wolf', 120 + i * 60));
    b.input.aim = { ...enemies[0]!.pos };
    useSkill(b, 0);
    expect(enemies.filter((e) => e.hp < e.maxHp)).toHaveLength(4);
  });

  it('Teleport moves the hero to the cursor, within its range, and protects for a moment', () => {
    const b = battle('mage', ['teleport', 'fireball', 'frostRing']);
    tough(b, 'wolf', 60);
    const start = { ...b.hero.pos };
    b.input.aim = { x: start.x - 500, y: start.y };
    expect(useSkill(b, 0)).toBe('cast');
    expect(dist(b.hero.pos, start)).toBeCloseTo(200, 0);
    expect(b.hero.invulnerable).toBeGreaterThan(0);
  });

  it('Ice Barrier absorbs damage before HP', () => {
    const b = battle('mage', ['iceBarrier', 'fireball', 'frostRing']);
    b.hero.immortal = false;
    tough(b, 'wolf', 60);
    useSkill(b, 0);
    const shield = heroShield(b.hero);
    expect(shield).toBeCloseTo(b.hero.maxHp * 0.25);
    const hp = b.hero.hp;
    damageHero(b, 5, { melee: false });
    expect(b.hero.hp).toBe(hp);
    expect(heroShield(b.hero)).toBeLessThan(shield);
  });

  it('Flame Wall burns enemies along a line across the aim', () => {
    const b = battle('mage', ['flameWall', 'fireball', 'frostRing']);
    const mid = tough(b, 'wolf', 200);
    const side = tough(b, 'wolf', 200, 60);
    const off = tough(b, 'wolf', 300);
    b.input.aim = { ...mid.pos };
    useSkill(b, 0);
    run(b, 0.1);
    expect(mid.hp).toBeLessThan(mid.maxHp);
    expect(side.hp).toBeLessThan(side.maxHp);
    expect(off.hp).toBe(off.maxHp);
  });

  it('Vortex pulls enemies to its centre', () => {
    const b = battle('mage', ['vortex', 'fireball', 'frostRing']);
    const e = tough(b, 'wolf', 280);
    e.hp = e.maxHp = 1e6;
    const centre = { x: b.hero.pos.x + 200, y: b.hero.pos.y };
    b.input.aim = centre;
    useSkill(b, 0);
    const before = dist(e.pos, centre);
    run(b, 1);
    expect(dist(e.pos, centre)).toBeLessThan(before);
  });

  it('Magic Missiles home in on their targets', () => {
    const b = battle('mage', ['magicMissiles', 'fireball', 'frostRing']);
    const e = tough(b, 'wolf', 250, 80);
    b.input.aim = { ...e.pos };
    useSkill(b, 0);
    run(b, 1);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});

describe('Archer skills', () => {
  it('Multishot fires a fan of `count` arrows', () => {
    const b = battle('archer', ['multishot', 'arrowRain', 'piercingShot']);
    tough(b, 'wolf', 200);
    b.input.aim = { x: b.hero.pos.x + 200, y: b.hero.pos.y };
    useSkill(b, 0);
    expect(b.projectiles.filter((p) => p.kind.startsWith('arrow'))).toHaveLength(5);
  });

  it('Trap fires when an enemy steps on it; no more than `max` at once', () => {
    const b = battle('archer', ['hunterTrap', 'multishot', 'arrowRain']);
    const far = tough(b, 'wolf', 400);
    for (let i = 0; i < 4; i++) {
      b.input.aim = { x: b.hero.pos.x, y: b.hero.pos.y - 40 - i * 20 };
      b.hero.skills[0]!.cooldown = 0;
      useSkill(b, 0);
    }
    expect(b.zones.filter((z) => !z.dead && z.kind === 'hunterTrap')).toHaveLength(3);
    const trap = b.zones.find((z) => !z.dead && z.kind === 'hunterTrap')!;
    far.pos = { ...trap.pos };
    run(b, 0.05);
    expect(far.hp).toBeLessThan(far.maxHp);
  });

  it('Vault leaps away from the cursor and shoots towards it', () => {
    const b = battle('archer', ['vault', 'multishot', 'arrowRain']);
    const e = tough(b, 'wolf', 120);
    const start = { ...b.hero.pos };
    b.input.aim = { ...e.pos };
    expect(useSkill(b, 0)).toBe('cast');
    run(b, 0.6);
    expect(b.hero.pos.x).toBeLessThan(start.x - 100);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('Piercing Shot passes through every enemy on the line', () => {
    const b = battle('archer', ['piercingShot', 'multishot', 'arrowRain']);
    const line = [0, 1, 2, 3].map((i) => tough(b, 'wolf', 100 + i * 60));
    b.input.aim = { ...line[3]!.pos };
    useSkill(b, 0);
    run(b, 0.6);
    expect(line.every((e) => e.hp < e.maxHp)).toBe(true);
  });

  it('Hunter’s Mark makes the target take more damage; Net binds; Barrage speeds up attacks', () => {
    const b = battle('archer', ['hunterMark', 'net', 'barrage']);
    const e = tough(b, 'wolf', 200);
    b.input.aim = { ...e.pos };
    useSkill(b, 0);
    expect(e.statuses.vuln?.value).toBeCloseTo(0.3);
    useSkill(b, 1);
    run(b, 0.4);
    expect(e.statuses.stun?.time ?? 0).toBeGreaterThan(1);
    const speed = b.hero.stats.attackSpeed;
    useSkill(b, 2);
    expect(b.hero.buffs.find((x) => x.id === 'barrage')?.attackSpeedMult).toBeCloseTo(1 + 1.5);
    expect(speed).toBeGreaterThan(0);
  });

  it('Arrow Rain hits everyone under it for its duration', () => {
    const b = battle('archer', ['arrowRain', 'multishot', 'net']);
    const e = tough(b, 'stump', 200);
    b.input.aim = { ...e.pos };
    useSkill(b, 0);
    run(b, 1);
    const after1 = e.maxHp - e.hp;
    run(b, 1);
    expect(e.maxHp - e.hp).toBeGreaterThan(after1);
  });
});

describe('bot targeting without a cursor', () => {
  it('every Mage and Archer skill finds a target on its own (simulation bot)', () => {
    for (const classId of ['mage', 'archer']) {
      for (const skill of CLASSES[classId]!.skills) {
        const others = CLASSES[classId]!.skills.filter((s) => s !== skill).slice(0, 2);
        const b = battle(classId, [skill, ...others]);
        b.input.control = 'bot';
        b.input.aim = null;
        tough(b, 'wolf', 120);
        tough(b, 'wolf', 140, 30);
        expect(useSkill(b, 0), skill).toBe('cast');
      }
    }
  });
});

describe('class traits', () => {
  it('Warrior regenerates even while being hit', () => {
    const b = battle('warrior', CLASSES.warrior!.defaultPicks);
    b.hero.hp = 50;
    b.hero.stats.hpRegen = 0;
    b.hero.hitAt = b.time;
    run(b, 1);
    expect(b.hero.hp).toBeCloseTo(50 + b.hero.maxHp * CLASSES.warrior!.traits.combatRegenPct!, 0);
  });

  it('Archer is quicker and sometimes dodges melee hits (never projectiles)', () => {
    const w = battle('warrior', CLASSES.warrior!.defaultPicks).hero;
    const a = battle('archer', CLASSES.archer!.defaultPicks);
    expect(a.hero.stats.moveSpeed).toBeGreaterThan(w.stats.moveSpeed);
    a.hero.immortal = false;
    let dodged = 0;
    for (let i = 0; i < 200; i++) if (damageHero(a, 0.01, { melee: true }) === 0) dodged++;
    expect(dodged / 200).toBeGreaterThan(0.35);
    expect(dodged / 200).toBeLessThan(0.65);
    let missed = 0;
    for (let i = 0; i < 50; i++) if (damageHero(a, 0.01, { melee: false }) === 0) missed++;
    expect(missed).toBe(0);
  });

  it('Mage: mana takes hits before HP, kills and mana orbs refill it, town fills it up', () => {
    const b = battle('mage', CLASSES.mage!.defaultPicks);
    const hero = b.hero;
    hero.immortal = false;
    const m = CLASSES.mage!.traits.mana!;
    expect(hero.mana).toBe(hero.stats.manaMax);
    const hp = hero.hp;
    damageHero(b, 20, { melee: false });
    expect(hero.hp).toBe(hp);
    expect(hero.stats.manaMax - hero.mana).toBeGreaterThan(0);
    hero.mana = 0;
    killEnemy(b, spawnEnemy(b, 'wolf', { x: 100, y: 100 }));
    expect(hero.mana).toBe(m.perKill);
    b.manaOrbs.push({ id: 999, pos: { ...hero.pos }, amount: m.orbMana, time: 0, life: 5 });
    run(b, 0.05);
    expect(hero.mana).toBe(m.perKill + m.orbMana);
    healFull(hero);
    expect(hero.mana).toBe(hero.stats.manaMax);
  });
});
