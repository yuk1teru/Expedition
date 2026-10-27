// NPCs and their conversations. A conversation is a small graph of nodes: each node
// has the NPC's line and the player's options; an option leads to another node and/or
// runs an action (open the shop, the update list…). New quests and story talks are
// added here: new nodes, options and actions (actions are run in src/render/townView.ts).
// Names and lines are editable in the wiki (`npm run dev`). Names inside lines are
// references ({town:capital}, {npc:capitalGuard}, {boss:enat}… — src/data/names.ts), so a
// rename changes them everywhere; `forms` hold the case forms used by such references.

import { TOWN_GROWTH } from './growth';
import { BLIND_BUYER } from './items';
import { SMITH } from './smith';
import { RECIPES } from './alchemy';
import type { ConsumableId } from './consumables';
import type { ItemSlot } from './items';
import type { NameForms } from './names';

/** What an option can do besides moving to another node. */
export type DialogueAction = 'openShop' | 'openChangelog' | 'openInventory' | 'openCoach' | 'resetTree' | 'openOrders' | 'openAlchemy' | 'openSmith' | 'sellBlind' | 'openGrowth' | 'close';

export interface DialogueOption {
  text: string;
  /** Node to show next (the conversation ends if neither `next` nor a staying action). */
  next?: string;
  action?: DialogueAction;
  /** Built in code only (quest options): runs when the option is chosen. */
  run?: () => void;
}

export interface DialogueNode {
  text: string;
  options: DialogueOption[];
}

export type NpcLookHat = 'none' | 'hood' | 'cap' | 'turban' | 'fur' | 'helm' | 'board';

/** What a merchant sells (default: the general store — magnifiers, potions, any item). */
export interface ShopDef {
  goods?: ConsumableId[];
  /** Item slots sold (an empty list — no items). */
  slots?: ItemSlot[];
}

export interface NpcDef {
  id: string;
  name: string;
  /** A merchant's goods (ROADMAP 11.7: the market's sellers each sell their own). */
  shop?: ShopDef;
  /** Case forms of the name for references in texts ({npc:id:with} → «з Тимофієм»). */
  forms?: NameForms;
  /** Role shown under the name (Торговець, Варта…). */
  title: string;
  look: { body: string; accent: string; hat: NpcLookHat };
  /** Id of the first node; `nodes.<id>`. */
  start: string;
  nodes: Record<string, DialogueNode>;
}

/** Lines shared by many NPCs (the helpers below); editing one changes all of them. */
export const NPC_LINES = {
  showOrders: 'Покажи замовлення.',
  brew: 'Звари мені щось.',
  forge: 'Підправ мені річ.',
  sellBlind: 'Купиш нерозпізнане?',
  invest: 'Вкласти золото в розвиток.',
  merchantTitle: 'Торговець',
  showGoods: 'Покажи товари.',
  aboutPlace: 'Що тут цікавого?',
  news: 'Які новини?',
  askQuest: 'Чи є для мене доручення?',
  noQuest: 'Поки що ні. Заглядай згодом — роботи на всіх вистачить.',
  bye: 'Бувай.',
  thanks: 'Дякую.',
  coachTitle: 'Візник',
  resetTree: 'Перевчи мене (скинути дерево талантів)',
  coachRide: 'Поїхали.',
};

const BYE: DialogueOption = { text: NPC_LINES.bye, action: 'close' };

/** A merchant: greeting (`hello`), the shop, one line about the place (`about`). */
function merchant(o: { id: string; name: string; forms?: NameForms; title?: string; look: NpcDef['look']; greeting: string; about: string; shop?: ShopDef }): NpcDef {
  return {
    id: o.id,
    name: o.name,
    forms: o.forms,
    shop: o.shop,
    title: o.title ?? NPC_LINES.merchantTitle,
    look: o.look,
    start: 'hello',
    nodes: {
      hello: {
        text: o.greeting,
        options: [
          { text: NPC_LINES.showGoods, action: 'openShop' },
          { text: NPC_LINES.aboutPlace, next: 'about' },
          BYE,
        ],
      },
      about: { text: o.about, options: [{ text: NPC_LINES.showGoods, action: 'openShop' }, BYE] },
    },
  };
}

