// NPCs and their conversations. A conversation is a small graph of nodes: each node
// has the NPC's line and the player's options; an option leads to another node and/or
// runs an action (open the shop, the update list…). New quests and story talks are
// added here: new nodes, options and actions (actions are run in src/render/townView.ts).
// Names and lines are editable in the wiki (`npm run dev`).

/** What an option can do besides moving to another node. */
export type DialogueAction = 'openShop' | 'openChangelog' | 'openInventory' | 'close';

export interface DialogueOption {
  text: string;
  /** Node to show next (the conversation ends if neither `next` nor a staying action). */
  next?: string;
  action?: DialogueAction;
}

export interface DialogueNode {
  text: string;
  options: DialogueOption[];
}

export type NpcLookHat = 'none' | 'hood' | 'cap' | 'turban' | 'fur' | 'helm' | 'board';

export interface NpcDef {
  id: string;
  name: string;
  /** Role shown under the name (Торговець, Варта…). */
  title: string;
  look: { body: string; accent: string; hat: NpcLookHat };
  /** Id of the first node; `nodes.<id>`. */
  start: string;
  nodes: Record<string, DialogueNode>;
}

/** Lines shared by many NPCs (the helpers below); editing one changes all of them. */
export const NPC_LINES = {
  merchantTitle: 'Торговець',
  showGoods: 'Покажи товари.',
  aboutPlace: 'Що тут цікавого?',
  news: 'Які новини?',
  askQuest: 'Чи є для мене доручення?',
  noQuest: 'Поки що ні. Заглядай згодом — роботи на всіх вистачить.',
  bye: 'Бувай.',
};

const BYE: DialogueOption = { text: NPC_LINES.bye, action: 'close' };

/** A merchant: greeting (`hello`), the shop, one line about the place (`about`). */
function merchant(o: { id: string; name: string; look: NpcDef['look']; greeting: string; about: string }): NpcDef {
  return {
    id: o.id,
    name: o.name,
    title: NPC_LINES.merchantTitle,
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
function local(o: { id: string; name: string; title: string; look: NpcDef['look']; greeting: string; news: string }): NpcDef {
  return {
    id: o.id,
    name: o.name,
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

export const NPCS: Record<string, NpcDef> = {
  // Златоград
  capitalMerchant: merchant({
    id: 'capitalMerchant',
    name: 'Мирослава',
    look: { body: '#7a4a8a', accent: '#f2c14e', hat: 'cap' },
    greeting: 'Вітаю в Златограді, мандрівнику! Лупи, зілля, а якщо гаманець важкий — і річ під твій слот.',
    about: 'Зі столиці дороги ведуть у всі краї: на південь — Ліс, на захід — порт, на північ — гори й Крига.',
  }),
  capitalGuard: local({
    id: 'capitalGuard',
    name: 'Остап',
    title: 'Капітан варти',
    look: { body: '#5b6b8a', accent: '#c0c6d0', hat: 'helm' },
    greeting: 'Тримай меч напоготові: за брамою неспокійно.',
    news: 'Старий Енат прокинувся в лісі, а через гірський перевал знову лізе холод. Кажуть, у Кризі хтось командує морозом.',
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
  // Чайкова Гавань
  portMerchant: merchant({
    id: 'portMerchant',
    name: 'Корній',
    look: { body: '#3b6a8a', accent: '#e8ecf4', hat: 'cap' },
    greeting: 'Свіжий вітер і свіжий товар! Бери, поки кораблі не розібрали.',
    about: 'Кораблі зараз стоять: море неспокійне. Колись звідси попливемо далеко — побачиш.',
  }),
  portFisher: local({
    id: 'portFisher',
    name: 'Мартин',
    title: 'Рибалка',
    look: { body: '#4a6a5a', accent: '#c9b98a', hat: 'hood' },
    greeting: 'Клює погано, зате чайки жеруть усе підряд.',
    news: 'На прибережній дорозі чайки-розбійниці й краби. Краби — тверді, не лізь до них голіруч.',
  }),
  // Смерекове
  forestMerchant: merchant({
    id: 'forestMerchant',
    name: 'Ялина',
    look: { body: '#3a6a3a', accent: '#9fdf7a', hat: 'hood' },
    greeting: 'Мисливці з лісу носять мені що попало. Може, й тобі щось згодиться?',
    about: 'Далі на південь — Сухе узлісся і Пустеля, на схід — Мокролісся і Болото. А в Темній гущавині спить Енат.',
  }),
  forestHunter: local({
    id: 'forestHunter',
    name: 'Богдан',
    title: 'Мисливець',
    look: { body: '#5a4a2a', accent: '#c9a36b', hat: 'fur' },
    greeting: 'Тихо. Вовки чують навіть думки.',
    news: 'Енат кличе вовків, коли злий. Як побачиш коріння під ногами — тікай з кола.',
  }),
  // Очеретянка
  swampMerchant: merchant({
    id: 'swampMerchant',
    name: 'Оксана',
    look: { body: '#4a6a4a', accent: '#8fd16a', hat: 'hood' },
    greeting: 'Травниця на палях вітає тебе. Зілля в мене пахне болотом, але лікує.',
    about: 'Слизні діляться навпіл, а Отруйна Мати плює отрутою. Калюж обходь.',
  }),
  swampBoatman: local({
    id: 'swampBoatman',
    name: 'Гнат',
    title: 'Човняр',
    look: { body: '#3a4a3a', accent: '#a7e08a', hat: 'cap' },
    greeting: 'Без човна тут і кроку не ступиш.',
    news: 'Токсична хвиля Матері йде колом — пішки не втечеш. Стрибай крізь неї.',
  }),
  // Барханськ
  desertMerchant: merchant({
    id: 'desertMerchant',
    name: 'Карім',
    look: { body: '#a0703a', accent: '#f2d16b', hat: 'turban' },
    greeting: 'Мир тобі, мандрівнику. Вода дорога, а товар — ще дорожчий.',
    about: 'Хробак ховається під пісок. Коли земля під тобою червоніє — біжи.',
  }),
  desertCaravan: local({
    id: 'desertCaravan',
    name: 'Сабіна',
    title: 'Караванниця',
    look: { body: '#8a5a3a', accent: '#e8c48a', hat: 'turban' },
    greeting: 'Каравани ходять рідко: скорпіони обнагліли.',
    news: 'Кактуси стріляють колючками віялом, а скарабеї розпадаються на малих. Не стій на місці.',
  }),
  // Сніжногір'я
  iceMerchant: merchant({
    id: 'iceMerchant',
    name: 'Сніжан',
    look: { body: '#5a7a9a', accent: '#d8f0ff', hat: 'fur' },
    greeting: 'Заходь, грійся. Товар у мене морожений, але справний.',
    about: 'Крижаний Лицар таранить до самої стіни, а кільце шипів має проходи — шукай їх.',
  }),
  iceSeeker: local({
    id: 'iceSeeker',
    name: 'Ярема',
    title: 'Шукач',
    look: { body: '#4a5a6a', accent: '#bfe6ff', hat: 'fur' },
    greeting: 'Перевал пройшов? Значить, не з полохливих.',
    news: 'Цитадель стоїть на краю світу. Кажуть, лицар колись був людиною.',
  }),
};

export function getNpc(id: string): NpcDef {
  const n = NPCS[id];
  if (!n) throw new Error(`Unknown NPC: ${id}`);
  return n;
}
