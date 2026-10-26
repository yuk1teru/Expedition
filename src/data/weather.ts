// Weather of event waves (every WAVE_EVENTS.every-th wave, in turn with the elemental).
// Weather lasts while its wave runs and debuffs the hero.

export type WeatherId = 'fog' | 'rain' | 'storm';

export interface WeatherDef {
  id: WeatherId;
  name: string;
  /** One line for the banner and the HUD. */
  description: string;
  /** Hero multipliers while the weather lasts. */
  moveSpeedMult: number;
  attackSpeedMult: number;
  /** Fog: only this radius around the hero is clearly visible, px (0 = no fog). */
  visionRadius: number;
  /** Storm: a lightning strike under the hero every `interval` s (0 = none). */
  lightning?: { interval: number; radius: number; delay: number; damage: number };
}

export const WEATHER: Record<WeatherId, WeatherDef> = {
  fog: {
    id: 'fog',
    name: 'Туман',
    description: 'видно лише поруч із героєм',
    moveSpeedMult: 1,
    attackSpeedMult: 1,
    visionRadius: 170,
  },
  rain: {
    id: 'rain',
    name: 'Злива',
    description: '−25% швидкості руху, −15% швидкості атаки',
    moveSpeedMult: 0.75,
    attackSpeedMult: 0.85,
    visionRadius: 0,
  },
  storm: {
    id: 'storm',
    name: 'Гроза',
    description: 'блискавки б’ють туди, де стоїть герой',
    moveSpeedMult: 1,
    attackSpeedMult: 1,
    visionRadius: 0,
    // Damage × the wave damage multiplier × tier multiplier.
    lightning: { interval: 2.4, radius: 52, delay: 1, damage: 7 },
  },
};

export const WEATHER_ORDER: WeatherId[] = ['storm', 'fog', 'rain'];
