// Wiki content (PLAN.md 8.5): every section is generated from src/data, so the wiki is
// always what the game uses. Numbers (`v()`) and texts (`t()`) carry a reference to their
// place in the data (`[ROOT, ...path]`); in `npm run dev` they become editable.

import { soundsSection } from './sounds';
import * as BALANCE from '../data/balance';
import { BIOMES } from '../data/biomes';
import { type BossDef, BOSSES, HAZARDS } from '../data/bosses';
import { CLASSES, CLASS_ORDER } from '../data/classes';
import { CONSUMABLES, PICKUPS, PICKUP_SPAWN } from '../data/consumables';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { BOOT_DASH, ITEM_BASES, ITEM_LEVEL, ITEM_SLOTS, LOOT, MERCHANT_ITEMS, RARITIES, RARITY_ORDER, STAT_LABELS } from '../data/items';
import { NPCS } from '../data/npcs';
import { ALLY_WOLF, PROMOTIONS } from '../data/promotions';
import { PARAM_INFO, PASSIVES, SKILLS, describePassive, describeSkill } from '../data/skills';
import { INTERIORS, TOWNS, npcPlace } from '../data/towns';
import { fillNames } from '../data/names';
import { WEATHER } from '../data/weather';
import { WORLD_MAP, WORLD_NODES, WORLD_ROADS } from '../data/world';
import type { LiteralPath } from './literal';
import {
  type Fmt,
  type Ref,
  type Section,
  NODES,
  anchor,
  card,
  esc,
  formatValue,
  formsLine,
  link,
  monsterLink,
  nodeLink,
  round,
  sharedLine,
  t,
  table,
  v,
  whereFound,
} from './html';
import { elementTag, elementsSection } from './elements';
import { giftsSection } from './gifts';
import { arenasSection } from './arenas';
import { talentsSection } from './talents';
import { ENEMY_ELEMENTS } from '../data/elements';
import { deathSection, invasionSection, loreSection, questsGivenBy, questsSection, trophiesSection } from './story';

export { esc, formatValue, type Fmt, type Ref, type Section } from './html';
import { BOSS_ATTACK_NAMES, BOSS_PARAM_LABELS } from '../data/wikiLabels';
import { coachPrice } from '../systems/coach';
import { createGameState } from '../systems/run';

// ---- Sections ----

function intro(): Section {
  const html = `
<p>Уся інформація про гру: історія світу, класи, скіли, вороги, боси, локації, міста, квести, трофеї, речі й формули. Сторінка будується прямо з даних гри,
тож числа тут завжди ті самі, що в грі.</p>
<p class="dim">Імена в текстах — посилання: перейменуй місто, NPC чи боса, і нова назва з’явиться в усіх репліках, квестах і лорі. Для речень, де ім’я стоїть не в називному відмінку, поруч із назвою є відмінки — їх теж можна правити.</p>
<p class="dim">Рівень локації — рівень її монстрів на тій самій шкалі, що й рівень героя (1–${v(BALANCE.PROGRESSION.maxLevel, ['PROGRESSION', 'maxLevel'])}). Від нього рахуються сила ворогів, досвід, золото й рівень речей. Кожен переможений бос піднімає рівень решти світу (загроза).</p>`;
  return { id: 'about', title: 'Про вікі', html };
}

