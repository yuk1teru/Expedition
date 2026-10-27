// Wiki sections about the story side of the game: the lore, the quests (what they ask,
// what they give, who gives them) and the trophies with the artifact buyer's orders.

import { CLASSES } from '../data/classes';
import { RARITIES } from '../data/items';
import { LORE } from '../data/lore';
import { LORE_NAMES } from '../data/names';
import { QUESTS, QUEST_KINDS, type QuestDef, type QuestKind, type QuestObjective } from '../data/quests';
import { ARTIFACT_ORDERS, TROPHIES, type TrophyDef } from '../data/trophies';
import {
  type Ref,
  type Section,
  NODES,
  anchor,
  card,
  esc,
  formsLine,
  link,
  monsterLink,
  nodeLink,
  npcLink,
  npcTown,
  regionName,
  t,
  table,
  trophyLink,
  v,
  whereFound,
} from './html';

// ---- Lore ----

const LORE_NAME_LABELS: Record<string, string> = {
  kingdom: 'Королівство',
  dead: 'Світ мертвих',
  lord: 'Володар мертвих',
  goddess: 'Покровителька',
  church: 'Собор',
};

export function loreSection(): Section {
  const names = Object.entries(LORE_NAMES).map(([id, n]) => [
    esc(LORE_NAME_LABELS[id] ?? id),
    `<b>${t(n.name, ['LORE_NAMES', id, 'name'])}</b>${formsLine(n.forms, ['LORE_NAMES', id, 'forms'])}`,
    `<code>{name:${id}}</code>`,
  ]);
  const entries = LORE.map((l, i) => card(anchor('lore', l.id), t(l.title, ['LORE', i, 'title']), `<div class="lore">${t(l.text, ['LORE', i, 'text'])}</div>`)).join('');
  return {
    id: 'lore',
    title: 'Історія світу',
    html: `<h3 class="group">Імена світу</h3>
<p class="small dim">Ці імена підставляються в усі тексти гри через посилання (третій стовпчик).</p>
${table(['Що', 'Назва', 'Посилання'], names)}
${entries}`,
  };
}

// ---- Quests ----

function npcWithTown(id: string): string {
  const town = npcTown(id);
  return town ? `${npcLink(id)} <span class="dim">(${nodeLink(town)})</span>` : npcLink(id);
}

/** Where a trophy comes from, for quest objectives and orders. */
function trophySource(tr: TrophyDef): string {
  if (tr.kind === 'relic') return `скарби: ${tr.from.map(regionName).map(esc).join(', ')}`;
  return tr.from.map((f) => `${monsterLink(f)} — ${whereFound(f)}`).join('; ');
}

function objective(q: QuestDef, o: QuestObjective, i: number): string {
  const R = (...p: (string | number)[]): Ref => ['QUESTS', q.id, 'objectives', i, ...p];
  const node = NODES.find((n) => n.id === o.target);
  const note = o.kind !== 'special' && o.text ? ` <span class="dim">— ${t(o.text, R('text'))}</span>` : '';
  switch (o.kind) {
    case 'kill':
      return `Убити: ${o.target === 'any' ? 'будь-яких ворогів' : monsterLink(o.target)} × ${v(o.count, R('count'))}${o.where ? ` — у локації ${nodeLink(o.where)}` : ''}${note}`;
    case 'killMiniboss':
      return `Перемогти мінібоса ${node ? monsterLink(node.miniboss) : ''} у локації ${nodeLink(o.target)}${note}`;
    case 'killBoss':
      return `Перемогти боса ${node ? monsterLink(node.boss) : ''} (${nodeLink(o.target)})${note}`;
    case 'clear':
      return `Зачистити локацію ${nodeLink(o.target)}${note}`;
    case 'reach':
      return `Дійти до ${node?.isTown ? 'міста ' : ''}${nodeLink(o.target)}${note}`;
    case 'bring': {
      const tr = TROPHIES[o.target];
      return `Принести: ${trophyLink(o.target)} × ${v(o.count, R('count'))}${tr ? ` <span class="small dim">(${trophySource(tr)})</span>` : ''}${note}`;
    }
    case 'deliver':
      return `Віднести посилку: ${npcWithTown(o.target)}${note}`;
    case 'talk':
      return `Поговорити: ${npcWithTown(o.target)}${note}`;
    case 'special':
      return t(o.text ?? o.target, R('text'));
  }
}

