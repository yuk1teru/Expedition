// Gifts (ROADMAP 12.8, VISION 7a): permanent bonuses the hero gets by chance — a window of 3,
// one is taken for good. Common ones are small bonuses, rare ones change a skill, legendary
// ones (bosses) are big; cursed ones are strong with a minus. Sources: every 5th level,
// bosses, the first win over a location's miniboss, quests (altars — stage 13). Editable
// in the wiki.

import type { Element } from './elements';

export type GiftRarity = 'common' | 'rare' | 'legendary';

/** Skill tags: what a gift may strengthen. */
export type SkillTag = 'area' | 'single' | 'move' | 'control' | 'fire' | 'ice';

export type GiftStat = 'attackSpeedPct' | 'hpPct' | 'critChance' | 'armor' | 'lifesteal' | 'moveSpeedPct' | 'cooldownPct' | 'skillDamagePct';

export type GiftEffect =
  /** A stat bonus (negative — a curse). */
  | { kind: 'stat'; stat: GiftStat; value: number }
  /** +value damage of skills with the tag. */
  | { kind: 'tag'; tag: SkillTag; value: number }
  /** +value damage of an element (any source of the hero). */
  | { kind: 'element'; element: Element | 'any'; value: number }
  /** +value damage to enemies with this status. */
  | { kind: 'status'; status: 'stun' | 'freeze' | 'burn' | 'slow'; value: number }
  /** A skill parameter at least this value from rank 1 on (a rank's modifier comes early). */
  | { kind: 'skill'; skill: string; param: string; value: number };

export interface GiftDef {
  id: string;
  name: string;
  rarity: GiftRarity;
  /** Strong, with a minus. */
  cursed?: boolean;
  text: string;
  effects: GiftEffect[];
}

export const GIFT_RULES = {
  /** Gifts in a window. */
  offerSize: 3,
  /** A gift every this many levels. */
  levelEvery: 5,
  /** …rare instead of common with this chance. */
  levelRareChance: 0.3,
  /** The first win over a location's miniboss gives a gift with this chance (rare). */
  minibossChance: 0.5,
  /** Share of cursed gifts among commons in a window (at most one). */
  cursedChance: 0.25,
};

const RARITY_NAMES: Record<GiftRarity, string> = { common: 'Звичайний дар', rare: 'Рідкісний дар', legendary: 'Легендарний дар' };
export { RARITY_NAMES as GIFT_RARITY_NAMES };