function classesSection(): Section {
  const parts = CLASS_ORDER.map((id) => {
    const c = CLASSES[id]!;
    const R = (...p: LiteralPath): Ref => ['CLASSES', id, ...p];
    const tr = c.traits;
    const traitRows: string[][] = [];
    if (tr.combatRegenPct !== undefined) traitRows.push(['Реген у бою (частка макс. HP за с)', v(tr.combatRegenPct, R('traits', 'combatRegenPct'), 'pct')]);
    if (tr.dodgeMelee !== undefined) traitRows.push(['Ухилення від ближніх ударів', v(tr.dodgeMelee, R('traits', 'dodgeMelee'), 'pct')]);
    if (tr.moveSpeedMult !== undefined) traitRows.push(['Швидкість руху', v(tr.moveSpeedMult, R('traits', 'moveSpeedMult'), 'x')]);
    if (tr.mana) {
      const m = tr.mana;
      traitRows.push(
        ['Мана: база / за рівень', `${v(m.base, R('traits', 'mana', 'base'))} / ${v(m.perLevel, R('traits', 'mana', 'perLevel'))}`],
        ['HP, які поглинає 1 мана', v(m.absorb, R('traits', 'mana', 'absorb'))],
        ['Мана за вбивство', v(m.perKill, R('traits', 'mana', 'perKill'))],
        ['Шанс кульки мани / мана з кульки', `${v(m.orbChance, R('traits', 'mana', 'orbChance'), 'pct')} / ${v(m.orbMana, R('traits', 'mana', 'orbMana'))}`],
        ['Кулька зникає за', v(m.orbLife, R('traits', 'mana', 'orbLife'), 's')],
      );
    }
    const a = c.basicAttack;
    const attackRows: string[][] =
      a.kind === 'melee'
        ? [
            ['Дуга удару', v(a.arcDeg, R('basicAttack', 'arcDeg'), 'deg')],
            ['Шкода решті в дузі', v(a.splash, R('basicAttack', 'splash'), 'pct')],
          ]
        : [
            ['Швидкість снаряда', v(a.speed, R('basicAttack', 'speed'))],
            ['Пробиває ворогів', `${v(a.pierce, R('basicAttack', 'pierce'))} (шкода далі ${v(a.pierceMult, R('basicAttack', 'pierceMult'), 'x')})`],
            ['Вибух при влучанні', `${v(a.splash, R('basicAttack', 'splash'), 'pct')} у радіусі ${v(a.splashRadius, R('basicAttack', 'splashRadius'))}`],
          ];
    const promos = Object.values(PROMOTIONS).filter((p) => p.classId === id);
    const body = `
<p>${t(c.description, R('description'))} <span class="dim">${t(c.role, R('role'))}.</span></p>
${table(
  ['Параметр', 'Значення'],
  [
    ['HP (множник)', v(c.hpMult, R('hpMult'), 'x')],
    ['Швидкість атаки', v(c.attackSpeedMult, R('attackSpeedMult'), 'x')],
    ['Шкода скілів', v(c.skillDamageMult, R('skillDamageMult'), 'x')],
    ['Дальність атаки', v(c.range, R('range'))],
    ...traitRows,
  ],
  'kv',
)}
<h4>Базова атака</h4><p>${t(a.description, R('basicAttack', 'description'))}</p>${table(['Параметр', 'Значення'], attackRows, 'kv')}
<h4>Скіли</h4><p>${c.skills.map((s) => link('skill', s, SKILLS[s]!.name)).join(' · ')}</p>
<h4>Пасивки</h4><p>${c.passives.map((p) => link('passive', p, PASSIVES[p]!.name)).join(' · ')}</p>
<h4>Просування (рівень ${BALANCE.PROGRESSION.promotionLevel})</h4><p>${promos.map((p) => link('promo', p.id, p.name)).join(' · ')}</p>`;
    return card(anchor('class', id), t(c.name, R('name')), body, t(c.traitText, R('traitText')));
  });
  const hero = BALANCE.HERO;
  const base = table(
    ['Параметр', 'Значення'],
    [
      ['HP', v(hero.hp, ['HERO', 'hp'])],
      ['Атака', v(hero.attack, ['HERO', 'attack'])],
      ['Атак за секунду', v(hero.attackSpeed, ['HERO', 'attackSpeed'])],
      ['Швидкість руху', v(hero.moveSpeed, ['HERO', 'moveSpeed'])],
    ],
    'kv',
  );
  return { id: 'classes', title: 'Класи', html: `<p>Базові числа героя (множаться на класові):</p>${base}${parts.join('')}` };
}

function skillRef(id: string, rank: number, key: string): Ref {
  const def = SKILLS[id]!;
  for (let j = rank - 2; j >= 0; j--) if (key in def.upgrades[j]!.set) return ['SKILLS', id, 'upgrades', j, 'set', key];
  return ['SKILLS', id, 'base', key];
}

const UNIT_FMT: Record<string, Fmt> = { pct: 'pct', s: 's', px: 'px', deg: 'deg', n: 'n' };

function skillCard(id: string): string {
  const s = SKILLS[id]!;
  const keys = Object.keys(s.ranks[0]!);
  const ranks = s.ranks.map((_, i) => i + 1);
  const rows = keys.map((k) => {
    const info = PARAM_INFO[k];
    const fmt = k === 'cooldown' ? 's' : (UNIT_FMT[info?.unit ?? 'n'] ?? 'n');
    const label = k === 'cooldown' ? 'перезарядка' : (info?.label ?? k);
    return [
      `${esc(label)} <code>${k}</code>`,
      ...ranks.map((r) => {
        const val = s.ranks[r - 1]![k];
        const changed = r > 1 && val !== s.ranks[r - 2]![k];
        return `<span class="${changed ? 'up' : ''}">${v(val, skillRef(id, r, k), fmt)}</span>`;
      }),
    ];
  });
  const specials = s.upgrades.map((u, i) => (u.text ? `<li><b>Ранг ${i + 2}:</b> ${t(u.text, ['SKILLS', id, 'upgrades', i, 'text'])}</li>` : '')).join('');
  const body = `<p>${t(describeSkill(id, 1), ['SKILLS', id, 'description'], s.description)}</p>${table(['Параметр', ...ranks.map((r) => `Р${r}`)], rows, 'ranks')}${specials ? `<ul>${specials}</ul>` : ''}`;
  const owner = CLASSES[s.classId]?.name ?? s.classId;
  const branch = s.branch ? ` · ${PROMOTIONS[s.branch]?.name ?? s.branch} (R)` : '';
  return card(anchor('skill', id), t(s.name, ['SKILLS', id, 'name']), body, `${esc(owner)}${esc(branch)}${s.element && s.element !== 'neutral' ? ` · ${elementTag(s.element)}` : ''}`);
}

function skillsSection(): Section {
  const html = CLASS_ORDER.map((cid) => {
    const c = CLASSES[cid]!;
    const own = Object.values(SKILLS).filter((s) => s.classId === cid);
    return `<h3 class="group">${esc(c.name)}</h3>${own.map((s) => skillCard(s.id)).join('')}`;
  }).join('');
  return { id: 'skills', title: 'Скіли', html: `<p>Ранг 1 — коли скіл узято; ранги 2–5 — картками рівня. Підсвічені — числа, що змінились на цьому ранзі.</p>${html}` };
}

