// What lies on the Forest map (ROADMAP 20.9): herbs that heal and grow back, shrines that give a
// short buff to whoever stands by them, altars that sell one more card for gold (E nearby), and
// chests from elites and tasks — a chest gives an evolution if one is ready, else a skill's next
// rank, else a passive's. An explosive elite's last blast is here too.

import { REWORK_CARDS, REWORK_PICKUPS, type ReworkCardId, type ShrineKind } from '../../data/rework';
import { EVOLUTIONS, REWORK_SKILLS } from '../../data/reworkSkills';
import type { Vec } from '../entities';
import { damageHero } from './combat';
import { heroStats } from './hero';
import { isFree } from './map';
import { makeOffer } from './progress';
import { evolutionReady } from './skills';
import type { Run } from './types';

const P = REWORK_PICKUPS;

/** A free spot on the field at least `away` from the hero and `apart` from each of `others`. */
function freeSpot(run: Run, away: number, radius = 20, others: Vec[] = [], apart = 0): Vec | null {
  for (let tries = 0; tries < 80; tries++) {
    const p = { x: 80 + run.rng.next() * (run.width - 160), y: 80 + run.rng.next() * (run.height - 160) };
    if (Math.hypot(p.x - run.hero.pos.x, p.y - run.hero.pos.y) < away) continue;
    if (others.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < apart)) continue;
    if (isFree(run.grid, p, radius)) return p;
  }
  return null;
}

/** Herbs, shrines and altars at the start of a run. */
export function placePickups(run: Run): void {
  for (let i = 0; i < P.herbs; i++) {
    const p = freeSpot(run, 150);
    if (p) run.herbs.push({ pos: p });
  }
  const kinds = Object.keys(P.shrineKinds) as ShrineKind[];
  // Shrines and altars spread over the field, not side by side.
  const taken = (): Vec[] => [...run.shrines.map((s) => s.pos), ...run.altars.map((a) => a.pos)];
  for (let i = 0; i < P.shrines; i++) {
    const p = freeSpot(run, 400, 40, taken(), P.shrineApart);
    if (p) run.shrines.push({ kind: kinds[i % kinds.length]!, pos: p, charge: 0, rest: 0 });
  }
  for (let i = 0; i < P.altars; i++) {
    const p = freeSpot(run, 500, 40, taken(), P.shrineApart * 0.6);
    if (p) run.altars.push({ pos: p });
  }
}

export function altarPrice(run: Run): number {
  return P.altarPrice + P.altarStep * run.altarUses;
}

/** The altar the hero stands by, if any. */
export function altarNear(run: Run): Run['altars'][number] | null {
  const h = run.hero.pos;
  return run.altars.find((a) => Math.hypot(a.pos.x - h.x, a.pos.y - h.y) < P.altarRadius) ?? null;
}

/** E by an altar: pay and choose one more card. */
export function useAltar(run: Run): boolean {
  if (!altarNear(run) || run.offer || run.hero.dead || run.phase === 'ring' || run.phase === 'won') return false;
  const price = altarPrice(run);
  if (run.gold < price) {
    run.events.push({ type: 'note', pos: { x: run.hero.pos.x, y: run.hero.pos.y - 80 }, text: `Потрібно ${price} золота`, color: '#ff8a7a' });
    return false;
  }
  run.gold -= price;
  run.altarUses += 1;
  run.pendingLevels += 1;
  run.offer = makeOffer(run);
  if (run.offer.length === 0) {
    run.offer = null;
    run.pendingLevels -= 1;
  }
  return true;
}

/** Opens a chest: an evolution if one is ready, else a skill's next rank, else a passive's, else gold. */
export function openChest(run: Run, at: Vec): string {
  const ready = run.skills.find((s) => evolutionReady(run, s));
  let text: string;
  if (ready) {
    ready.evolved = true;
    run.events.push({ type: 'evolve', skill: ready.id });
    text = `Еволюція: ${EVOLUTIONS[ready.id]!.name}!`;
  } else {
    const ranks = run.skills.filter((s) => s.rank < REWORK_SKILLS[s.id].ranks.length + 1);
    const passives = (Object.keys(run.cards) as ReworkCardId[]).filter((id) => (run.cards[id] ?? 0) < REWORK_CARDS[id].ranks);
    if (ranks.length > 0) {
      const s = ranks[Math.floor(run.rng.next() * ranks.length)]!;
      s.rank += 1;
      text = `${REWORK_SKILLS[s.id].name}: ранг ${s.rank}`;
    } else if (passives.length > 0) {
      const id = passives[Math.floor(run.rng.next() * passives.length)]!;
      run.cards[id] = (run.cards[id] ?? 0) + 1;
      run.hero.maxHp = heroStats(run).maxHp;
      text = `${REWORK_CARDS[id].name}: ранг ${run.cards[id]}`;
    } else {
      run.gold += 25;
      text = '+25 золота';
    }
  }
  run.events.push({ type: 'note', pos: { x: at.x, y: at.y - 50 }, text: `Скриня — ${text}`, color: '#ffd27a' });
  return text;
}

export function stepPickupsOnMap(run: Run, dt: number): void {
  const h = run.hero;
  if (h.dead) return;
  const near = (p: Vec, r: number): boolean => Math.hypot(p.x - h.pos.x, p.y - h.pos.y) < r + h.radius;
  // Chests open on touch.
  run.chests = run.chests.filter((c) => {
    if (!near(c.pos, P.chestRadius)) return true;
    openChest(run, c.pos);
    return false;
  });
  // Herbs heal over a few seconds; new ones grow.
  run.herbs = run.herbs.filter((g) => {
    if (!near(g.pos, 14)) return true;
    h.regen = { perSec: (h.maxHp * P.herbHeal) / P.herbTime, time: P.herbTime };
    run.events.push({ type: 'note', pos: { x: g.pos.x, y: g.pos.y - 40 }, text: 'Трава: лікування', color: '#8fe08a' });
    return false;
  });
  run.herbTimer -= dt;
  if (run.herbTimer <= 0) {
    run.herbTimer = P.herbRegrow;
    if (run.herbs.length < P.herbs) {
      const p = freeSpot(run, 300);
      if (p) run.herbs.push({ pos: p });
    }
  }
  // Shrines charge while the hero stands by them.
  for (const s of run.shrines) {
    s.rest = Math.max(0, s.rest - dt);
    if (s.rest > 0) continue;
    if (!near(s.pos, P.shrineRadius)) {
      s.charge = Math.max(0, s.charge - dt);
      continue;
    }
    s.charge += dt;
    if (s.charge < P.shrineCharge) continue;
    s.charge = 0;
    s.rest = P.shrineRest;
    h.shrine = { kind: s.kind, time: P.shrineBuff };
    if (s.kind === 'shield') h.shield = P.shieldHp;
    const k = P.shrineKinds[s.kind];
    run.events.push({ type: 'note', pos: { x: s.pos.x, y: s.pos.y - 60 }, text: `${k.name}: ${k.text}`, color: k.color });
  }
  // An explosive elite blows up a moment after it died.
  for (const b of run.blasts) {
    b.time -= dt;
    if (b.time > 0) continue;
    if (Math.hypot(h.pos.x - b.pos.x, h.pos.y - b.pos.y) < b.radius + h.radius) damageHero(run, b.damage);
    run.events.push({ type: 'blast', pos: b.pos, radius: b.radius, color: '#ff7a3a' });
  }
  run.blasts = run.blasts.filter((b) => b.time > 0);
}
