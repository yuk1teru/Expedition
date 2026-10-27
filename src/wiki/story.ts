// Wiki sections about the story side of the game: the lore, the quests (what they ask,
// what they give, who gives them) and the trophies with the artifact buyer's orders.

import { LIVES } from '../data/balance';
import { CLASSES } from '../data/classes';
import { GRAVE, WAKE } from '../data/death';
import { INVASION } from '../data/invasion';
import { RARITIES } from '../data/items';
import { LORE } from '../data/lore';
import { LORE_NAMES } from '../data/names';
import { QUESTS, QUEST_KINDS, QUEST_LINES, type QuestDef, type QuestKind, type QuestObjective } from '../data/quests';
import { HINTS } from '../data/hints';
import { questPlayable } from '../systems/quests';
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
  const sub = [QUEST_KINDS[q.kind].name, q.classId ? CLASSES[q.classId]?.name : '', q.repeatable ? 'повторюваний' : '', questPlayable(q) ? '' : 'з’явиться згодом'].filter(Boolean).join(' · ');
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
    html: `<p>Квести грають прямо з цих даних: «!» над NPC — квест, «?» — є що здати, журнал — клавіша J. Тут — повний опис: хто дає, що треба зробити і що за це буде. Усього квестів: ${list.length}, у грі вже доступні ${list.filter(questPlayable).length}; решта потребує трофеїв чи особливих подій і з’явиться згодом (ROADMAP, етапи 14–18). Очки таланту з квестів: ${trials} за випробування + 2 за ланцюжок свого класу.</p>
<h3 class="group">Репліки квестів</h3>
${table(['Що', 'Текст'], (Object.keys(QUEST_LINES) as (keyof typeof QUEST_LINES)[]).map((k) => [esc(k), t(QUEST_LINES[k], ['QUEST_LINES', k])]), 'kv')}
${html}
<h3 class="group">Підказки навчання</h3>
<p class="dim small">Кожна показується гравцеві один раз, у потрібний момент.</p>
${table(['Коли', 'Текст'], Object.entries(HINTS).map(([k, text]) => [esc(k), t(text, ['HINTS', k])]), 'kv')}`,
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
    html: `<p>Трофеї падають з монстрів (у кожного виду — свій), рідкісні — з мінібосів і босів, реліквії лежать у скарбах на аренах. Торговець купує все за ціною зі стовпчика «Ціна». Трофеї лежать у сумці (вкладка «Трофеї»); квест «зібрати» забирає їх, щойно набереться досить, а торговець при продажу лишає те, що збирають квести. Виведені гніздами й викликані вороги трофеїв не дають. Трофеї знадобляться й алхіміку.</p>
${table(['Трофей', 'Вид', 'Звідки', 'Шанс', 'Ціна', 'Потрібен для'], rows, 'wide')}
<h3 class="group">Замовлення скупника — ${npcWithTown('artifactBuyer')}</h3>
<p class="dim small">Скупник платить за весь набір значно більше за торговця і підказує, де шукати.</p>
${table(['Замовлення', 'Що треба', 'Платить', 'Де шукати'], orders, 'wide')}`,
  };
}

// ---- Lives and death ----

const CAUSE_LABELS: Record<keyof typeof WAKE.causes, string> = {
  melee: 'Удар ворога',
  shotBy: 'Постріл (відомо хто)',
  shot: 'Постріл',
  telegraphBy: 'Удар з попередженням (відомо хто)',
  telegraph: 'Удар з попередженням',
  hazard: 'Калюжа чи кільце',
  trap: 'Капкан',
  poison: 'Отрута',
  unknown: 'Невідомо',
};

