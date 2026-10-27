// Alchemy (ROADMAP 14.2): recipes from monster parts (trophies) and a little gold. Potions
// go to the bag; an elixir is drunk at once and holds for a number of arenas (one at a time);
// the Elixir of return gives a life — its recipe comes from the doctor's quest.

import type { ConsumableId } from './consumables';
import type { GiftStat } from './gifts';

export type RecipeResult =
  | { kind: 'consumable'; id: ConsumableId }
  | { kind: 'elixir'; stat: GiftStat; value: number; arenas: number }
  | { kind: 'life' };

export interface RecipeDef {
  id: string;
  name: string;
  /** What it does, in a line. */
  text: string;
  /** NPCs who brew it. */
  at: string[];
  needs: { trophy: string; count: number }[];
  gold: number;
  result: RecipeResult;
  /** Known only after this quest. */
  quest?: string;
}

const HERBALIST = ['capitalHerbalist', 'swampWitch'];

export const RECIPES: RecipeDef[] = [
  { id: 'potionSmall', name: 'Мале зілля', text: 'Зілля в сумку.', at: HERBALIST, needs: [{ trophy: 'sporeCap', count: 2 }], gold: 5, result: { kind: 'consumable', id: 'potionSmall' } },
  {
    id: 'potionMedium',
    name: 'Зілля',
    text: 'Зілля в сумку.',
    at: HERBALIST,
    needs: [{ trophy: 'sporeCap', count: 2 }, { trophy: 'resinBark', count: 2 }],
    gold: 10,
    result: { kind: 'consumable', id: 'potionMedium' },
  },
  {
    id: 'potionLarge',
    name: 'Велике зілля',
    text: 'Зілля в сумку.',
    at: HERBALIST,
    needs: [{ trophy: 'bogSpore', count: 2 }, { trophy: 'slimeGel', count: 2 }],
    gold: 20,
    result: { kind: 'consumable', id: 'potionLarge' },
  },
  {
    id: 'wolfBrew',
    name: 'Вовчий відвар',
    text: 'Руки швидші: +12% швидкості атаки.',
    at: HERBALIST,
    needs: [{ trophy: 'wolfPelt', count: 3 }, { trophy: 'sporeCap', count: 1 }],
    gold: 10,
    result: { kind: 'elixir', stat: 'attackSpeedPct', value: 0.12, arenas: 6 },
  },
  {
    id: 'resinTonic',
    name: 'Живиця сили',
    text: 'Тіло міцніше: +12% макс. HP.',
    at: HERBALIST,
    needs: [{ trophy: 'resinBark', count: 3 }, { trophy: 'sporeCap', count: 1 }],
    gold: 10,
    result: { kind: 'elixir', stat: 'hpPct', value: 0.12, arenas: 6 },
  },
  {
    id: 'sporeFocus',
    name: 'Споровий екстракт',
    text: 'Скіли сильніші: +12% шкоди скілів.',
    at: HERBALIST,
    needs: [{ trophy: 'sporeCap', count: 3 }, { trophy: 'resinBark', count: 1 }],
    gold: 10,
    result: { kind: 'elixir', stat: 'skillDamagePct', value: 0.12, arenas: 6 },
  },
  {
    id: 'seaSalt',
    name: 'Морська сіль',
    text: 'Ноги легші: +10% швидкості руху.',
    at: HERBALIST,
    needs: [{ trophy: 'gullFeather', count: 2 }, { trophy: 'crabShell', count: 2 }],
    gold: 15,
    result: { kind: 'elixir', stat: 'moveSpeedPct', value: 0.1, arenas: 6 },
  },
  {
    id: 'returnElixir',
    name: 'Еліксир повернення',
    text: '+1 життя (не більше максимуму).',
    at: ['capitalDoctor'],
    needs: [
      { trophy: 'sporeCap', count: 4 },
      { trophy: 'frogTongue', count: 4 },
      { trophy: 'iceFang', count: 2 },
    ],
    gold: 100,
    result: { kind: 'life' },
    quest: 'systemElixir',
  },
];