function passivesSection(): Section {
  const rows = Object.values(PASSIVES).map((p) => [
    `<span id="${anchor('passive', p.id)}">${t(p.name, ['PASSIVES', p.id, 'name'])}</span>`,
    esc(CLASSES[p.classId]?.name ?? p.classId) + (p.branch ? ` · ${esc(PROMOTIONS[p.branch]?.name ?? p.branch)}` : ''),
    v(p.value, ['PASSIVES', p.id, 'value'], p.format === 'percent' ? 'pct' : p.format === 'seconds' ? 's' : 'n'),
    v(p.maxStacks, ['PASSIVES', p.id, 'maxStacks']),
    t(describePassive(p.id), ['PASSIVES', p.id, 'description'], p.description),
  ]);
  return { id: 'passives', title: 'Пасивки', html: table(['Пасивка', 'Клас', 'За стак', 'Стаків', 'Опис'], rows) };
}

function promotionsSection(): Section {
  const html = Object.values(PROMOTIONS)
    .map((p) => {
      const eff = Object.entries(p.effect)
        .filter(([k, val]) => k !== 'kind' && typeof val === 'number')
        .map(([k, val]) => [`<code>${k}</code>`, v(val as number, ['PROMOTIONS', p.id, 'effect', k])]);
      const body = `<p>${t(p.description, ['PROMOTIONS', p.id, 'description'])}</p><p><b>Механіка:</b> ${t(p.mechanic, ['PROMOTIONS', p.id, 'mechanic'])}</p>${table(['Параметр', 'Значення'], eff, 'kv')}
<p><b>Скіл (R):</b> ${link('skill', p.signature, SKILLS[p.signature]?.name ?? p.signature)} · <b>Пасивки:</b> ${p.passives
        .map((x) => link('passive', x, PASSIVES[x]?.name ?? x))
        .join(', ')}</p>`;
      return card(anchor('promo', p.id), t(p.name, ['PROMOTIONS', p.id, 'name']), body, esc(CLASSES[p.classId]?.name ?? ''));
    })
    .join('');
  const wolf = Object.entries(ALLY_WOLF)
    .filter(([, val]) => typeof val === 'number')
    .map(([k, val]) => [`<code>${k}</code>`, v(val as number, ['ALLY_WOLF', k])]);
  return { id: 'promotions', title: 'Просування', html: `${html}${card('ally-wolf', 'Вовк-компаньйон', table(['Параметр', 'Значення'], wolf, 'kv'))}` };
}

const ARCHETYPES: Record<string, string> = { chaser: 'переслідувач', shooter: 'стрілець', tank: 'танк', fast: 'швидкий' };

function enemyFeatures(e: EnemyDef): string {
  const R = (...p: LiteralPath): Ref => ['ENEMIES', e.id, ...p];
  const out: string[] = [];
  if (e.dash) out.push(`ривок кожні ${v(e.dash.interval, R('dash', 'interval'), 's')} (з ${v(e.dash.trigger, R('dash', 'trigger'))} px, ×${v(e.dash.speedMult, R('dash', 'speedMult'))} швидкості)`);
  if (e.cripple) out.push(`укус сповільнює на ${v(e.cripple.slow, R('cripple', 'slow'), 'pct')} на ${v(e.cripple.time, R('cripple', 'time'), 's')}`);
  if (e.stomp) out.push(`тупіт: коло +${v(e.stomp.reach, R('stomp', 'reach'))} px, ${v(e.stomp.delay, R('stomp', 'delay'), 's')} попередження, шкода ${v(e.stomp.damage, R('stomp', 'damage'), 'x')}`);
  if (e.poison) out.push(`отрута ${v(e.poison.dps, R('poison', 'dps'), 'pct')} шкоди/с на ${v(e.poison.time, R('poison', 'time'), 's')}`);
  if (e.split) out.push(`розпадається на ${v(e.split.count, R('split', 'count'))} × ${monsterLink(e.split.into)}`);
  if (e.shooter) out.push(`стріляє з ${v(e.shooter.range, R('shooter', 'range'))} px, тримає ${v(e.shooter.keepDistance, R('shooter', 'keepDistance'))} px`);
  if (e.volley) out.push(`кожен ${v(e.volley.every, R('volley', 'every'))}-й постріл — віяло з ${v(e.volley.count, R('volley', 'count'))}`);
  if (e.shotSlow) out.push(`постріл сповільнює на ${v(e.shotSlow.value, R('shotSlow', 'value'), 'pct')} на ${v(e.shotSlow.time, R('shotSlow', 'time'), 's')}`);
  return out.join('; ');
}

/** "Вода 2, панцир" — an enemy's defence for the tables. */
function defenceTag(id: string): string {
  const p = ENEMY_ELEMENTS[id];
  if (!p) return '<span class="dim">нейтральний</span>';
  return `${elementTag(p.type)} ${p.level}${p.shell !== undefined ? ', панцир' : ''}`;
}

function enemiesSection(): Section {
  const rows = Object.values(ENEMIES).map((e) => {
    const R = (k: string): Ref => ['ENEMIES', e.id, k];
    return [
      `<b id="${anchor('enemy', e.id)}">${t(e.name, R('name'))}</b><div class="dim small">${t(e.trait, R('trait'))}</div>`,
      `${ARCHETYPES[e.archetype] ?? e.archetype}<div class="small">${defenceTag(e.id)}</div>`,
      v(e.hp, R('hp')),
      v(e.damage, R('damage')),
      v(e.speed, R('speed')),
      v(e.armor, R('armor')),
      v(e.attackInterval, R('attackInterval'), 's'),
      v(e.xp, R('xp')),
      v(e.spawnWeight, R('spawnWeight')),
      `<span class="small">${enemyFeatures(e) || '—'}</span>`,
      `<span class="small">${whereFound(e.id)}</span>`,
    ];
  });
  const html = `<p>HP і шкода — для сили 1 (рівень монстрів ${BALANCE.LEVELS.base}); у локації вони множаться на силу її рівня, хвилю й загрозу. Вага — відносний шанс з’явитися у хвилі.</p>
${table(['Ворог', 'Тип', 'HP', 'Шкода', 'Швидк.', 'Броня', 'Атака раз на', 'XP', 'Вага', 'Особливості', 'Де'], rows, 'wide')}`;
  return { id: 'enemies', title: 'Вороги', html };
}