/** A local with a greeting (`hello`) and a few lines of news (`news`); a place for future quests. */
function local(o: { id: string; name: string; forms?: NameForms; title: string; look: NpcDef['look']; greeting: string; news: string }): NpcDef {
  return {
    id: o.id,
    name: o.name,
    forms: o.forms,
    title: o.title,
    look: o.look,
    start: 'hello',
    nodes: {
      hello: { text: o.greeting, options: [{ text: NPC_LINES.news, next: 'news' }, { text: NPC_LINES.askQuest, next: 'quest' }, BYE] },
      news: { text: o.news, options: [{ text: NPC_LINES.askQuest, next: 'quest' }, BYE] },
      quest: { text: NPC_LINES.noQuest, options: [BYE] },
    },
  };
}

/** The artifact buyer: a local NPC with his orders (ROADMAP 14.1а). */
function buyer(o: Parameters<typeof local>[0]): NpcDef {
  const npc = local(o);
  npc.nodes.hello!.options.unshift({ text: NPC_LINES.showOrders, action: 'openOrders' });
  return npc;
}

/** A class teacher: a local NPC who also resets the talent tree (ROADMAP 12.9). */
function teacher(o: Parameters<typeof local>[0]): NpcDef {
  const npc = local(o);
  npc.nodes.hello!.options.unshift({ text: NPC_LINES.resetTree, action: 'resetTree' });
  return npc;
}

/** A coachman of the «Швидка тарадайка» (ROADMAP 10.5): the ride window opens from the talk. */
function coachman(o: { id: string; name: string; forms?: NameForms; look: NpcDef['look']; greeting: string }): NpcDef {
  return {
    id: o.id,
    name: o.name,
    forms: o.forms,
    title: NPC_LINES.coachTitle,
    look: o.look,
    start: 'hello',
    nodes: {
      hello: { text: o.greeting, options: [{ text: NPC_LINES.coachRide, action: 'openCoach' }, BYE] },
    },
  };
}

