import { describe, expect, it } from 'vitest';
import { LOOP } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { SOULS, SOUL_RULES } from '../src/data/souls';
import { createBattle, stepBattle } from '../src/systems/battle';
import { createBossEnemy } from '../src/systems/boss';
import { debuffHero, killEnemy } from '../src/systems/combat';
import { basicElement, recomputeHeroStats } from '../src/systems/hero';
import { rollItem } from '../src/systems/items';
import { questsOffered } from '../src/systems/quests';
import { createGameState, teleport } from '../src/systems/run';
import { catchSoul, socketStone } from '../src/systems/souls';
import { spawnEnemy } from '../src/systems/waves';

function grove() {
  const s = createGameState(21);
  s.hero.immortal = true;
  teleport(s, 'quietGrove');
  const b = createBattle(s, 'quietGrove');
  b.waves = null;
  return { s, b };
}

function wear(s: ReturnType<typeof createGameState>, slot: 'weapon' | 'hat' | 'armor' | 'boots') {
  const item = rollItem(s.lootRng, 'common', s.nextItemUid++);
  item.slot = slot;
  item.identified = true;
  s.hero.equipment[slot] = item;
  recomputeHeroStats(s.hero);
  return item;
}

describe('souls and rune stones', () => {
  it('data: one soul per kind of beast, from real monsters', () => {
    const seen = new Set<string>();
    for (const soul of Object.values(SOULS)) {
      for (const m of soul.from) {
        expect(ENEMIES[m], `${soul.id}: ${m}`).toBeDefined();
        expect(seen.has(m), `${m} in two souls`).toBe(false);
        seen.add(m);
      }
    }
  });

  it('a killed beast sometimes leaves its soul; summoned ones never; an unclaimed soul fades', () => {
    const { b } = grove();
    for (let i = 0; i < 400; i++) killEnemy(b, spawnEnemy(b, 'wolf', { x: 300, y: 300 }));
    expect(b.souls.length).toBeGreaterThan(0);
    expect(b.souls.length).toBeLessThan(400 * SOUL_RULES.chance * 3);
    expect(b.souls.every((x) => x.soul === 'wolfSoul')).toBe(true);
    b.souls = [];
    for (let i = 0; i < 400; i++) killEnemy(b, spawnEnemy(b, 'wolf', { x: 300, y: 300 }, false, true));
    expect(b.souls).toHaveLength(0);
    b.souls.push({ id: 999, soul: 'wolfSoul', pos: { x: 100, y: 100 }, time: 0, dead: false });
    b.hero.pos = { x: 700, y: 300 };
    for (let t = 0; t < SOUL_RULES.life + 0.5; t += LOOP.step) stepBattle(b, LOOP.step);
    expect(b.souls).toHaveLength(0);
  });

  it('touching a soul: without a stone it goes (but the wanderer’s tale opens); with one the game asks', () => {
    const { s, b } = grove();
    expect(questsOffered(s, 'tavernWanderer').map((q) => q.id)).not.toContain('systemSouls');
    b.souls.push({ id: 1, soul: 'woodSoul', pos: { ...b.hero.pos }, time: 0, dead: false });
    stepBattle(b, LOOP.step);
    expect(s.soulSeen).toBe(true);
    expect(s.modalQueue.some((m) => m.kind === 'soulCatch')).toBe(false);
    expect(questsOffered(s, 'tavernWanderer').map((q) => q.id)).toContain('systemSouls');
    s.runeStones = 1;
    b.souls.push({ id: 2, soul: 'woodSoul', pos: { ...b.hero.pos }, time: 0, dead: false });
    stepBattle(b, LOOP.step);
    expect(s.modalQueue).toContainEqual({ kind: 'soulCatch', soul: 'woodSoul' });
    expect(catchSoul(s, 'woodSoul')).toBe(true);
    expect(s.runeStones).toBe(0);
    expect(s.hero.soulStones).toEqual(['woodSoul']);
    expect(catchSoul(s, 'woodSoul')).toBe(false);
  });

  it('a stone in an item gives its property, in a weapon — the element; one per item', () => {
    const s = createGameState(5);
    wear(s, 'armor');
    wear(s, 'weapon');
    s.hero.soulStones = ['woodSoul', 'woodSoul', 'sandSoul'];
    const armor = s.hero.stats.armor;
    expect(socketStone(s.hero, 0, 'armor')).toBe(true);
    expect(s.hero.stats.armor).toBeCloseTo(armor + (SOULS.woodSoul!.effect.kind === 'stat' ? SOULS.woodSoul!.effect.value : 0));
    expect(socketStone(s.hero, 0, 'armor')).toBe(false);
    expect(basicElement(s.hero)).toBe('neutral');
    expect(socketStone(s.hero, 1, 'weapon')).toBe(true);
    expect(basicElement(s.hero)).toBe(SOULS.sandSoul!.element);
    expect(s.hero.soulStones).toEqual(['woodSoul']);
    expect(socketStone(s.hero, 0, 'hat')).toBe(false);
  });

  it('a resisting stone shortens slows', () => {
    const { s, b } = grove();
    s.hero.immortal = false;
    debuffHero(b, 'slow', 4, 0.3);
    const plain = s.hero.statuses.slow!.time;
    s.hero.statuses = {};
    wear(s, 'boots');
    s.hero.soulStones = ['bogSoul'];
    socketStone(s.hero, 0, 'boots');
    debuffHero(b, 'slow', 4, 0.3);
    expect(s.hero.statuses.slow!.time).toBeLessThan(plain);
  });

  it('minibosses drop empty stones now and then', () => {
    const { s, b } = grove();
    for (let i = 0; i < 60; i++) killEnemy(b, createBossEnemy(b, 'alpha', { x: 300, y: 300 }));
    expect(s.runeStones).toBeGreaterThan(0);
  });
});