export const GIFTS: Record<string, GiftDef> = {
  // ---- Звичайні ----
  swift: { id: 'swift', name: 'Швидка рука', rarity: 'common', text: '+8% швидкості атаки.', effects: [{ kind: 'stat', stat: 'attackSpeedPct', value: 0.08 }] },
  tough: { id: 'tough', name: 'Міцне здоров’я', rarity: 'common', text: '+8% макс. HP.', effects: [{ kind: 'stat', stat: 'hpPct', value: 0.08 }] },
  keen: { id: 'keen', name: 'Пильне око', rarity: 'common', text: '+4% шансу криту.', effects: [{ kind: 'stat', stat: 'critChance', value: 0.04 }] },
  hide: { id: 'hide', name: 'Груба шкіра', rarity: 'common', text: '+6 броні.', effects: [{ kind: 'stat', stat: 'armor', value: 6 }] },
  leech: { id: 'leech', name: 'Спрага', rarity: 'common', text: '+3% вампіризму.', effects: [{ kind: 'stat', stat: 'lifesteal', value: 0.03 }] },
  fleet: { id: 'fleet', name: 'Легкі ноги', rarity: 'common', text: '+6% швидкості руху.', effects: [{ kind: 'stat', stat: 'moveSpeedPct', value: 0.06 }] },
  focus: { id: 'focus', name: 'Ясна голова', rarity: 'common', text: '−6% перезарядки скілів.', effects: [{ kind: 'stat', stat: 'cooldownPct', value: 0.06 }] },
  might: { id: 'might', name: 'Сила волі', rarity: 'common', text: '+8% шкоди скілів.', effects: [{ kind: 'stat', stat: 'skillDamagePct', value: 0.08 }] },
  area: { id: 'area', name: 'Широкий замах', rarity: 'common', text: '+12% шкоди скілів по площі.', effects: [{ kind: 'tag', tag: 'area', value: 0.12 }] },
  single: { id: 'single', name: 'Точний удар', rarity: 'common', text: '+15% шкоди скілів по одній цілі.', effects: [{ kind: 'tag', tag: 'single', value: 0.15 }] },
  move: { id: 'move', name: 'Стрімкість', rarity: 'common', text: '+30% шкоди скілів руху.', effects: [{ kind: 'tag', tag: 'move', value: 0.3 }] },
  control: { id: 'control', name: 'Владна рука', rarity: 'common', text: '+15% шкоди скілів контролю.', effects: [{ kind: 'tag', tag: 'control', value: 0.15 }] },
  fire: { id: 'fire', name: 'Жар', rarity: 'common', text: '+15% шкоди Вогнем.', effects: [{ kind: 'element', element: 'fire', value: 0.15 }] },
  water: { id: 'water', name: 'Холод', rarity: 'common', text: '+15% шкоди Водою.', effects: [{ kind: 'element', element: 'water', value: 0.15 }] },
  wind: { id: 'wind', name: 'Буревій', rarity: 'common', text: '+15% шкоди Вітром.', effects: [{ kind: 'element', element: 'wind', value: 0.15 }] },
  earth: { id: 'earth', name: 'Корінь', rarity: 'common', text: '+15% шкоди Землею.', effects: [{ kind: 'element', element: 'earth', value: 0.15 }] },
  stunned: { id: 'stunned', name: 'Добивання', rarity: 'common', text: '+20% шкоди по оглушених.', effects: [{ kind: 'status', status: 'stun', value: 0.2 }] },
  frozen: { id: 'frozen', name: 'Крихкий лід', rarity: 'common', text: '+25% шкоди по заморожених.', effects: [{ kind: 'status', status: 'freeze', value: 0.25 }] },
  burning: { id: 'burning', name: 'Масло у вогонь', rarity: 'common', text: '+15% шкоди по палаючих.', effects: [{ kind: 'status', status: 'burn', value: 0.15 }] },
  slowed: { id: 'slowed', name: 'Мисливський азарт', rarity: 'common', text: '+12% шкоди по сповільнених.', effects: [{ kind: 'status', status: 'slow', value: 0.12 }] },
  // ---- Прокляті ----
  glass: { id: 'glass', name: 'Скляна гармата', rarity: 'common', cursed: true, text: '+25% шкоди скілів, але −15% макс. HP.', effects: [{ kind: 'stat', stat: 'skillDamagePct', value: 0.25 }, { kind: 'stat', stat: 'hpPct', value: -0.15 }] },
  frenzy: { id: 'frenzy', name: 'Шаленство', rarity: 'common', cursed: true, text: '+20% швидкості атаки, але −10 броні.', effects: [{ kind: 'stat', stat: 'attackSpeedPct', value: 0.2 }, { kind: 'stat', stat: 'armor', value: -10 }] },
  reckless: { id: 'reckless', name: 'Безрозсудність', rarity: 'common', cursed: true, text: '−15% перезарядки, але −10% макс. HP.', effects: [{ kind: 'stat', stat: 'cooldownPct', value: 0.15 }, { kind: 'stat', stat: 'hpPct', value: -0.1 }] },
  // ---- Рідкісні: скіл отримує свою особливість одразу ----
  whirlPull: { id: 'whirlPull', name: 'Око бурі', rarity: 'rare', text: 'Вихор притягує ворогів уже з першого рангу.', effects: [{ kind: 'skill', skill: 'whirlwind', param: 'pull', value: 240 }] },
  chargeTrail: { id: 'chargeTrail', name: 'Палаючий слід', rarity: 'rare', text: 'Ривок лишає слід, що б’є ворогів.', effects: [{ kind: 'skill', skill: 'charge', param: 'trail', value: 1 }] },
  cryHeal: { id: 'cryHeal', name: 'Бойовий дух', rarity: 'rare', text: 'Бойовий клич лікує за кожного ворога поруч.', effects: [{ kind: 'skill', skill: 'battleCry', param: 'healPerEnemy', value: 0.02 }] },
  slamStun: { id: 'slamStun', name: 'Важкий удар', rarity: 'rare', text: 'Удар об землю оглушує.', effects: [{ kind: 'skill', skill: 'groundSlam', param: 'stun', value: 0.8 }] },
  axePierce: { id: 'axePierce', name: 'Гостре лезо', rarity: 'rare', text: 'Сокира пробиває всіх ворогів на шляху.', effects: [{ kind: 'skill', skill: 'axeThrow', param: 'pierce', value: 99 }] },
  quakeStun: { id: 'quakeStun', name: 'Тремтіння', rarity: 'rare', text: 'Кожен поштовх Землетрусу оглушує.', effects: [{ kind: 'skill', skill: 'earthquake', param: 'stun', value: 0.3 }] },
  hookVuln: { id: 'hookVuln', name: 'Розірвана броня', rarity: 'rare', text: 'Притягнуті Гаком отримують більше шкоди.', effects: [{ kind: 'skill', skill: 'hook', param: 'vuln', value: 0.25 }] },
  fireGround: { id: 'fireGround', name: 'Палаюча земля', rarity: 'rare', text: 'Вогняна куля лишає палаючу землю.', effects: [{ kind: 'skill', skill: 'fireball', param: 'ground', value: 1 }] },
  frostField: { id: 'frostField', name: 'Іній', rarity: 'rare', text: 'Крижане кільце лишає крижане поле.', effects: [{ kind: 'skill', skill: 'frostRing', param: 'field', value: 1 }] },
  chainStun: { id: 'chainStun', name: 'Розряд', rarity: 'rare', text: 'Ланцюгова блискавка оглушує.', effects: [{ kind: 'skill', skill: 'chainLightning', param: 'stun', value: 0.3 }] },
  teleBlast: { id: 'teleBlast', name: 'Спалах', rarity: 'rare', text: 'Телепорт вибухає там, де герой з’являється.', effects: [{ kind: 'skill', skill: 'teleport', param: 'blastDamage', value: 1.5 }] },
  missileRico: { id: 'missileRico', name: 'Відскок', rarity: 'rare', text: 'Магічні стріли відскакують ще в одного ворога.', effects: [{ kind: 'skill', skill: 'magicMissiles', param: 'ricochet', value: 1 }] },
  barrierNova: { id: 'barrierNova', name: 'Крижаний вибух', rarity: 'rare', text: 'Крижаний бар’єр вибухає холодом.', effects: [{ kind: 'skill', skill: 'iceBarrier', param: 'nova', value: 1 }] },
  wallBurn: { id: 'wallBurn', name: 'Жаровня', rarity: 'rare', text: 'Стіна вогню підпалює ворогів.', effects: [{ kind: 'skill', skill: 'flameWall', param: 'burn', value: 1 }] },
  vortexFinale: { id: 'vortexFinale', name: 'Обвал', rarity: 'rare', text: 'Вирва наприкінці вибухає.', effects: [{ kind: 'skill', skill: 'vortex', param: 'finale', value: 1 }] },
  multiPierce: { id: 'multiPierce', name: 'Прошивання', rarity: 'rare', text: 'Стріли Мультипострілу прошивають ворога.', effects: [{ kind: 'skill', skill: 'multishot', param: 'pierce', value: 1 }] },
  trapStun: { id: 'trapStun', name: 'Капкан-оглушувач', rarity: 'rare', text: 'Пастка оглушує.', effects: [{ kind: 'skill', skill: 'hunterTrap', param: 'stun', value: 0.8 }] },
  rainSlow: { id: 'rainSlow', name: 'Злива', rarity: 'rare', text: 'Дощ стріл сповільнює.', effects: [{ kind: 'skill', skill: 'arrowRain', param: 'slow', value: 0.3 }] },
  vaultShots: { id: 'vaultShots', name: 'Постріл у стрибку', rarity: 'rare', text: 'Відскок стріляє ще двічі.', effects: [{ kind: 'skill', skill: 'vault', param: 'extraShots', value: 2 }] },
  pierceVuln: { id: 'pierceVuln', name: 'Рана', rarity: 'rare', text: 'Пронизлива стріла робить цілі вразливими.', effects: [{ kind: 'skill', skill: 'piercingShot', param: 'vuln', value: 0.2 }] },
  markSpread: { id: 'markSpread', name: 'Ланцюг міток', rarity: 'rare', text: 'Мітка мисливця перескакує на сусіда, коли ціль гине.', effects: [{ kind: 'skill', skill: 'hunterMark', param: 'spread', value: 1 }] },
  netVuln: { id: 'netVuln', name: 'Тугі вузли', rarity: 'rare', text: 'Спіймані Сіткою отримують більше шкоди.', effects: [{ kind: 'skill', skill: 'net', param: 'vuln', value: 0.25 }] },
  barragePierce: { id: 'barragePierce', name: 'Шквал навиліт', rarity: 'rare', text: 'Стріли Шквалу прошивають ворога.', effects: [{ kind: 'skill', skill: 'barrage', param: 'pierce', value: 1 }] },
  // ---- Легендарні (боси) ----
  storm: { id: 'storm', name: 'Серце стихій', rarity: 'legendary', text: '+30% шкоди всіма стихіями (крім нейтральної).', effects: [{ kind: 'element', element: 'any', value: 0.3 }] },
  titan: { id: 'titan', name: 'Титан', rarity: 'legendary', text: '+20% макс. HP і +12 броні.', effects: [{ kind: 'stat', stat: 'hpPct', value: 0.2 }, { kind: 'stat', stat: 'armor', value: 12 }] },
  tempest: { id: 'tempest', name: 'Нестримна буря', rarity: 'legendary', text: '−20% перезарядки й +15% шкоди скілів.', effects: [{ kind: 'stat', stat: 'cooldownPct', value: 0.2 }, { kind: 'stat', stat: 'skillDamagePct', value: 0.15 }] },
  executioner: { id: 'executioner', name: 'Кат', rarity: 'legendary', text: '+40% шкоди по оглушених і заморожених.', effects: [{ kind: 'status', status: 'stun', value: 0.4 }, { kind: 'status', status: 'freeze', value: 0.4 }] },
  phoenix: { id: 'phoenix', name: 'Фенікс', rarity: 'legendary', text: '+6% вампіризму й +12% макс. HP.', effects: [{ kind: 'stat', stat: 'lifesteal', value: 0.06 }, { kind: 'stat', stat: 'hpPct', value: 0.12 }] },
};

/** Skill tags (what tag gifts strengthen). Untagged skills get none. */
export const SKILL_TAGS: Record<string, SkillTag[]> = {
  whirlwind: ['area'],
  charge: ['move', 'control'],
  groundSlam: ['area', 'control'],
  axeThrow: ['single'],
  earthquake: ['area', 'control'],
  hook: ['control', 'single'],
  fireball: ['fire', 'area'],
  frostRing: ['ice', 'area', 'control'],
  chainLightning: ['single'],
  teleport: ['move'],
  magicMissiles: ['single'],
  iceBarrier: ['ice'],
  flameWall: ['fire', 'area'],
  vortex: ['area', 'control'],
  multishot: ['area'],
  hunterTrap: ['control'],
  arrowRain: ['area'],
  vault: ['move'],
  piercingShot: ['single'],
  hunterMark: ['single'],
  net: ['control'],
  meteor: ['fire', 'area'],
  blizzard: ['ice', 'area', 'control'],
  aimedShot: ['single'],
};

export const TAG_NAMES: Record<SkillTag, string> = { area: 'по площі', single: 'по одній цілі', move: 'рух', control: 'контроль', fire: 'вогонь', ice: 'лід' };
