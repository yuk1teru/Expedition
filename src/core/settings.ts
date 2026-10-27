// Player settings (ROADMAP 10.7): kept between visits, outside the hero's save.

export interface GameSettings {
  /** Sound volume 0..1 (0 — silent). */
  volume: number;
  /** Screen shake on big hits and boss moves. */
  shake: boolean;
  /** Floating damage and healing numbers. */
  damageNumbers: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = { volume: 0.7, shake: true, damageNumbers: true };

/** Settings from storage; unknown or broken values fall back to the defaults. */
export function readSettings(text: string | null): GameSettings {
  if (!text) return { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(text) as Partial<GameSettings>;
    return {
      volume: typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : DEFAULT_SETTINGS.volume,
      shake: typeof raw.shake === 'boolean' ? raw.shake : DEFAULT_SETTINGS.shake,
      damageNumbers: typeof raw.damageNumbers === 'boolean' ? raw.damageNumbers : DEFAULT_SETTINGS.damageNumbers,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
