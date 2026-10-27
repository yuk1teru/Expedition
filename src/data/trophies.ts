// Trophies: loot from monsters (one kind per enemy; minibosses and bosses drop rare ones)
// and relics found in treasure arenas. Merchants buy them; the alchemist and quests use
// them; the artifact buyer in the capital pays much more for what his orders ask.
// Drops, the bag and selling: systems/trophies.ts (ROADMAP 14.1).

export type TrophyKind = 'common' | 'rare' | 'boss' | 'relic';

export interface TrophyDef {
  id: string;
  name: string;
  kind: TrophyKind;
  /** Enemy / miniboss / boss ids that drop it; for relics — regions where they are found. */
  from: string[];
  /** Drop chance per kill (relics: per treasure arena). */
  chance: number;
  /** What a merchant pays, gold. */
  price: number;
  description: string;
}

/** Colours of the kinds (bag, battle). */
export const TROPHY_COLORS: Record<TrophyKind, string> = { common: '#c9b48a', rare: '#5aa9ff', boss: '#ffb340', relic: '#c58cff' };

export const TROPHY_KIND_NAMES: Record<TrophyKind, string> = { common: 'трофей', rare: 'рідкісний трофей', boss: 'трофей боса', relic: 'реліквія' };

export const TROPHIES: Record<string, TrophyDef> = {
  // Ліс
  wolfPelt: { id: 'wolfPelt', name: 'Вовча шкура', kind: 'common', from: ['wolf'], chance: 0.12, price: 1, description: 'Тепла й цупка. На півночі за неї платять добре.' },
  sporeCap: { id: 'sporeCap', name: 'Спорова шапка', kind: 'common', from: ['mushroom'], chance: 0.12, price: 1, description: 'Пахне вогкістю. Травниці роблять з неї мазі.' },
  resinBark: { id: 'resinBark', name: 'Смолиста кора', kind: 'common', from: ['stump'], chance: 0.12, price: 1, description: 'З живиці варять свічки для собору.' },
  // Узбережжя
  gullFeather: { id: 'gullFeather', name: 'Чаєче перо', kind: 'common', from: ['gull'], chance: 0.12, price: 2, description: 'Легке й міцне — саме на оперення стріл.' },
  crabShell: { id: 'crabShell', name: 'Крабовий панцир', kind: 'common', from: ['crab'], chance: 0.12, price: 2, description: 'Рибалки латають ним човни.' },
  // Мокролісся
  mossSkin: { id: 'mossSkin', name: 'Мохова шкірка', kind: 'common', from: ['mossToad'], chance: 0.12, price: 2, description: 'Зелена, м’яка, трохи липка.' },
  bogSpore: { id: 'bogSpore', name: 'Болотяна спора', kind: 'common', from: ['sporeCap'], chance: 0.12, price: 2, description: 'Чарівники кидають її в зілля для сили.' },
  rotCore: { id: 'rotCore', name: 'Гнила серцевина', kind: 'common', from: ['rotStump'], chance: 0.12, price: 2, description: 'Тліє зсередини навіть уночі.' },
  // Болото
  slimeGel: { id: 'slimeGel', name: 'Згусток слизу', kind: 'common', from: ['slime'], chance: 0.12, price: 3, description: 'Не висихає місяцями.' },
  frogTongue: { id: 'frogTongue', name: 'Жаб’ячий язик', kind: 'common', from: ['frog'], chance: 0.12, price: 3, description: 'Основа протиотрути.' },
  peatHeart: { id: 'peatHeart', name: 'Торф’яне серце', kind: 'common', from: ['bogman'], chance: 0.12, price: 3, description: 'Горить довго й жарко.' },
  // Сухе узлісся
  jackalTail: { id: 'jackalTail', name: 'Шакалячий хвіст', kind: 'common', from: ['jackal'], chance: 0.12, price: 2, description: 'Караванники вішають їх як оберіг.' },
  thorn: { id: 'thorn', name: 'Колючка', kind: 'common', from: ['thornBush'], chance: 0.12, price: 2, description: 'Тонка, як голка, і така ж гостра.' },
  boarTusk: { id: 'boarTusk', name: 'Вепрячий бивень', kind: 'common', from: ['dustBoar'], chance: 0.12, price: 2, description: 'Різьбярі роблять з нього руків’я.' },
  // Пустеля
  scorpionSting: { id: 'scorpionSting', name: 'Скорпіонове жало', kind: 'common', from: ['scorpion'], chance: 0.12, price: 4, description: 'Отрута в ньому жива ще тиждень.' },
  cactusSap: { id: 'cactusSap', name: 'Кактусовий сік', kind: 'common', from: ['cactus'], chance: 0.12, price: 4, description: 'Гамує спрагу і рани.' },
  chitinScale: { id: 'chitinScale', name: 'Хітинова луска', kind: 'common', from: ['scarab'], chance: 0.12, price: 4, description: 'Блищить, як бронза.' },
  // Гори
  goatHorn: { id: 'goatHorn', name: 'Цапиний ріг', kind: 'common', from: ['goat'], chance: 0.12, price: 4, description: 'Пастухи сурмлять у такі.' },
  harpyFeather: { id: 'harpyFeather', name: 'Перо гарпії', kind: 'common', from: ['harpy'], chance: 0.12, price: 4, description: 'Пам’ятає вітер, з яким літало.' },
  rockShard: { id: 'rockShard', name: 'Уламок кам’яника', kind: 'common', from: ['rockling'], chance: 0.12, price: 4, description: 'Важкий і теплий, ніби живий.' },
  // Крига
  iceFang: { id: 'iceFang', name: 'Крижане ікло', kind: 'common', from: ['iceWolf'], chance: 0.12, price: 5, description: 'Не тане навіть біля вогню.' },
  snowCore: { id: 'snowCore', name: 'Сніжне ядро', kind: 'common', from: ['snowman'], chance: 0.12, price: 5, description: 'Холодить руки крізь рукавиці.' },
  iceCrystal: { id: 'iceCrystal', name: 'Крижаний кристал', kind: 'common', from: ['iceGolem'], chance: 0.12, price: 5, description: 'У {town:iceTown:in} ним розпалюють печі — горить синім.' },
  // Мінібоси (рідкісні)
  alphaPelt: { id: 'alphaPelt', name: 'Шкура Ватажка', kind: 'rare', from: ['alpha'], chance: 0.5, price: 20, description: 'Сива шкура вовка, що водив зграї.' },
  galeBreath: { id: 'galeBreath', name: 'Подих бурі', kind: 'rare', from: ['galeSpirit'], chance: 0.5, price: 25, description: 'Вихор у скляній кулі — шарпається досі.' },
  royalSting: { id: 'royalSting', name: 'Королівське жало', kind: 'rare', from: ['scorpionKing'], chance: 0.5, price: 30, description: 'Завдовжки з кинджал.' },
  toadPearl: { id: 'toadPearl', name: 'Перлина Старої Жаби', kind: 'rare', from: ['bigToad'], chance: 0.5, price: 30, description: 'Зелена перлина з горла Старої Жаби.' },
  wardenShard: { id: 'wardenShard', name: 'Осколок варти', kind: 'rare', from: ['frostWarden'], chance: 0.5, price: 35, description: 'Шматок крижаного обладунку з гербом королівства.' },
  // Боси
  enatHeart: { id: 'enatHeart', name: 'Серце Ената', kind: 'boss', from: ['enat'], chance: 1, price: 60, description: 'Дерев’яне серце, що ледь чутно б’ється.' },
  venomGland: { id: 'venomGland', name: 'Отруйна залоза', kind: 'boss', from: ['poisonMother'], chance: 1, price: 70, description: 'Нею Мати отруювала болото.' },
  wormTooth: { id: 'wormTooth', name: 'Зуб Хробака', kind: 'boss', from: ['sandWorm'], chance: 1, price: 70, description: 'Один із сотні зубів, кожен — як серп.' },
  knightCrest: { id: 'knightCrest', name: 'Крижаний герб', kind: 'boss', from: ['iceKnight'], chance: 1, price: 80, description: 'Герб ордену, що колись стеріг перевал.' },
  // Реліквії (скарби на аренах)
  oldCoin: { id: 'oldCoin', name: 'Стара монета {name:kingdom:of}', kind: 'relic', from: ['forest', 'coast', 'swamp', 'desert', 'mountain', 'ice'], chance: 0.3, price: 10, description: 'Карбована ще до Договору {name:goddess:of}.' },
  amberBeetle: { id: 'amberBeetle', name: 'Бурштиновий жук', kind: 'relic', from: ['forest'], chance: 0.15, price: 25, description: 'Жук, застиглий у бурштині тисячу років тому.' },
  pearlShell: { id: 'pearlShell', name: 'Мушля з перлиною', kind: 'relic', from: ['coast'], chance: 0.15, price: 30, description: 'Купці з-за моря збирають такі.' },
  bogIdol: { id: 'bogIdol', name: 'Болотяний ідол', kind: 'relic', from: ['swamp'], chance: 0.15, price: 35, description: 'Хтось молився йому задовго до людей.' },
  clayTablet: { id: 'clayTablet', name: 'Глиняна табличка', kind: 'relic', from: ['desert'], chance: 0.15, price: 35, description: 'Письмена давнього народу пісків.' },
  frozenTear: { id: 'frozenTear', name: 'Застигла сльоза', kind: 'relic', from: ['ice'], chance: 0.15, price: 40, description: 'Крапля, що замерзла на льоту.' },
  sealShard: { id: 'sealShard', name: 'Уламок печатки', kind: 'relic', from: ['mountain'], chance: 0.05, price: 60, description: 'Камінь з руною {name:goddess:of}. Теплий.' },
};