function bossParams(boss: BossDef, ai: number, phase: 0 | 1): string {
  const params = boss.attacks[ai]!.params[phase];
  const items = Object.entries(params).map(
    ([k, val]) => `${t(BOSS_PARAM_LABELS[k] ?? k, ['BOSS_PARAM_LABELS', k])} ${v(val, ['BOSSES', boss.id, 'attacks', ai, 'params', phase, k])}`,
  );
  return items.length ? items.join('<br>') : '—';
}

function bossCard(b: BossDef): string {
  const R = (...p: LiteralPath): Ref => ['BOSSES', b.id, ...p];
  const stats: string[][] = [
    ['HP', v(b.hp, R('hp'))],
    ['Шкода', v(b.damage, R('damage'))],
    ['Броня', v(b.armor, R('armor'))],
    ['Швидкість', v(b.speed, R('speed'))],
    ['XP / золото', `${v(b.xp, R('xp'))} / ${v(b.gold, R('gold'))}`],
    ['Попередження атак', v(b.telegraphDelay, R('telegraphDelay'), 's')],
    ['Пауза між атаками', v(b.minPause, R('minPause'), 's')],
  ];
  if (b.phase2) stats.push(['Фаза 2', `з ${v(b.phase2.hpFraction, R('phase2', 'hpFraction'), 'pct')} HP, швидкість ${v(b.phase2.speedMult, R('phase2', 'speedMult'), 'x')}`]);
  if (b.melee) stats.push(['Ближній удар', `${v(b.melee.damage, R('melee', 'damage'), 'x')} шкоди раз на ${v(b.melee.interval, R('melee', 'interval'), 's')}`]);
  if (b.coldAura) stats.push(['Аура холоду', `сповільнює на ${v(b.coldAura.slow, R('coldAura', 'slow'), 'pct')} у радіусі ${v(b.coldAura.radius, R('coldAura', 'radius'))} (з фази ${b.coldAura.phase})`]);
  const attacks = b.attacks.map((a, i) => [
    `<b>${t(BOSS_ATTACK_NAMES[`${b.id}.${a.id}`] ?? BOSS_ATTACK_NAMES[a.id] ?? a.id, [['BOSS_ATTACK_NAMES', `${b.id}.${a.id}`], ['BOSS_ATTACK_NAMES', a.id]])}</b>${a.enemyId ? `<div class="small">кличе: ${monsterLink(a.enemyId)}</div>` : ''}${
      a.followUp ? `<div class="small">з шансом ${v(a.followUp.chance, R('attacks', i, 'followUp', 'chance'), 'pct')} одразу ${esc(BOSS_ATTACK_NAMES[a.followUp.id] ?? a.followUp.id)}</div>` : ''
    }`,
    a.phases.join(', '),
    v(a.weight, R('attacks', i, 'weight')),
    `${v(a.cooldown[0], R('attacks', i, 'cooldown', 0), 's')} / ${v(a.cooldown[1], R('attacks', i, 'cooldown', 1), 's')}`,
    `<span class="small">${bossParams(b, i, 0)}</span>`,
    `<span class="small">${bossParams(b, i, 1)}</span>`,
  ]);
  const body = `${table(['Параметр', 'Значення'], stats, 'kv')}<h4>Атаки</h4>${table(['Атака', 'Фази', 'Вага', 'Перезарядка ф1 / ф2', 'Фаза 1', 'Фаза 2'], attacks, 'wide')}<p class="small">Де: ${whereFound(b.id)}</p>`;
  return card(anchor('boss', b.id), t(b.name, R('name')), formsLine(b.forms, R('forms')) + `<p class="small">Захист: ${defenceTag(b.id)}</p>` + body, b.miniboss ? 'мінібос' : 'бос');
}

function bossesSection(): Section {
  const list = Object.values(BOSSES);
  const hazards = Object.entries(HAZARDS).flatMap(([k, val]) =>
    typeof val === 'number' ? [[`<code>${k}</code>`, v(val, ['HAZARDS', k])]] : Object.entries(val as Record<string, number>).map(([kk, vv]) => [`<code>${k}.${kk}</code>`, v(vv, ['HAZARDS', k, kk])]),
  );
  const html = `<p>Шкода атак — множник шкоди боса. Мінібос приходить з останньою хвилею лігва локації й масштабується як вороги локації.</p>
<h3 class="group">Боси</h3>${list.filter((b) => !b.miniboss).map(bossCard).join('')}
<h3 class="group">Мінібоси</h3>${list.filter((b) => b.miniboss).map(bossCard).join('')}
${card('hazards', 'Калюжі й кільця', table(['Параметр', 'Значення'], hazards, 'kv'))}`;
  return { id: 'bosses', title: 'Боси й мінібоси', html };
}

function mechanicsText(n: (typeof NODES)[number]): string {
  if (n.isTown) return '—';
  const m = n.mechanics;
  const parts: string[] = [];
  parts.push(m.trapsFrom === null ? 'без пасток' : `пастки з ${m.trapsFrom}-ї хвилі`);
  if (m.events.length) parts.push(`події: ${m.events.map((e) => (e === 'weather' ? `погода (${m.weathers.map((w) => WEATHER[w].name.toLowerCase()).join(', ')})` : 'дух бурі')).join(' / ')}`);
  parts.push(m.herbs ? 'ростуть трави' : 'без трав');
  return parts.join('; ');
}