export function deathSection(): Section {
  const causes = (Object.keys(WAKE.causes) as (keyof typeof WAKE.causes)[]).map((k) => [esc(CAUSE_LABELS[k]), t(WAKE.causes[k], ['WAKE', 'causes', k])]);
  const lines: [string, string, string][] = [
    ['Де знайшли', WAKE.place, 'place'],
    ['Кнопка відповіді', WAKE.askQuestion, 'askQuestion'],
    ['Здобич лишилась', WAKE.lostLoot, 'lostLoot'],
    ['Життя', WAKE.lives, 'lives'],
    ['Останнє життя', WAKE.lastLife, 'lastLife'],
    ['Прощання', WAKE.thanks, 'thanks'],
  ];
  const grave: [string, string, string][] = [
    ['Напис', GRAVE.text, 'text'],
    ['Загибель', GRAVE.fell, 'fell'],
    ['Покинута пригода', GRAVE.abandoned, 'abandoned'],
    ['Відповідь', GRAVE.leave, 'leave'],
    ['Екран: заголовок', GRAVE.screenTitle, 'screenTitle'],
    ['Екран: життів немає', GRAVE.screenDead, 'screenDead'],
    ['Екран: пригоду покинуто', GRAVE.screenAbandoned, 'screenAbandoned'],
  ];
  return {
    id: 'death',
    title: 'Життя й смерть',
    html: `<p>У героя ${v(LIVES.start, ['LIVES', 'start'])} життя на старті, максимум ${v(LIVES.max, ['LIVES', 'max'])} (більше — лише з квестів і рідкісних знахідок). Смерть одразу забирає життя й записує збереження — закрити гру й «переграти» не вийде. Герой прокидається в місті останнього відпочинку з прогресом того відпочинку; здобич бою, у якому він загинув, лишається в локації, доки її не пройти знову.</p>
<p>Коли життів не лишилось (або гравець покинув пригоду на паузі), пригода завершується: збереження героя видаляється, а його надгробок стає на кладовищі ${t('{town:capital:of}')} — його бачать усі наступні герої. Рекорди рахуються з надгробків.</p>
<h3 class="group">Лікар після смерті</h3>
<p class="dim small">У столиці говорить ${npcLink(WAKE.doctorNpc)}, в інших містах — ${t(WAKE.healer.name, ['WAKE', 'healer', 'name'])} (${t(WAKE.healer.title, ['WAKE', 'healer', 'title'])}). <code>{place}</code> — локація, <code>{by}</code> — хто вдарив останнім, <code>{lives}</code> — скільки життів лишилось.</p>
${table(['Що', 'Репліка'], lines.map(([k, text, key]) => [esc(k), t(text, ['WAKE', key])]), 'kv')}
<h3 class="group">Причина смерті</h3>
${table(['Причина', 'Що каже лікар'], causes, 'kv')}
<h3 class="group">Надгробок</h3>
<p class="dim small"><code>{hero}</code>, <code>{class}</code>, <code>{level}</code>, <code>{days}</code>, <code>{kills}</code>, <code>{bosses}</code>, <code>{place}</code>.</p>
${table(['Що', 'Текст'], grave.map(([k, text, key]) => [esc(k), t(text, ['GRAVE', key])]), 'kv')}`,
  };
}

// ---- Invasion ----

export function invasionSection(): Section {
  const rows = INVASION.thresholds.map((th, i) => [
    `${v(th.at, ['INVASION', 'thresholds', i, 'at'])}%`,
    `<b>${t(th.title, ['INVASION', 'thresholds', i, 'title'])}</b><div class="small">${t(th.text, ['INVASION', 'thresholds', i, 'text'])}</div>`,
  ]);
  return {
    id: 'invasion',
    title: 'Навала',
    html: `<p>Шкала навали видна на карті. Вона росте на ${v(INVASION.perDay, ['INVASION', 'perDay'])}% за день (кожна перемога — день) до 100%. Вороги й боси сильнішають разом з нею: на 100% — +${v(INVASION.strengthAt100, ['INVASION', 'strengthAt100'], 'pct')} HP і шкоди, між порогами — пропорційно.</p>
<p class="dim small">На порогах з’являється повідомлення; самі події (набіги, захоплений край, напад на місто) — етап 15, облога столиці — етап 17 (ROADMAP.md).</p>
${table(['Поріг', 'Що стається'], rows, 'kv')}`,
  };
}