const GIFTS: Record<string, string> = { common: 'звичайний дар', rare: 'рідкісний дар', legendary: 'легендарний дар' };

function rewards(q: QuestDef): string {
  const R = (k: string): Ref => ['QUESTS', q.id, 'reward', k];
  const r = q.reward;
  const out: string[] = [];
  if (r.gold) out.push(`${v(r.gold, R('gold'))} зол.`);
  if (r.talentPoints) out.push(`<b>${v(r.talentPoints, R('talentPoints'))} очк. таланту</b>`);
  if (r.lives) out.push(`<b>+${v(r.lives, R('lives'))} життя</b>`);
  if (r.runeStones) out.push(`${v(r.runeStones, R('runeStones'))} рунічні камені`);
  if (r.item) out.push(`річ: <span style="color:${RARITIES[r.item].color}">${esc(RARITIES[r.item].name.toLowerCase())}</span>`);
  if (r.gift) out.push(GIFTS[r.gift] ?? r.gift);
  if (r.unlock) out.push(`відкриває: ${t(r.unlock, R('unlock'))}`);
  return out.length ? out.join(' · ') : '—';
}

function questLink(id: string): string {
  const q = QUESTS[id];
  return q ? link('quest', id, q.name) : esc(id);
}

/** Quests an NPC gives (links), or '' if none. */
export function questsGivenBy(npcId: string): string {
  return Object.values(QUESTS)
    .filter((q) => q.giver === npcId)
    .map((q) => questLink(q.id))
    .join(', ');
}

function questCard(q: QuestDef): string {
  const R = (...p: (string | number)[]): Ref => ['QUESTS', q.id, ...p];
  const req: string[] = [];
  for (const id of q.requires?.quests ?? []) req.push(`квест ${questLink(id)}`);
  if (q.requires?.level) req.push(`рівень ${v(q.requires.level, R('requires', 'level'))}`);
  if (q.requires?.note) req.push(t(q.requires.note, R('requires', 'note')));
  const prev = Object.values(QUESTS).find((x) => x.next === q.id);
  const rows: string[][] = [
    ['Дає', npcWithTown(q.giver)],
    ...(q.turnIn && q.turnIn !== q.giver ? [['Здати', npcWithTown(q.turnIn)]] : []),
    ...(req.length ? [['Умови', req.join(' · ')]] : []),
    ['Завдання', `<ol class="objectives">${q.objectives.map((o, i) => `<li>${objective(q, o, i)}</li>`).join('')}</ol>`],
    ['Нагорода', rewards(q)],
    ...(prev ? [['Перед цим', questLink(prev.id)]] : []),
    ...(q.next ? [['Далі', questLink(q.next)]] : []),
  ];
  const sub = [QUEST_KINDS[q.kind].name, q.classId ? CLASSES[q.classId]?.name : '', q.repeatable ? 'повторюваний' : ''].filter(Boolean).join(' · ');
  const body = `<p class="quote">«${t(q.offer, R('offer'))}»</p>${table(['', ''], rows, 'kv quest')}<p class="quote dim">Після виконання: «${t(q.done, R('done'))}»</p>`;
  return card(anchor('quest', q.id), t(q.name, R('name')), body, esc(sub));
}

