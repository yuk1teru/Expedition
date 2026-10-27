// NPCs and their conversations. A conversation is a small graph of nodes: each node
// has the NPC's line and the player's options; an option leads to another node and/or
// runs an action (open the shop, the update list…). New quests and story talks are
// added here: new nodes, options and actions (actions are run in src/render/townView.ts).

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

const BYE: DialogueOption = { text: 'Бувай.', action: 'close' };

/** A merchant: greeting, the shop, one line about the place. */
function merchant(id: string, name: string, look: NpcDef['look'], greeting: string, about: string): NpcDef {
  return {
    id,
    name,
    title: 'Торговець',
    look,
    start: 'hello',
    nodes: {
      hello: {
        text: greeting,
        options: [
          { text: 'Покажи товари.', action: 'openShop' },
          { text: 'Що тут цікавого?', next: 'about' },
          BYE,
        ],
      },
      about: { text: about, options: [{ text: 'Покажи товари.', action: 'openShop' }, BYE] },
    },
  };
}

/** A local with a few lines of news (a place for future quests). */
function local(id: string, name: string, title: string, look: NpcDef['look'], greeting: string, news: string): NpcDef {
  return {
    id,
    name,
    title,
    look,
    start: 'hello',
    nodes: {
      hello: { text: greeting, options: [{ text: 'Які новини?', next: 'news' }, { text: 'Чи є для мене доручення?', next: 'quest' }, BYE] },
      news: { text: news, options: [{ text: 'Чи є для мене доручення?', next: 'quest' }, BYE] },
      quest: { text: 'Поки що ні. Заглядай згодом — роботи на всіх вистачить.', options: [BYE] },
    },
  };
}

export const NPCS: Record<string, NpcDef> = {
  // Златоград
  capitalMerchant: merchant('capitalMerchant', 'Мирослава', { body: '#7a4a8a', accent: '#f2c14e', hat: 'cap' },
    'Вітаю в Златограді, мандрівнику! Лупи, зілля, а якщо гаманець важкий — і річ під твій слот.',
    'Зі столиці дороги ведуть у всі краї: на південь — Ліс, на захід — порт, на північ — гори й Крига.'),
  capitalGuard: local('capitalGuard', 'Остап', 'Капітан варти', { body: '#5b6b8a', accent: '#c0c6d0', hat: 'helm' },
    'Тримай меч напоготові: за брамою неспокійно.',
    'Старий Енат прокинувся в лісі, а через гірський перевал знову лізе холод. Кажуть, у Кризі хтось командує морозом.'),
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
  portMerchant: merchant('portMerchant', 'Корній', { body: '#3b6a8a', accent: '#e8ecf4', hat: 'cap' },
    'Свіжий вітер і свіжий товар! Бери, поки кораблі не розібрали.',
    'Кораблі зараз стоять: море неспокійне. Колись звідси попливемо далеко — побачиш.'),
  portFisher: local('portFisher', 'Мартин', 'Рибалка', { body: '#4a6a5a', accent: '#c9b98a', hat: 'hood' },
    'Клює погано, зате чайки жеруть усе підряд.',
    'На прибережній дорозі чайки-розбійниці й краби. Краби — тверді, не лізь до них голіруч.'),
  // Смерекове
  forestMerchant: merchant('forestMerchant', 'Ялина', { body: '#3a6a3a', accent: '#9fdf7a', hat: 'hood' },
    'Мисливці з лісу носять мені що попало. Може, й тобі щось згодиться?',
    'Далі на південь — Сухе узлісся і Пустеля, на схід — Мокролісся і Болото. А в Темній гущавині спить Енат.'),
  forestHunter: local('forestHunter', 'Богдан', 'Мисливець', { body: '#5a4a2a', accent: '#c9a36b', hat: 'fur' },
    'Тихо. Вовки чують навіть думки.',
    'Енат кличе вовків, коли злий. Як побачиш коріння під ногами — тікай з кола.'),
  // Очеретянка
  swampMerchant: merchant('swampMerchant', 'Оксана', { body: '#4a6a4a', accent: '#8fd16a', hat: 'hood' },
    'Травниця на палях вітає тебе. Зілля в мене пахне болотом, але лікує.',
    'Слизні діляться навпіл, а Отруйна Мати плює отрутою. Калюж обходь.'),
  swampBoatman: local('swampBoatman', 'Гнат', 'Човняр', { body: '#3a4a3a', accent: '#a7e08a', hat: 'cap' },
    'Без човна тут і кроку не ступиш.',
    'Токсична хвиля Матері йде колом — пішки не втечеш. Стрибай крізь неї.'),
  // Барханськ
  desertMerchant: merchant('desertMerchant', 'Карім', { body: '#a0703a', accent: '#f2d16b', hat: 'turban' },
    'Мир тобі, мандрівнику. Вода дорога, а товар — ще дорожчий.',
    'Хробак ховається під пісок. Коли земля під тобою червоніє — біжи.'),
  desertCaravan: local('desertCaravan', 'Сабіна', 'Караванниця', { body: '#8a5a3a', accent: '#e8c48a', hat: 'turban' },
    'Каравани ходять рідко: скорпіони обнагліли.',
    'Кактуси стріляють колючками віялом, а скарабеї розпадаються на малих. Не стій на місці.'),
  // Сніжногір'я
  iceMerchant: merchant('iceMerchant', 'Сніжан', { body: '#5a7a9a', accent: '#d8f0ff', hat: 'fur' },
    'Заходь, грійся. Товар у мене морожений, але справний.',
    'Крижаний Лицар таранить до самої стіни, а кільце шипів має проходи — шукай їх.'),
  iceSeeker: local('iceSeeker', 'Ярема', 'Шукач', { body: '#4a5a6a', accent: '#bfe6ff', hat: 'fur' },
    'Перевал пройшов? Значить, не з полохливих.',
    'Цитадель стоїть на краю світу. Кажуть, лицар колись був людиною.'),
};

export function getNpc(id: string): NpcDef {
  const n = NPCS[id];
  if (!n) throw new Error(`Unknown NPC: ${id}`);
  return n;
}
