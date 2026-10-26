// Event-wave weather: a hero debuff for the duration of the wave; the storm also
// throws telegraphed lightning under the hero.

import { WEATHER, type WeatherId } from '../data/weather';
import type { Battle } from './battle';
import { addTelegraph } from './boss';
import { tierMultiplier } from './scaling';

export interface WeatherState {
  id: WeatherId;
  /** Seconds to the next lightning strike (storm). */
  lightningTimer: number;
}

const BUFF_ID = 'weather';

export function startWeather(b: Battle, id: WeatherId): void {
  const def = WEATHER[id];
  b.weather = { id, lightningTimer: def.lightning?.interval ?? 0 };
  b.hero.buffs = b.hero.buffs.filter((x) => x.id !== BUFF_ID);
  if (def.moveSpeedMult !== 1 || def.attackSpeedMult !== 1) {
    // Lasts until the wave is cleared (endWeather removes it).
    b.hero.buffs.push({ id: BUFF_ID, time: Infinity, attackSpeedMult: def.attackSpeedMult, damageTakenMult: 1, moveSpeedMult: def.moveSpeedMult });
  }
}

export function endWeather(b: Battle): void {
  if (!b.weather) return;
  b.weather = null;
  b.hero.buffs = b.hero.buffs.filter((x) => x.id !== BUFF_ID);
  b.events.emit({ type: 'weatherEnd' });
}

export function updateWeather(b: Battle, dt: number): void {
  const w = b.weather;
  if (!w || b.hero.dead) return;
  const l = WEATHER[w.id].lightning;
  if (!l) return;
  w.lightningTimer -= dt;
  if (w.lightningTimer > 0) return;
  w.lightningTimer = l.interval;
  const damage = l.damage * tierMultiplier(b.tier) * (b.waves?.mult.damage ?? 1);
  addTelegraph(b, 'lightning', b.hero.pos, l.radius, damage, l.delay);
}