function worldSection(): Section {
  const regions = [...new Set(NODES.map((n) => n.region))];
  const html = regions
    .map((r) => {
      const rows = NODES.filter((n) => n.region === r).map((n) => {
        const i = WORLD_NODES.findIndex((d) => d.id === n.id);
        const kind = n.isTown ? 'місто' : n.isBoss ? 'бос' : 'локація';
        const roads = WORLD_ROADS.filter(([a, b]) => a === n.id || b === n.id)
          .map(([a, b]) => (a === n.id ? b : a))
          .map((id) => link('loc', id, NODES.find((x) => x.id === id)?.name ?? id))
          .join(', ');
        return [
          `<b id="${anchor('loc', n.id)}">${t(n.name, ['WORLD_NODES', i, 'name'])}</b><div class="dim small">${t(n.description, ['WORLD_NODES', i, 'description'])}</div>${formsLine(WORLD_NODES[i]?.forms, ['WORLD_NODES', i, 'forms'])}`,
          kind,
          n.isTown ? '—' : v(n.level, ['WORLD_NODES', i, 'level']),
          n.isTown ? townNpcs(n.id) : n.isBoss ? monsterLink(n.boss) : n.enemies.map(monsterLink).join(', '),
          n.isTown || n.isBoss || !n.miniboss ? '—' : monsterLink(n.miniboss),
          `<span class="small">${mechanicsText(n)}</span>`,
          `<span class="small">${roads}</span>`,
        ];
      });
      const ri = WORLD_MAP.regions.findIndex((x) => x.id === r);
      return `<h3 class="group">${ri >= 0 ? t(WORLD_MAP.regions[ri]!.name, ['WORLD_MAP', 'regions', ri, 'name']) : esc(BIOMES[r]?.name ?? r)}</h3>${table(['Місце', 'Тип', 'Рівень', 'Вороги / жителі', 'Мінібос', 'Механіки', 'Дороги'], rows, 'wide')}`;
    })
    .join('');
  const threat = BALANCE.WORLD.bossThreat;
  return {
    id: 'world',
    title: 'Світ і локації',
    html: `<p>Рівень — рівень монстрів локації (герой того ж рівня — саме для неї). Кожен переможений бос додає локаціям +${v(
      threat.locationLevels,
      ['WORLD', 'bossThreat', 'locationLevels'],
    )} рівнів, а іншим босам +${v(threat.bossLevels, ['WORLD', 'bossThreat', 'bossLevels'])} (загроза), але не вище ${BALANCE.PROGRESSION.maxLevel}.</p>${html}${coachTable()}`,
  };
}

/** «Швидка тарадайка»: the ride price to every town. */
function coachTable(): string {
  const s = createGameState(1);
  const C = BALANCE.COACH;
  const rows = NODES.filter((n) => n.isTown).map((n) => [nodeLink(n.id), `${coachPrice(s, n.id)} зол.`]);
  return `<h3 class="group">«Швидка тарадайка»</h3>
<p>Візник у кожному місті возить між містами, до яких герой уже дійшов сам, — без днів і боїв. Ціна — ${v(C.share, ['COACH', 'share'], 'pct')} золота, яке дає найлегша локація регіону міста призначення (обов’язкові хвилі + бонус за зачистку), округлено до ${v(C.roundTo, ['COACH', 'roundTo'])}, не менше ${v(C.min, ['COACH', 'min'])}.</p>
${table(['Куди', 'Ціна'], rows)}`;
}

/** NPCs of a town: outside and at home in its rooms. */
function townNpcIds(townId: string): string[] {
  const layout = TOWNS[townId];
  if (!layout) return [];
  return [...layout.npcs.map((n) => n.id), ...layout.buildings.flatMap((b) => (b.interior ? (INTERIORS[b.interior]?.npcs.map((n) => n.id) ?? []) : []))];
}

function townNpcs(townId: string): string {
  const ids = townNpcIds(townId);
  if (ids.length === 0) return '—';
  return ids.map((id) => `${link('npc', id, NPCS[id]?.name ?? id)} <span class="dim">(${esc(NPCS[id]?.title ?? '')})</span>`).join(', ');
}

/** Where the NPC is: at home in a room, near it, or in the street. */
function npcWhere(townId: string, id: string): string {
  const place = npcPlace(id);
  if (place?.interior) return `вдома: ${esc(fillNames(INTERIORS[place.interior]!.name))}`;
  const home = TOWNS[townId]?.npcs.find((n) => n.id === id)?.home;
  return home ? `біля дому (${esc(fillNames(INTERIORS[home]?.name ?? home))})` : 'на вулиці';
}

