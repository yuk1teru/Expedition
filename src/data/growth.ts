// Town growth (ROADMAP 15.4): gold invested through the town's steward raises it level by
// level. Each level gives something — a defence against the invasion, cheaper goods, a new
// service — and the town visibly grows (layout pieces with `growth` appear). Smerekove first.

export interface GrowthLevel {
  name: string;
  /** What it gives, in a line. */
  text: string;
  /** Gold to invest for this level. */
  cost: number;
  /** The battle at the gates has this many waves fewer (ROADMAP 15.2). */
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
  forestTown: {
    steward: 'forestElder',
    levels: [
      { name: 'Частокіл', text: 'Село обносять частоколом: бій біля воріт під час навали — на хвилю коротший.', cost: 150, defense: 1 },
      { name: 'Ярмарок', text: 'На площі з’являються ятки: у крамниці Смерекового все на 10% дешевше.', cost: 350, discount: 0.1 },
      { name: 'Кузня', text: 'Коваль з {town:capital:of} відкриває кузню: у селі можна перекинути характеристику, підняти рівень речі, дістати камінь.', cost: 700 },
    ],
  },
};