export const NPCS: Record<string, NpcDef> = {
  // ---- Візники (у кожному місті) ----
  capitalCoach: coachman({
    id: 'capitalCoach',
    name: 'Остап',
    forms: { to: 'Остапові', with: 'Остапом', of: 'Остапа' },
    look: { body: '#6a4a2a', accent: '#c8a050', hat: 'cap' },
    greeting: '«Швидка тарадайка» до ваших послуг! Вожу лише туди, де ти вже бував сам: дороги там знайомі, а коні — ні.',
  }),
  portCoach: coachman({
    id: 'portCoach',
    name: 'Левко',
    forms: { to: 'Левкові', with: 'Левком', of: 'Левка' },
    look: { body: '#4a5a6a', accent: '#c8a050', hat: 'cap' },
    greeting: 'Сідай, поки коні не передумали. Від моря — куди скажеш, якщо ти там уже бував.',
  }),
  forestCoach: coachman({
    id: 'forestCoach',
    name: 'Панас',
    forms: { to: 'Панасові', with: 'Панасом', of: 'Панаса' },
    look: { body: '#3a5a2a', accent: '#c8a050', hat: 'fur' },
    greeting: 'Через Ліс їжджу тільки вдень і тільки битою дорогою. Тобі куди?',
  }),
  swampCoach: coachman({
    id: 'swampCoach',
    name: 'Охрім',
    forms: { to: 'Охрімові', with: 'Охрімом', of: 'Охріма' },
    look: { body: '#3a4a3a', accent: '#c8a050', hat: 'hood' },
    greeting: 'Колеса в багні не тонуть — я їх заговорив. Ну, майже не тонуть.',
  }),
  desertCoach: coachman({
    id: 'desertCoach',
    name: 'Назар',
    forms: { to: 'Назарові', with: 'Назаром', of: 'Назара' },
    look: { body: '#a87a3a', accent: '#c8a050', hat: 'turban' },
    greeting: 'Верблюдів не маю, зате маю тарадайку. Пісок у колесах — за мій рахунок.',
  }),
  iceCoach: coachman({
    id: 'iceCoach',
    name: 'Кирило',
    forms: { to: 'Кирилові', with: 'Кирилом', of: 'Кирила' },
    look: { body: '#6a7a8a', accent: '#c8a050', hat: 'fur' },
    greeting: 'Полози замість коліс — і жодного перевалу пішки. Тільки туди, де ти вже бував.',
  }),
  // ---- Столиця ----
  capitalMerchant: merchant({
    id: 'capitalMerchant',
    name: 'Мирослава',
    forms: { to: 'Мирославі', with: 'Мирославою', of: 'Мирослави' },
    look: { body: '#7a4a8a', accent: '#f2c14e', hat: 'cap' },
    title: 'Лавка дрібниць',
    shop: { goods: ['magnifier', 'potionSmall'], slots: [] },
    greeting: 'Вітаю в столиці, мандрівнику! {town:capital} гостей любить. Лупи для нерозпізнаних речей і мале зілля в дорогу — у мене. Зброя й броня — у сусідніх рядах.',
    about: 'Зі столиці дороги ведуть у всі краї: на південь — Ліс, на захід — {town:port}, на північ — гори й Крига.',
  }),
  capitalSmith: merchant({
    id: 'capitalSmith',
    name: 'Дмитро',
    forms: { to: 'Дмитрові', with: 'Дмитром', of: 'Дмитра' },
    title: 'Зброяр',
    shop: { goods: [], slots: ['weapon'] },
    look: { body: '#4a3a32', accent: '#c0c6d0', hat: 'none' },
    greeting: 'Мечі, луки, палиці — що в руку ляже. Гостре, бо сам точу.',
    about: 'Звірі тепер товстошкірі, як ніколи. Звичайна сокира вже не бере — бери кращу.',
  }),
  capitalArmorer: merchant({
    id: 'capitalArmorer',
    name: 'Гліб',
    forms: { to: 'Глібові', with: 'Глібом', of: 'Гліба' },
    title: 'Бронник',
    shop: { goods: [], slots: ['hat', 'armor', 'boots'] },
    look: { body: '#5a5a62', accent: '#a8a8b0', hat: 'helm' },
    greeting: 'Шолом, обладунок, чоботи. Голова, тулуб і ноги — решту бережи сам.',
    about: 'Варта бере в мене кольчуги дюжинами. Кажуть, на перевалі вже й сталь мерзне.',
  }),
  capitalHerbalist: merchant({
    id: 'capitalHerbalist',
    name: 'Олеся',
    forms: { to: 'Олесі', with: 'Олесею', of: 'Олесі' },
    title: 'Травниця',
    shop: { goods: ['potionSmall', 'potionMedium', 'potionLarge'], slots: [] },
    look: { body: '#4a6a3a', accent: '#e05a5a', hat: 'hood' },
    greeting: 'Зілля на всі рани, крім розбитого серця. Від нього — тільки час.',
    about: 'Трави в полі ще ростуть, але збирати їх стало небезпечно. Тому й ціни такі.',
  }),
  capitalBaker: local({
    id: 'capitalBaker',
    name: 'Явдоха',
    forms: { to: 'Явдосі', with: 'Явдохою', of: 'Явдохи' },
    title: 'Пекарка',
    look: { body: '#c8b898', accent: '#f2c14e', hat: 'cap' },
    greeting: 'Свіжий хліб! Борошно тепер возять тільки з охороною — тож і хліб дорожчає.',
    news: 'Мельник із Королівських полів каже: вночі вовки ходять колом навколо млина. Не нападають — наче чекають наказу.',
  }),
  capitalFish: local({
    id: 'capitalFish',
    name: 'Федір',
    forms: { to: 'Федорові', with: 'Федором', of: 'Федора' },
    title: 'Рибна лавка',
    look: { body: '#3a5a6a', accent: '#c0c6d0', hat: 'cap' },
    greeting: 'Риба з {town:port:of}, свіжа — вчорашня. Сьогоднішньої немає: море не пускає.',
    news: 'Рибалки бачили чорні вітрила на обрії. Ніхто не знає, чиї. Але риба від них тікає — це я тобі точно скажу.',
  }),
  capitalBarman: local({
    id: 'capitalBarman',
    name: 'Захар',
    forms: { to: 'Захарові', with: 'Захаром', of: 'Захара' },
    title: 'Бармен',
    look: { body: '#6a4a2a', accent: '#e8e4dc', hat: 'none' },
    greeting: 'Наливати? Кімнати нагорі завжди готові — відпочинеш, як у себе вдома. А чутки — безкоштовно, якщо слухаєш уважно.',
    news: 'Вартові п’ють тут після зміни. Кажуть, мертві з-під собору не сплять — шкребуться. А ще кажуть, {npc:artifactBuyer} купує уламки печатки. Навіщо торговцю печатка, га?',
  }),
  capitalOrysia: local({
    id: 'capitalOrysia',
    name: 'Орися',
    forms: { to: 'Орисі', with: 'Орисею', of: 'Орисі' },
    title: 'Містянка',
    look: { body: '#8a5a7a', accent: '#f4e4c0', hat: 'hood' },
    greeting: 'Ой, гість! Вибач за безлад — чоловік у варті, днями не буває вдома.',
    news: 'Мій Остап каже, що на мурах тепер чергують і вночі. Раніше такого не було навіть за війни.',
  }),
  capitalMatvii: local({
    id: 'capitalMatvii',
    name: 'Матвій',
    forms: { to: 'Матвієві', with: 'Матвієм', of: 'Матвія' },
    title: 'Старий коваль',
    look: { body: '#5a4a3a', accent: '#a8a8b0', hat: 'none' },
    greeting: 'Сорок років кував для варти. Горн за хатою ще теплий — принось, що треба підправити.',
    news: 'Коли я був малим, {boss:enat} приходив до краю лісу, і діти носили йому яблука. А тепер — вовки й коріння. Щось його отруїло, кажу тобі.',
  }),
  capitalKid: local({
    id: 'capitalKid',
    name: 'Тарасик',
    forms: { to: 'Тарасикові', with: 'Тарасиком', of: 'Тарасика' },
    title: 'Хлопчик',
    look: { body: '#6a8aa8', accent: '#f2c14e', hat: 'cap' },
    greeting: 'Ти справжній мандрівник? З мечем і все? Я теж буду, коли виросту!',
    news: 'Я бачив, як біля фонтана кіт перебіг дорогу капітанові варти. Капітан плюнув через плече. Тричі!',
  }),
  capitalGuard: local({
    id: 'capitalGuard',
    name: 'Тимофій',
    forms: { to: 'Тимофію', with: 'Тимофієм', of: 'Тимофія' },
    title: 'Капітан варти',
    look: { body: '#5b6b8a', accent: '#c0c6d0', hat: 'helm' },
    greeting: 'Тримай меч напоготові: за брамою неспокійно.',
    news: 'Ще торік вовки обходили людей стороною, а тепер нападають самі. {boss:enat} прокинувся в лісі, через гірський перевал знову лізе холод. Кажуть, у Кризі хтось командує морозом.',
  }),
  capitalAdvisor: local({
    id: 'capitalAdvisor',
    name: 'Велемир',
    forms: { to: 'Велемирові', with: 'Велемиром', of: 'Велемира' },
    title: 'Королівський радник',
    look: { body: '#3a3a6a', accent: '#f2c14e', hat: 'cap' },
    greeting: 'Король хворий, тож говори зі мною. Ти з тієї експедиції, що розбилася біля берега?',
    news: 'Звірі змінилися минулої осені — усі разом, ніби хтось їх покликав. Отець {npc:capitalPriest} знає про це більше, ніж хоче казати.',
  }),
  capitalPriest: local({
    id: 'capitalPriest',
    name: 'Мирон',
    forms: { to: 'Миронові', with: 'Мироном', of: 'Мирона' },
    title: 'Настоятель собору',
    look: { body: '#e8e4d8', accent: '#f2c14e', hat: 'hood' },
    greeting: 'Мир тобі. {name:church} відчинений для всіх — і для живих, і для тих, хто вже ні.',
    news: 'Під собором лежить печатка {name:goddess:of}, що замикає {name:dead}. Вона тріснула. Крізь тріщину сочиться аура {name:lord:of} — і звірі шаленіють.',
  }),
  artifactBuyer: buyer({
    id: 'artifactBuyer',
    name: 'Ізидор',
    forms: { to: 'Ізидорові', with: 'Ізидором', of: 'Ізидора' },
    title: 'Скупник артефактів',
    look: { body: '#5a3a6a', accent: '#d4a5ff', hat: 'turban' },
    greeting: 'Трофеї? Реліквії? Торговець дасть тобі мідяки. Я плачу за рідкісне — і скажу, де його шукати.',
    news: 'Шукаю уламки старої печатки з рунами. Не питай навіщо. Плачу більше за всіх у {name:kingdom:in}.',
  }),
  tavernWanderer: local({
    id: 'tavernWanderer',
    name: 'Гордій',
    forms: { to: 'Гордієві', with: 'Гордієм', of: 'Гордія' },
    title: 'Мандрівник',
    look: { body: '#6a5a4a', accent: '#c9a36b', hat: 'hood' },
    greeting: 'Сідай, наливай. Я обійшов увесь {name:kingdom} — і бачив речі, яких ти не побачиш.',
    news: 'Відколи печатка тріснула, душі звірів не йдуть у {name:dead}. Блукають біля тіл. Хто має рунічний камінь, той може їх зловити.',
  }),
  capitalDoctor: local({
    id: 'capitalDoctor',
    name: 'Злата',
    forms: { to: 'Златі', with: 'Златою', of: 'Злати' },
    title: 'Лікарка',
    look: { body: '#e8ecf4', accent: '#d64545', hat: 'cap' },
    greeting: 'Поранений? Сідай. Якщо колись тебе принесуть сюди без тями — не дивуйся, я вже бачила й не таке.',
    news: 'Рани від звірів тепер гояться погано, ніби в них лишається щось холодне. Отець {npc:capitalPriest} каже — це аура. А я кажу: з частин тих самих звірів можна зварити еліксир, що повертає з-за межі. Шукаю рецепт.',
  }),
  warriorTeacher: teacher({
    id: 'warriorTeacher',
    name: 'Святослав',
    forms: { to: 'Святославові', with: 'Святославом', of: 'Святослава' },
    title: 'Вчитель воїнів',
    look: { body: '#8a3a2a', accent: '#c0c6d0', hat: 'helm' },
    greeting: 'Меч — це не сила. Меч — це звичка. Приходь, коли захочеш звикнути краще.',
    news: 'На перевалі стоїть {boss:frostWarden}. Колись він був одним із нас.',
  }),
  mageTeacher: teacher({
    id: 'mageTeacher',
    name: 'Веда',
    forms: { to: 'Веді', with: 'Ведою', of: 'Веди' },
    title: 'Вчителька чарівників',
    look: { body: '#3a4a8a', accent: '#bfe6ff', hat: 'hood' },
    greeting: 'Вогонь, вода, вітер, земля — чотири мови. Більшість магів знає одну. Ти скільки?',
    news: 'Вітер б’є лід, вода гасить вогонь. Звірі Болота не бояться отрути, а пустельні — вогню. Пам’ятай про це.',
  }),
  archerTeacher: teacher({
    id: 'archerTeacher',
    name: 'Ружа',
    forms: { to: 'Ружі', with: 'Ружею', of: 'Ружі' },
    title: 'Вчителька лучників',
    look: { body: '#3a6a3a', accent: '#9fdf7a', hat: 'hood' },
    greeting: 'Тятиву тягнуть не руки, а спина. Покажи, як стоїш.',
    news: 'Стріли з вогнем, кригою, вітром чи отрутою — кожна для свого звіра. Одна стріла на все — це для ледачих.',
  }),
  noticeBoard: {
    id: 'noticeBoard',
    name: 'Дошка оголошень',
    title: 'Новини королівства',
    look: { body: '#8a6a44', accent: '#e8d5a3', hat: 'board' },
    start: 'hello',
    nodes: {
      hello: {
        text: 'На дошці приколоті листи: укази, оголошення, списки змін у королівстві.',
        options: [{ text: 'Прочитати новини (що нового).', action: 'openChangelog' }, { text: 'Відійти.', action: 'close' }],
      },
    },
  },
  forestBoard: {
    id: 'forestBoard',
    name: 'Дошка доручень',
    title: 'Смерекове',
    look: { body: '#7a5a3a', accent: '#c9a36b', hat: 'board' },
    start: 'hello',
    nodes: {
      hello: {
        text: 'На дошці біля криниці мисливці й лісоруби лишають доручення — і плату за них.',
        options: [{ text: 'Відійти.', action: 'close' }],
      },
    },
  },
  // ---- Порт ----
  portMerchant: merchant({
    id: 'portMerchant',
    name: 'Корній',
    forms: { to: 'Корнієві', with: 'Корнієм', of: 'Корнія' },
    look: { body: '#3b6a8a', accent: '#e8ecf4', hat: 'cap' },
    greeting: 'Свіжий вітер і свіжий товар! Бери, поки кораблі не розібрали.',
    about: 'Кораблі зараз стоять: море неспокійне. Колись звідси попливемо далеко — побачиш.',
  }),
  portFisher: local({
    id: 'portFisher',
    name: 'Мартин',
    forms: { to: 'Мартинові', with: 'Мартином', of: 'Мартина' },
    title: 'Рибалка',
    look: { body: '#4a6a5a', accent: '#c9b98a', hat: 'hood' },
    greeting: 'Живий? Ми тебе з води витягли — думали, вже по тобі.',
    news: 'Чайки завжди крали в нас рибу — та й по всьому. А цієї осені кидаються на людей, і краби з ними. Старі кажуть: зі сходу, від столиці, тягне чимось недобрим. На прибережній дорозі будь пильним, а до крабів голіруч не лізь — вони тверді.',
  }),
  portKeeper: local({
    id: 'portKeeper',
    name: 'Северин',
    forms: { to: 'Северинові', with: 'Северином', of: 'Северина' },
    title: 'Доглядач маяка',
    look: { body: '#5a5a6a', accent: '#f2c14e', hat: 'cap' },
    greeting: 'Маяк горить щоночі. Хоч кораблів і нема, а світло мусить бути.',
    news: 'Минулого тижня бачив корабель без жодного вогника. Ні весел, ні людей — тільки чорні вітрила. І риба відтоді не йде до берега: тікає від чогось, що сильніше за мій маяк.',
  }),
  // ---- Ліс ----
  forestMerchant: merchant({
    id: 'forestMerchant',
    name: 'Ялина',
    forms: { to: 'Ялині', with: 'Ялиною', of: 'Ялини' },
    look: { body: '#3a6a3a', accent: '#9fdf7a', hat: 'hood' },
    greeting: 'Мисливці з лісу носять мені що попало. Може, й тобі щось згодиться?',
    about: 'Далі на південь — Сухе узлісся і Пустеля, на схід — Мокролісся і Болото. А в Темній гущавині спить {boss:enat}.',
  }),
  forestHunter: local({
    id: 'forestHunter',
    name: 'Богдан',
    forms: { to: 'Богданові', with: 'Богданом', of: 'Богдана' },
    title: 'Мисливець',
    look: { body: '#5a4a2a', accent: '#c9a36b', hat: 'fur' },
    greeting: 'Тихо. Вовки чують навіть думки.',
    news: '{boss:enat} кличе вовків, коли злий. Як побачиш коріння під ногами — тікай з кола.',
  }),
  forestSmith: local({
    id: 'forestSmith',
    name: 'Остап',
    forms: { to: 'Остапові', with: 'Остапом', of: 'Остапа' },
    title: 'Коваль',
    look: { body: '#4a3a32', accent: '#e07a5f', hat: 'none' },
    greeting: 'Кузню поставили — тепер і в лісі є кому підкувати. Що принесли?',
    news: 'Учився в {npc:capitalMatvii:of}. Каже, сокиру треба гострити, як вовка годувати: щодня й обережно.',
  }),
  forestElder: local({
    id: 'forestElder',
    name: 'Микола',
    forms: { to: 'Миколі', with: 'Миколою', of: 'Миколи' },
    title: 'Староста',
    look: { body: '#6a5a3a', accent: '#e8d5a3', hat: 'none' },
    greeting: '{town:forestTown} — село мисливців і лісорубів. Чужих не любимо, але й не женемо.',
    news: 'Мій дід бачив, як {boss:enat} лікував пораненого оленя. А тепер він кидає на нас вовків. Щось його отруїло.',
  }),
  // ---- Болото ----
  swampMerchant: merchant({
    id: 'swampMerchant',
    name: 'Оксана',
    forms: { to: 'Оксані', with: 'Оксаною', of: 'Оксани' },
    look: { body: '#4a6a4a', accent: '#8fd16a', hat: 'hood' },
    greeting: 'Травниця на палях вітає тебе. Зілля в мене пахне болотом, але лікує.',
    about: 'Слизні діляться навпіл, а {boss:poisonMother} плює отрутою. Калюж обходь.',
  }),
  swampBoatman: local({
    id: 'swampBoatman',
    name: 'Гнат',
    forms: { to: 'Гнатові', with: 'Гнатом', of: 'Гната' },
    title: 'Човняр',
    look: { body: '#3a4a3a', accent: '#a7e08a', hat: 'cap' },
    greeting: 'Без човна тут і кроку не ступиш.',
    news: 'Токсична хвиля Матері йде колом — пішки не втечеш. Стрибай крізь неї.',
  }),
  swampWitch: local({
    id: 'swampWitch',
    name: 'Мотря',
    forms: { to: 'Мотрі', with: 'Мотрею', of: 'Мотрі' },
    title: 'Знахарка',
    look: { body: '#4a3a5a', accent: '#a7e08a', hat: 'hood' },
    greeting: 'Не бійся, я не кусаюсь. На відміну від жаб.',
    news: '{boss:poisonMother} колись чистила воду своєю отрутою — отрута проти отрути. Тепер вона забула, для чого жила.',
  }),
  // ---- Пустеля ----
  desertMerchant: merchant({
    id: 'desertMerchant',
    name: 'Карім',
    forms: { to: 'Карімові', with: 'Карімом', of: 'Каріма' },
    look: { body: '#a0703a', accent: '#f2d16b', hat: 'turban' },
    greeting: 'Мир тобі, мандрівнику. Вода дорога, а товар — ще дорожчий.',
    about: '{boss:sandWorm} ховається під пісок. Коли земля під тобою червоніє — біжи.',
  }),
  desertCaravan: local({
    id: 'desertCaravan',
    name: 'Сабіна',
    forms: { to: 'Сабіні', with: 'Сабіною', of: 'Сабіни' },
    title: 'Караванниця',
    look: { body: '#8a5a3a', accent: '#e8c48a', hat: 'turban' },
    greeting: 'Каравани ходять рідко: скорпіони обнагліли.',
    news: 'Кактуси стріляють колючками віялом, а скарабеї розпадаються на малих. Не стій на місці.',
  }),
  desertWater: local({
    id: 'desertWater',
    name: 'Тарас',
    forms: { to: 'Тарасові', with: 'Тарасом', of: 'Тараса' },
    title: 'Водонос',
    look: { body: '#8a6a4a', accent: '#7ec8e3', hat: 'turban' },
    greeting: 'Води? Ковток — мідяк. Ціла бочка — ціле життя.',
    news: 'Оаза міліє. {boss:sandWorm} стеріг підземні річки, а тепер, кажуть, п’є їх сам.',
  }),
  // ---- Крига ----
  iceMerchant: merchant({
    id: 'iceMerchant',
    name: 'Сніжан',
    forms: { to: 'Сніжанові', with: 'Сніжаном', of: 'Сніжана' },
    look: { body: '#5a7a9a', accent: '#d8f0ff', hat: 'fur' },
    greeting: 'Заходь, грійся. Товар у мене морожений, але справний.',
    about: '{boss:iceKnight} таранить до самої стіни, а кільце шипів має проходи — шукай їх.',
  }),
  iceSeeker: local({
    id: 'iceSeeker',
    name: 'Ярема',
    forms: { to: 'Яремі', with: 'Яремою', of: 'Яреми' },
    title: 'Шукач',
    look: { body: '#4a5a6a', accent: '#bfe6ff', hat: 'fur' },
    greeting: 'Перевал пройшов? Значить, не з полохливих.',
    news: 'Цитадель стоїть на краю світу. Кажуть, лицар колись був людиною.',
  }),
  iceSmith: local({
    id: 'iceSmith',
    name: 'Ганна',
    forms: { to: 'Ганні', with: 'Ганною', of: 'Ганни' },
    title: 'Ковалиха',
    look: { body: '#6a4a3a', accent: '#e07a5f', hat: 'fur' },
    greeting: 'Тут навіть ковадло мерзне. Але залізо слухається — якщо знати як.',
    news: 'Крижані кристали горять у горні синім полум’ям. Принесеш — скую щось добре. Колись.',
  }),
};