function townsSection(): Section {
  const html = Object.values(TOWNS)
    .map((town) => {
      const ni = WORLD_NODES.findIndex((n) => n.id === town.id);
      const node = NODES[ni];
      const npcs = townNpcIds(town.id)
        .map((nid) => {
          const npc = NPCS[nid]!;
          const nodes = Object.entries(npc.nodes)
            .map(
              ([nid, node]) =>
                `<li><code>${nid}</code> «${t(node.text, [
                  ['NPCS', npc.id, 'nodes', nid, 'text'],
                  ['NPCS', npc.id, nid === 'hello' ? 'greeting' : nid],
                  ...sharedLine(node.text),
                ])}»<br><span class="small">${node.options
                  .map((o, oi) => `→ ${t(o.text, [['NPCS', npc.id, 'nodes', nid, 'options', oi, 'text'], ...sharedLine(o.text)])}${o.next ? ` <code>${o.next}</code>` : ''}${o.action ? ` <i>[${o.action}]</i>` : ''}`)
                  .join(' · ')}</span></li>`,
            )
            .join('');
          const quests = questsGivenBy(npc.id);
          return `<div class="npc" id="${anchor('npc', npc.id)}"><b>${t(npc.name, ['NPCS', npc.id, 'name'])}</b> — ${t(npc.title, [['NPCS', npc.id, 'title'], ...sharedLine(npc.title)])} <span class="dim small">· ${npcWhere(town.id, npc.id)}</span>${formsLine(npc.forms, ['NPCS', npc.id, 'forms'])}${
            quests ? `<div class="small">Квести: ${quests}</div>` : ''
          }<ul class="dialogue">${nodes}</ul></div>`;
        })
        .join('');
      return card(
        anchor('town', town.id),
        node ? t(node.name, ['WORLD_NODES', ni, 'name']) : esc(town.id),
        `<p class="dim">${node ? t(node.description, ['WORLD_NODES', ni, 'description']) : ''}</p>${formsLine(WORLD_NODES[ni]?.forms, ['WORLD_NODES', ni, 'forms'])}${npcs}`,
      );
    })
    .join('');
  return { id: 'towns', title: 'Міста й жителі', html: `<p>У місті герой відпочиває (повне HP, збереження). Розмова з NPC — клавіша E або клік; торгівля — з розмови з торговцем. У будинки з килимком перед дверима можна зайти: дехто з жителів удома, дехто — біля дому.</p>${html}` };
}

function itemsSection(): Section {
  const sum = (w: Partial<Record<string, number>>): number => Object.values(w).reduce<number>((a, b) => a + (b ?? 0), 0);
  const lootCell = (kind: 'miniboss' | 'boss', r: string): string => {
    const w = LOOT[kind].weights[r as keyof typeof LOOT.boss.weights];
    return w === undefined ? '—' : `${v(w, ['LOOT', kind, 'weights', r])} <span class="dim">(${round((w / sum(LOOT[kind].weights)) * 100, 1)}%)</span>`;
  };
  const merchantCell = (r: string): string => {
    const w = MERCHANT_ITEMS.weights[r as keyof typeof MERCHANT_ITEMS.weights];
    return w === undefined ? '—' : `${v(w, ['MERCHANT_ITEMS', 'weights', r])} <span class="dim">(${round((w / sum(MERCHANT_ITEMS.weights)) * 100, 1)}%)</span>`;
  };
  const rarity = RARITY_ORDER.map((r) => {
    const d = RARITIES[r];
    return [
      `<b style="color:${d.color}">${t(d.name, ['RARITIES', r, 'name'])}</b>`,
      v(d.power, ['RARITIES', r, 'power'], 'x'),
      v(d.extraStats, ['RARITIES', r, 'extraStats']),
      v(d.sellPrice, ['RARITIES', r, 'sellPrice']),
      lootCell('miniboss', r),
      lootCell('boss', r),
      merchantCell(r),
    ];
  });
  const ilvl = ITEM_LEVEL.byLevel.map((row, i) => [v(row[0], ['ITEM_LEVEL', 'byLevel', i, 0]), v(row[1], ['ITEM_LEVEL', 'byLevel', i, 1]), v(row[2], ['ITEM_LEVEL', 'byLevel', i, 2])]);
  const stat = (s: string): string => t(STAT_LABELS[s as keyof typeof STAT_LABELS]?.label ?? s, ['STAT_LABELS', s, 'label']);
  const pct = (s: string): Fmt => (STAT_LABELS[s as keyof typeof STAT_LABELS]?.percent ? 'pct' : 'n');
  const bases = ITEM_SLOTS.map(({ id, name }, si) => {
    const b = ITEM_BASES[id];
    const roll = (r: typeof b.main, ...p: LiteralPath): string =>
      `${stat(r.stat)} ${v(r.range[0], ['ITEM_BASES', id, ...p, 'range', 0], pct(r.stat))}–${v(r.range[1], ['ITEM_BASES', id, ...p, 'range', 1], pct(r.stat))}`;
    return [t(name, ['ITEM_SLOTS', si, 'name']), roll(b.main, 'main'), b.extras.map((e, i) => roll(e, 'extras', i)).join('<br>')];
  });
  const dash = Object.entries(BOOT_DASH).map(([r, d]) => [
    `<span style="color:${RARITIES[r as keyof typeof RARITIES].color}">${esc(RARITIES[r as keyof typeof RARITIES].name)}</span>`,
    v(d!.distance, ['BOOT_DASH', r, 'distance']),
    v(d!.cooldown, ['BOOT_DASH', r, 'cooldown'], 's'),
  ]);
  const html = `
<p>Мінібос дає ${v(LOOT.miniboss.count, ['LOOT', 'miniboss', 'count'])} річ, бос — ${v(LOOT.boss.count, ['LOOT', 'boss', 'count'])}. Шанс рідкості = вага / сума ваг.
Торговець продає випадкову розпізнану річ для обраного слота за ${v(MERCHANT_ITEMS.price, ['MERCHANT_ITEMS', 'price'])} зол.</p>
${table(['Рідкість', 'Сила', 'Дод. характеристик', 'Ціна продажу', 'Мінібос', 'Бос', 'Торговець'], rarity)}
<h3 class="group">Рівень предмета</h3>
<p>Діапазон рівня речі залежить від рівня монстрів локації (між рядками — плавно). Максимум — ${v(ITEM_LEVEL.max, ['ITEM_LEVEL', 'max'])}.
Плоскі характеристики множаться на ${v(ITEM_LEVEL.floor, ['ITEM_LEVEL', 'floor'])} + (1 − ${ITEM_LEVEL.floor}) · рівень / ${v(ITEM_LEVEL.reference, ['ITEM_LEVEL', 'reference'])}, відсоткові — на корінь із цього.</p>
${table(['Рівень монстрів', 'Мін. рівень речі', 'Макс. рівень речі'], ilvl)}
<h3 class="group">Характеристики за слотом</h3><p>Діапазони — для звичайної речі рівня ${ITEM_LEVEL.reference}; множаться на силу рідкості.</p>
${table(['Слот', 'Головна', 'Додаткові'], bases)}
<h3 class="group">Ривок черевиків (Shift)</h3>${table(['Рідкість', 'Відстань', 'Перезарядка'], dash)}`;
  return { id: 'items', title: 'Речі й лут', html };
}