/** An order of the artifact buyer: he pays `pay` gold for the whole set — far more than a merchant. */
export interface ArtifactOrder {
  id: string;
  name: string;
  wants: { trophy: string; count: number }[];
  pay: number;
  /** What Ізидор says (where to look is added from the data). */
  text: string;
}

export const ARTIFACT_ORDERS: ArtifactOrder[] = [
  { id: 'furs', name: 'Хутро для північного купця', wants: [{ trophy: 'wolfPelt', count: 10 }], pay: 45, text: 'Купець із {town:iceTown:of} замовив вовчі шкури. Десять — і він не торгується.' },
  { id: 'pearls', name: 'Перлини з-за моря', wants: [{ trophy: 'pearlShell', count: 3 }], pay: 180, text: 'Мушлі з перлинами лежать у скарбах узбережжя. Купці з-за моря платять золотом.' },
  { id: 'royal', name: 'Жала для алхіміка', wants: [{ trophy: 'royalSting', count: 1 }, { trophy: 'scorpionSting', count: 5 }], pay: 220, text: 'Королівське жало й п’ять звичайних — для протиотрути, яку варять лише раз на рік.' },
  { id: 'idols', name: 'Ідоли боліт', wants: [{ trophy: 'bogIdol', count: 2 }], pay: 170, text: 'Двоє болотяних ідолів. Не питай, навіщо.' },
  { id: 'tablets', name: 'Таблички пустелі', wants: [{ trophy: 'clayTablet', count: 3 }], pay: 210, text: 'Хочу прочитати, що писав народ пісків. Три таблички — і я, може, прочитаю.' },
  { id: 'tears', name: 'Застиглі сльози', wants: [{ trophy: 'frozenTear', count: 3 }], pay: 260, text: 'Кажуть, це сльози лицаря з перевалу. Принось — побачимо.' },
  { id: 'amber', name: 'Бурштин для королівського столу', wants: [{ trophy: 'amberBeetle', count: 2 }, { trophy: 'resinBark', count: 6 }], pay: 140, text: 'Двоє жуків у бурштині й живиця, щоб відполірувати.' },
  { id: 'seal', name: 'Уламки печатки', wants: [{ trophy: 'sealShard', count: 2 }], pay: 420, text: 'Уламки печатки {name:goddess:of}. Я заплачу найбільше — і нікому не скажу, навіщо вони мені.' },
];

export function getTrophy(id: string): TrophyDef {
  const t = TROPHIES[id];
  if (!t) throw new Error(`Unknown trophy: ${id}`);
  return t;
}