export function questsSection(): Section {
  const kinds = Object.keys(QUEST_KINDS) as QuestKind[];
  const list = Object.values(QUESTS);
  const html = kinds
    .map((k) => {
      const qs = list.filter((q) => q.kind === k);
      if (qs.length === 0) return '';
      return `<h3 class="group" id="${anchor('quests', k)}">${t(QUEST_KINDS[k].name, ['QUEST_KINDS', k, 'name'])} <small class="dim">(${qs.length})</small></h3>
<p class="dim small">${t(QUEST_KINDS[k].description, ['QUEST_KINDS', k, 'description'])}</p>${qs.map(questCard).join('')}`;
    })
    .join('');
  const trials = list.filter((q) => q.kind === 'trial').reduce((sum, q) => sum + (q.reward.talentPoints ?? 0), 0);
  return {
    id: 'quests',
    title: 'Квести',
    html: `<p>Квести запрацюють у грі на етапі 11 (ROADMAP.md); тут — їхній повний опис: хто дає, що треба зробити і що за це буде. Усього квестів: ${list.length}. Очки таланту з квестів: ${trials} за випробування + 2 за ланцюжок свого класу.</p>${html}`,
  };
}

// ---- Trophies ----

const TROPHY_KINDS: Record<string, string> = { common: 'звичайний', rare: 'рідкісний (мінібос)', boss: 'трофей боса', relic: 'реліквія (скарби)' };

export function trophiesSection(): Section {
  const usedBy = (id: string): string => {
    const quests = Object.values(QUESTS)
      .filter((q) => q.objectives.some((o) => o.kind === 'bring' && o.target === id))
      .map((q) => questLink(q.id));
    const orders = ARTIFACT_ORDERS.filter((o) => o.wants.some((w) => w.trophy === id)).map((o) => link('order', o.id, o.name));
    return [...quests, ...orders].join(', ') || '—';
  };
  const rows = Object.values(TROPHIES).map((tr) => {
    const R = (k: string): Ref => ['TROPHIES', tr.id, k];
    return [
      `<b id="${anchor('trophy', tr.id)}">${t(tr.name, R('name'))}</b><div class="dim small">${t(tr.description, R('description'))}</div>`,
      esc(TROPHY_KINDS[tr.kind] ?? tr.kind),
      `<span class="small">${trophySource(tr)}</span>`,
      v(tr.chance, R('chance'), 'pct'),
      v(tr.price, R('price')),
      `<span class="small">${usedBy(tr.id)}</span>`,
    ];
  });
  const orders = ARTIFACT_ORDERS.map((o, i) => {
    const merchant = o.wants.reduce((sum, w) => sum + (TROPHIES[w.trophy]?.price ?? 0) * w.count, 0);
    return [
      `<b id="${anchor('order', o.id)}">${t(o.name, ['ARTIFACT_ORDERS', i, 'name'])}</b><div class="dim small">«${t(o.text, ['ARTIFACT_ORDERS', i, 'text'])}»</div>`,
      o.wants.map((w, k) => `${trophyLink(w.trophy)} × ${v(w.count, ['ARTIFACT_ORDERS', i, 'wants', k, 'count'])}`).join('<br>'),
      `<b>${v(o.pay, ['ARTIFACT_ORDERS', i, 'pay'])}</b> <span class="dim small">(торговець дав би ${merchant})</span>`,
      `<span class="small">${o.wants.map((w) => (TROPHIES[w.trophy] ? trophySource(TROPHIES[w.trophy]!) : '')).join('<br>')}</span>`,
    ];
  });
  return {
    id: 'trophies',
    title: 'Трофеї й скупник',
    html: `<p>Трофеї падають з монстрів (у кожного виду — свій), рідкісні — з мінібосів і босів, реліквії лежать у скарбах на аренах. Торговець купує все за ціною зі стовпчика «Ціна». Трофеї потрібні для квестів і в алхіміка. У грі вони почнуть падати на етапі 14 (ROADMAP.md).</p>
${table(['Трофей', 'Вид', 'Звідки', 'Шанс', 'Ціна', 'Потрібен для'], rows, 'wide')}
<h3 class="group">Замовлення скупника — ${npcWithTown('artifactBuyer')}</h3>
<p class="dim small">Скупник платить за весь набір значно більше за торговця і підказує, де шукати.</p>
${table(['Замовлення', 'Що треба', 'Платить', 'Де шукати'], orders, 'wide')}`,
  };
}