function consumablesSection(): Section {
  const rows = Object.values(CONSUMABLES).map((c) => {
    const R = (...p: LiteralPath): Ref => ['CONSUMABLES', c.id, ...p];
    const heal = c.heal
      ? `${v(c.heal.pct, R('heal', 'pct'), 'pct')} макс. HP + ${v(c.heal.flat, R('heal', 'flat'))} HP за ${v(c.heal.duration, R('heal', 'duration'), 's')}`
      : t(c.description ?? '', R('description'));
    return [t(c.name, R('name')), heal, c.price > 0 ? v(c.price, R('price')) : 'не продається', v(c.max, R('max'))];
  });
  const pickups = Object.values(PICKUPS).map((p) => [t(p.name, ['PICKUPS', p.id, 'name']), v(p.weight, ['PICKUPS', p.id, 'weight'])]);
  const html = `${table(['Предмет', 'Дія', 'Ціна', 'Максимум'], rows)}
<h3 class="group">Рослинки на арені</h3>
<p>На початку кожної ${v(PICKUP_SPAWN.everyWaves, ['PICKUP_SPAWN', 'everyWaves'])}-ї хвилі може вирости рослинка (на арені не більше ${v(PICKUP_SPAWN.max, ['PICKUP_SPAWN', 'max'])}).</p>
${table(['Рослинка', 'Вага'], pickups)}`;
  return { id: 'consumables', title: 'Зілля й трави', html };
}

function wavesSection(): Section {
  const W = BALANCE.WAVES;
  const g = W.growth;
  const growth = (key: 'hp' | 'damage' | 'reward', i: number): string => `${formatValue(1 + g[key].a * i + g[key].b * i * i, 'x')}`;
  const sample = [0, 2, 4, 9, 14, 19].map((i) => [String(i + 1), growth('hp', i), growth('damage', i), growth('reward', i)]);
  const weatherRows = Object.values(WEATHER).map((w) => {
    const R = (...p: LiteralPath): Ref => ['WEATHER', w.id, ...p];
    return [
      t(w.name, R('name')),
      t(w.description, R('description')),
      v(w.moveSpeedMult, R('moveSpeedMult'), 'x'),
      v(w.attackSpeedMult, R('attackSpeedMult'), 'x'),
      w.visionRadius ? v(w.visionRadius, R('visionRadius')) : '—',
      w.lightning ? `раз на ${v(w.lightning.interval, R('lightning', 'interval'), 's')}, шкода ${v(w.lightning.damage, R('lightning', 'damage'))}` : '—',
    ];
  });
  const html = `
<p>Хвиля — ${v(W.baseSize, ['WAVES', 'baseSize'])} + ${v(W.perTier, ['WAVES', 'perTier'])} × tier ворогів (до ${v(W.maxSize, ['WAVES', 'maxSize'])}),
після ${v(W.count, ['WAVES', 'count'])}-ї хвилі локації +${v(W.extraPerWave, ['WAVES', 'extraPerWave'])} за хвилю, не більше ${v(W.cap, ['WAVES', 'cap'])}.
Коли від хвилі лишається ${v(W.overlapAt, ['WAVES', 'overlapAt'], 'pct')} ворогів, приходить наступна (якщо мінібос мертвий).
Останню хвилю арени треба зачистити повністю — і арену пройдено.
Еліта — з ${v(W.eliteWave, ['WAVES', 'eliteWave'])}-ї хвилі.</p>
<p>Ріст хвилі i (з 0): 1 + a·i + b·i².</p>
${table(
  ['', 'a', 'b'],
  (['hp', 'damage', 'reward'] as const).map((k) => [
    { hp: 'HP', damage: 'Шкода', reward: 'Нагорода (XP, золото)' }[k],
    v(g[k].a, ['WAVES', 'growth', k, 'a']),
    v(g[k].b, ['WAVES', 'growth', k, 'b']),
  ]),
  'kv',
)}
${table(['Хвиля', 'HP', 'Шкода', 'Нагорода'], sample)}
<h3 class="group">Події й погода</h3>
<p>Кожна ${v(BALANCE.WAVE_EVENTS.every, ['WAVE_EVENTS', 'every'])}-а хвиля — подія: погода або дух бурі (по черзі, якщо локація їх має).</p>
${table(['Погода', 'Опис', 'Рух', 'Атака', 'Видимість', 'Блискавки'], weatherRows)}`;
  return { id: 'waves', title: 'Хвилі й погода', html };
}