// Town stewards (ROADMAP 15.4): gold invested in the town.
for (const g of Object.values(TOWN_GROWTH)) {
  const npc = NPCS[g.steward];
  npc?.nodes[npc.start]?.options.unshift({ text: NPC_LINES.invest, action: 'openGrowth' });
}

// The buyer of unidentified items (ROADMAP 14.6).
for (const id of BLIND_BUYER.at) {
  const npc = NPCS[id];
  npc?.nodes[npc.start]?.options.unshift({ text: NPC_LINES.sellBlind, action: 'sellBlind' });
}

// Smiths (ROADMAP 14.4): the forge first in the talk.
for (const id of SMITH.at) {
  const npc = NPCS[id];
  npc?.nodes[npc.start]?.options.unshift({ text: NPC_LINES.forge, action: 'openSmith' });
}

// Brewers (ROADMAP 14.2): whoever brews a recipe offers it first in the talk.
for (const id of new Set(RECIPES.flatMap((r) => r.at))) {
  const npc = NPCS[id];
  npc?.nodes[npc.start]?.options.unshift({ text: NPC_LINES.brew, action: 'openAlchemy' });
}

export function getNpc(id: string): NpcDef {
  const n = NPCS[id];
  if (!n) throw new Error(`Unknown NPC: ${id}`);
  return n;
}
