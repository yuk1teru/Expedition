import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { PROGRESSION, RANKS } from '../src/data/balance';
import { CLASSES } from '../src/data/classes';
import { PROMOTIONS, classPromotions } from '../src/data/promotions';
import { PASSIVES, SKILLS, rankChanges, skillParams } from '../src/data/skills';
import { type Battle, createBattle, stepBattle } from '../src/systems/battle';
import { offerCards } from '../src/systems/cards';
import { damageHero, killEnemy } from '../src/systems/combat';
import { type Enemy } from '../src/systems/entities';
import { assignClass, heroAttack, heroShield, moveSkill, skillInSlot } from '../src/systems/hero';
import { gainXp, isMaxLevel } from '../src/systems/leveling';
import { promote } from '../src/systems/promotion';
import { createGameState, teleport } from '../src/systems/run';
import { xpToNext } from '../src/systems/scaling';
import { SKILL_IMPLS, useSkill } from '../src/systems/skills';
import { spawnEnemy } from '../src/systems/waves';

function promoted(branch: string): Battle {
  const p = PROMOTIONS[branch]!;
  const s = createGameState(9);
  s.hero.immortal = true;
  s.hero.level = PROGRESSION.promotionLevel;
  assignClass(s.hero, p.classId, CLASSES[p.classId]!.defaultPicks);
  promote(s.hero, branch);
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

const R = PROGRESSION.signatureSlot;

describe('promotion data', () => {
  it('two branches per class; each has a signature skill with ranks and two passives of its class', () => {
    for (const classId of Object.keys(CLASSES)) {
      const branches = classPromotions(classId);
      expect(branches).toHaveLength(2);
      for (const p of branches) {
        const sig = SKILLS[p.signature]!;
        expect(sig.classId).toBe(classId);
        expect(sig.branch).toBe(p.id);
        expect(sig.ranks).toHaveLength(RANKS.max);
        for (let r = 2; r <= RANKS.max; r++) expect(rankChanges(sig.id, r).length).toBeGreaterThan(0);
        expect(SKILL_IMPLS[sig.id]).toBeTypeOf('function');
        expect(p.passives).toHaveLength(2);
        for (const id of p.passives) expect(PASSIVES[id]?.classId).toBe(classId);
      }
    }
  });
});

describe('promotion flow', () => {
  it('the promotion level asks for the promotion instead of a card; the cap is the max level', () => {
    const s = createGameState(2);
    const P = PROGRESSION.promotionLevel;
    assignClass(s.hero, 'warrior', CLASSES.warrior!.defaultPicks);
    s.hero.level = P - 1;
    s.modalQueue = [];
    gainXp(s, xpToNext(P - 1));
    expect(s.modalQueue).toEqual([{ kind: 'promotion' }]);
    s.modalQueue = [];
    // Further levels give talent points, not cards.
    gainXp(s, xpToNext(P));
    expect(s.modalQueue).toEqual([]);
    for (let i = 0; i < 20; i++) gainXp(s, 1e6);
    expect(s.hero.level).toBe(PROGRESSION.maxLevel);
    expect(PROGRESSION.maxLevel).toBe(30);
    expect(isMaxLevel(s.hero.level)).toBe(true);
  });

  it('the signature skill takes the R slot, can not be dragged; a branch only of the own class, once', () => {
    const s = createGameState(4);
    assignClass(s.hero, 'mage', CLASSES.mage!.defaultPicks);
    expect(() => promote(s.hero, 'berserker')).toThrow();
    promote(s.hero, 'pyromancer');
    expect(skillInSlot(s.hero, R)?.id).toBe('meteor');
    moveSkill(s.hero, R, 0);
    expect(skillInSlot(s.hero, R)?.id).toBe('meteor');
    expect(() => promote(s.hero, 'cryomancer')).toThrow();
  });

  it('after the promotion branch cards come up, about twice as often per card', () => {
    const s = createGameState(6);
    assignClass(s.hero, 'archer', CLASSES.archer!.defaultPicks);
    promote(s.hero, 'sniper');
    const rng = new Rng(3);
    let branch = 0;
    let classPassive = 0;
    for (let i = 0; i < 2000; i++) {
      for (const c of offerCards(s.hero, rng)) {
        if (c.kind === 'passive' && PROMOTIONS.sniper!.passives.includes(c.passiveId)) branch++;
        if (c.kind === 'passive' && CLASSES.archer!.passives.includes(c.passiveId)) classPassive++;
      }
    }
    // 2 branch passives (weight 2) vs 3 class passives (weight 1).
    expect(branch / 2).toBeGreaterThan((classPassive / 3) * 1.4);
  });
});

describe('branch mechanics', () => {
  it('Berserker hits harder the less HP is left', () => {
    const b = promoted('berserker');
    const full = heroAttack(b.hero);
    b.hero.hp = b.hero.maxHp * 0.3;
    expect(heroAttack(b.hero)).toBeCloseTo(full * 1.6);
  });

  it('Paladin gets a barrier every 10 s', () => {
    const b = promoted('paladin');
    tough(b, 'wolf', 300);
    run(b, 0.1);
    expect(heroShield(b.hero)).toBeCloseTo(b.hero.maxHp * 0.15);
  });

  it('Pyromancer: Fireball sets enemies on fire', () => {
    const b = promoted('pyromancer');
    const e = tough(b, 'wolf', 200);
    b.input.aim = { ...e.pos };
    useSkill(b, 0);
    run(b, 0.5);
    expect(e.statuses.burn?.time ?? 0).toBeGreaterThan(0);
  });

  it('Cryomancer: frozen enemies take +50% and shatter into shards when they die', () => {
    const b = promoted('cryomancer');
    const e = spawnEnemy(b, 'wolf', { x: b.hero.pos.x + 80, y: b.hero.pos.y });
    e.statuses.freeze = { time: 2, value: 0 };
    killEnemy(b, e);
    expect(b.projectiles.filter((p) => p.kind === 'shard').length).toBe(6);
  });

  it('Sniper: more crit and piercing arrows', () => {
    const b = promoted('sniper');
    expect(b.hero.stats.critChance).toBeGreaterThan(0.15);
    expect(b.hero.stats.pierce).toBe(2);
  });

  it('Beastmaster: the wolf joins at the start, bites, and comes back after dying', () => {
    const b = promoted('beastmaster');
    expect(b.allies.filter((a) => a.companion)).toHaveLength(1);
    const e = tough(b, 'stump', 120);
    run(b, 3);
    expect(e.hp).toBeLessThan(e.maxHp);
    b.allies[0]!.hp = 0;
    b.allies[0]!.dead = true;
    run(b, 5);
    expect(b.allies.filter((a) => a.companion)).toHaveLength(0);
    run(b, 6);
    expect(b.allies.filter((a) => a.companion)).toHaveLength(1);
  });
});

describe('signature skills', () => {
  it('every signature skill casts from the R slot', () => {
    for (const branch of Object.keys(PROMOTIONS)) {
      const b = promoted(branch);
      const e = tough(b, 'wolf', 120);
      b.input.aim = { ...e.pos };
      expect(useSkill(b, R), branch).toBe('cast');
    }
  });

  it('Rage heals through lifesteal; Holy Shield makes the hero invulnerable', () => {
    const b = promoted('berserker');
    tough(b, 'wolf', 50);
    b.hero.hp = b.hero.maxHp * 0.5;
    useSkill(b, R);
    expect(b.hero.buffs.find((x) => x.id === 'rage')?.lifesteal).toBeCloseTo(skillParams('rage', 1).lifesteal!);
    const p = promoted('paladin');
    p.hero.immortal = false;
    tough(p, 'wolf', 50);
    useSkill(p, R);
    const hp = p.hero.hp;
    damageHero(p, 50, { melee: false });
    expect(p.hero.hp).toBe(hp);
  });

  it('Meteor falls after its delay; Aimed Shot fires after aiming', () => {
    const b = promoted('pyromancer');
    // Out of the basic bolt's range, inside the Meteor's.
    const e = tough(b, 'stump', 380);
    b.input.aim = { ...e.pos };
    useSkill(b, R);
    run(b, 0.5);
    expect(e.hp).toBe(e.maxHp);
    run(b, 0.7);
    expect(e.hp).toBeLessThan(e.maxHp);

    const s = promoted('sniper');
    const t = tough(s, 'stump', 300);
    s.input.aim = { ...t.pos };
    useSkill(s, R);
    expect(s.projectiles.filter((p) => p.kind.startsWith('aimedShot'))).toHaveLength(0);
    run(s, 1.1);
    expect(t.hp).toBeLessThan(t.maxHp);
  });

  it('Call of the Pack: wolves that leave when their time is up', () => {
    const b = promoted('beastmaster');
    tough(b, 'wolf', 200);
    useSkill(b, R);
    expect(b.allies.filter((a) => !a.companion)).toHaveLength(3);
    run(b, 8.2);
    expect(b.allies.filter((a) => !a.companion)).toHaveLength(0);
  });
});