function formulasSection(): Section {
  const S = BALANCE.SCALING;
  const html = `
<ul>
<li><b>Сила</b> локації рівня L: tier = 1 + (L − ${v(BALANCE.LEVELS.base, ['LEVELS', 'base'])}) / ${v(BALANCE.LEVELS.perTier, ['LEVELS', 'perTier'])} (рівень ${v(BALANCE.LEVELS.base, ['LEVELS', 'base'])} — сила 1, кожні ${v(BALANCE.LEVELS.perTier, ['LEVELS', 'perTier'])} рівнів — +1).</li>
<li><b>Сила ворогів:</b> HP і шкода = база × (1 + ${v(S.perTier, ['SCALING', 'perTier'])} × (tier − 1)) × ріст хвилі.</li>
<li><b>XP за вбивство</b> = база × (1 + ${v(S.xpPerTier, ['SCALING', 'xpPerTier'])} × (tier − 1)); якщо герой перевищує рівень локації більш як на ${v(
    BALANCE.PROGRESSION.xpPenalty.levelGap,
    ['PROGRESSION', 'xpPenalty', 'levelGap'],
  )}, — лише ${v(BALANCE.PROGRESSION.xpPenalty.mult, ['PROGRESSION', 'xpPenalty', 'mult'], 'pct')}.</li>
<li><b>Золото за вбивство</b> = ${v(BALANCE.GOLD.perEnemyPerTier, ['GOLD', 'perEnemyPerTier'])} × tier × (1 + ${v(BALANCE.GOLD.perWave, ['GOLD', 'perWave'])} × хвиля).</li>
<li><b>Досвід до наступного рівня</b> = ${v(BALANCE.PROGRESSION.xpCurve.base, ['PROGRESSION', 'xpCurve', 'base'])} × (рівень + ${v(BALANCE.PROGRESSION.xpCurve.offset, ['PROGRESSION', 'xpCurve', 'offset'])})<sup>${v(BALANCE.PROGRESSION.xpCurve.exponent, ['PROGRESSION', 'xpCurve', 'exponent'])}</sup>; максимум — рівень ${v(BALANCE.PROGRESSION.maxLevel, ['PROGRESSION', 'maxLevel'])}.</li>
<li><b>Загроза:</b> кожен переможений бос додає +${v(BALANCE.WORLD.bossThreat.locationLevels, ['WORLD', 'bossThreat', 'locationLevels'])} рівнів локаціям і +${v(
    BALANCE.WORLD.bossThreat.bossLevels,
    ['WORLD', 'bossThreat', 'bossLevels'],
  )} босам, але не вище максимального рівня героя.</li>
</ul>`;
  return { id: 'formulas', title: 'Формули', html };
}

/** All of balance.ts: every exported group with its numbers and comments. */
function balanceSection(comment: (root: string, path: LiteralPath) => string | undefined): Section {
  const rows = (root: string, obj: unknown, path: LiteralPath, depth: number): string[] => {
    if (typeof obj === 'number') return [];
    if (Array.isArray(obj)) return [];
    if (!obj || typeof obj !== 'object') return [];
    const out: string[] = [];
    for (const [k, val] of Object.entries(obj as Record<string, unknown>)) {
      const p = [...path, k];
      const note = comment(root, p);
      const key = `<code style="padding-left:${depth * 14}px">${esc(k)}</code>`;
      let cell: string;
      if (typeof val === 'number') cell = v(val, [root, ...p]);
      else if (Array.isArray(val)) cell = val.map((x, i) => (typeof x === 'number' ? v(x, [root, ...p, i]) : esc(JSON.stringify(x)))).join(', ');
      else if (val && typeof val === 'object') cell = '';
      else cell = typeof val === 'string' ? t(val, [root, ...p]) : `<span class="dim">${esc(String(val))}</span>`;
      out.push(`<tr><td>${key}</td><td>${cell}</td><td class="small dim">${esc(note ?? '')}</td></tr>`);
      if (val && typeof val === 'object' && !Array.isArray(val)) out.push(...rows(root, val, p, depth + 1));
    }
    return out;
  };
  const groups = Object.entries(BALANCE)
    .filter(([, val]) => val && typeof val === 'object')
    .map(([name, val]) => {
      const note = comment(name, []);
      return `<details><summary><code>${name}</code> ${note ? `<span class="dim small">${esc(note)}</span>` : ''}</summary><table class="kv"><tbody>${rows(name, val, [], 0).join('')}</tbody></table></details>`;
    })
    .join('');
  return { id: 'balance', title: 'Усі налаштування', html: `<p class="dim">Усі групи чисел із <code>src/data/balance.ts</code> (для розробника).</p>${groups}` };
}

export function buildSections(comment: (root: string, path: LiteralPath) => string | undefined): Section[] {
  return [
    intro(),
    loreSection(),
    classesSection(),
    skillsSection(),
    passivesSection(),
    promotionsSection(),
    enemiesSection(),
    bossesSection(),
    worldSection(),
    townsSection(),
    arenasSection(),
    deathSection(),
    invasionSection(),
    questsSection(),
    trophiesSection(),
    itemsSection(),
    consumablesSection(),
    wavesSection(),
    elementsSection(),
    talentsSection(),
    giftsSection(),
    formulasSection(),
    soundsSection(),
    // All the numbers of balance.ts — for the developer only.
    ...(import.meta.env.DEV ? [balanceSection(comment)] : []),
  ];
}
