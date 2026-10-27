// Town growth (ROADMAP 15.4): gold invested through the town's steward raises it level by
// level. Each level gives something — a defence against the invasion, cheaper goods, a new
// service — and the town visibly grows (layout pieces with `growth` appear). Smerekove first.

export interface GrowthLevel {
  name: string;
  /** What it gives, in a line. */
  text: string;
  /** Gold to invest for this level. */
  cost: number;
  /** The battle at the gates (ROADMAP 15.2) — or the siege of the capital (17.4) — has this many waves fewer. */
  defense?: number;
  /** Merchant prices in this town × (1 − discount). */
  discount?: number;
}

export interface TownGrowthDef {
  /** The NPC who takes the gold. */
  steward: string;
  levels: GrowthLevel[];
}

export const TOWN_GROWTH: Record<string, TownGrowthDef> = {
  // The capital (ROADMAP 17.4): each level takes a wave off the siege.
  capital: {
    steward: 'capitalAdvisor',
    levels: [
      { name: 'Стіни', text: 'Мури латають, браму кують: в облогу мертві прориваються на площу на хвилю пізніше.', cost: 300, defense: 1 },
      { name: 'Варта', text: 'Король наймає варту: намети біля брами, дозори на мурах — ще на хвилю менше в облогу.', cost: 600, defense: 1 },
      { name: 'Балісти', text: 'На мурах ставлять балісти: вони розстрілюють загони на підході — ще хвилею менше.', cost: 1000, defense: 1 },
    ],
  },
  forestTown: {
    steward: 'forestElder',
    levels: [
      { name: 'Частокіл', text: 'Село обносять частоколом: бій біля воріт під час навали — на хвилю коротший.', cost: 150, defense: 1 },
      { name: 'Ярмарок', text: 'На площі з’являються ятки: у крамниці Смерекового все на 10% дешевше.', cost: 350, discount: 0.1 },
      { name: 'Кузня', text: 'Коваль з {town:capital:of} відкриває кузню: у селі можна перекинути характеристику, підняти рівень речі, дістати камінь.', cost: 700 },
    ],
  },
};
