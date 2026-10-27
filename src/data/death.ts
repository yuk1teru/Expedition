// What the hero hears after waking up from a death (ROADMAP 9.5): the doctor of the town
// tells where the hero was found, what happened and how many lives are left. Lines are
// editable in the wiki; `{place}` — the location, `{by}` — who struck the last blow,
// `{lives}` — lives left. Other names — references (src/data/names.ts).

import type { NpcDef } from './npcs';

export const WAKE = {
  /** The capital's doctor treats the hero there; other towns have a healer. */
  doctorNpc: 'capitalDoctor',
  healer: { name: 'Знахарка', title: 'Лікує подорожніх', look: { body: '#6a7a4a', accent: '#d64545', hat: 'hood' } } satisfies Pick<NpcDef, 'name' | 'title' | 'look'>,
  place: 'Тихо, не підводься. Тебе винесли без тями звідти, що зветься «{place}».',
  causes: {
    melee: 'Рани глибокі, свіжі. Хто це був — {by}? Бачила я таке.',
    shotBy: 'На тобі сліди пострілів — {by}? Наступного разу не стій на одному місці.',
    shot: 'На тобі сліди пострілів. Наступного разу не стій на одному місці.',
    telegraphBy: 'Тебе накрило ударом, який видно заздалегідь, — {by}? Коли земля під ногами червоніє, з того місця треба тікати.',
    telegraph: 'Тебе накрило ударом, який видно заздалегідь. Коли земля під ногами червоніє, з того місця треба тікати.',
    hazard: 'Опіки від отрути й кислоти. Не стій у калюжах — вони їдять навіть чоботи.',
    trap: 'Нога в слідах капкана. Дивись під ноги, а не лише вперед.',
    poison: 'Отрута в крові — ледве вигнала. Протиотруту чи зілля носи з собою завжди.',
    unknown: 'Що там сталося — не знаю. Живий — і то добре.',
  },
  askQuestion: 'Що тепер?',
  lostLoot: 'Твоя здобич лишилася там. Повернешся й пройдеш те місце — забереш.',
  lives: 'Таке везіння буває не щоразу. Життів лишилось: {lives}.',
  lastLife: 'Слухай уважно: наступного разу тебе вже не відкачають. Життів лишилось: {lives}.',
  thanks: 'Дякую.',
};

/**
 * Tombstones of fallen heroes (the capital's cemetery and the screen after the last life).
 * `{hero}`, `{class}`, `{level}`, `{days}`, `{kills}`, `{bosses}`, `{place}`.
 */
export const GRAVE = {
  title: 'Надгробок',
  text: 'Тут спочиває {hero}. {class}, рівень {level}. Днів у пригоді: {days}, переможено ворогів: {kills}, босів: {bosses}.',
  fell: 'Останній бій — «{place}».',
  abandoned: 'Пригоду покинуто — «{place}».',
  leave: 'Спочивай з миром.',
  /** The screen after the last life. */
  screenTitle: 'Пригоду завершено',
  screenDead: 'Життів більше немає. Надгробок героя стоїть на кладовищі {town:capital:of}.',
  screenAbandoned: 'Герой покинув пригоду. Надгробок стоїть на кладовищі {town:capital:of}.',
};
