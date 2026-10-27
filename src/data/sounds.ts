// Procedural sounds (ROADMAP 13.5): every sound is synthesised by WebAudio from a short
// recipe — no audio files. A recipe is one or more tones (or noise) with a pitch slide and a
// quick fade; `notes` plays them one after another (an arpeggio). `gap` keeps a frequent
// sound (hits, gold) from stacking into noise.

export type SoundId =
  | 'hit'
  | 'crit'
  | 'kill'
  | 'bigKill'
  | 'hurt'
  | 'dodge'
  | 'telegraph'
  | 'wave'
  | 'levelUp'
  | 'loot'
  | 'lootRare'
  | 'gold'
  | 'heal'
  | 'death'
  | 'ui';

export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';

export interface SoundDef {
  name: string;
  /** When it plays (wiki). */
  when: string;
  wave: Wave;
  /** Start pitch, Hz (noise: the filter's centre). */
  freq: number;
  /** Pitch at the end (a slide); default: no slide. */
  freqEnd?: number;
  /** Seconds of one tone. */
  dur: number;
  /** Loudness 0..1 before the master volume. */
  gain: number;
  /** Pitch ratios of an arpeggio: tones one after another, `dur` apart. */
  notes?: number[];
  /** No replay sooner than this, s. */
  gap?: number;
}

export const SOUNDS: Record<SoundId, SoundDef> = {
  hit: { name: 'Удар', when: 'ваш удар влучив', wave: 'noise', freq: 900, freqEnd: 300, dur: 0.07, gain: 0.22, gap: 0.05 },
  crit: { name: 'Крит', when: 'критичний удар', wave: 'square', freq: 660, freqEnd: 990, dur: 0.09, gain: 0.16, gap: 0.06 },
  kill: { name: 'Смерть ворога', when: 'ворог упав', wave: 'triangle', freq: 420, freqEnd: 140, dur: 0.14, gain: 0.25, gap: 0.04 },
  bigKill: { name: 'Падіння сильного', when: 'упав елітний, мінібос чи бос', wave: 'sawtooth', freq: 220, freqEnd: 55, dur: 0.45, gain: 0.3 },
  hurt: { name: 'Рана', when: 'героя вдарили', wave: 'sine', freq: 180, freqEnd: 90, dur: 0.12, gain: 0.35, gap: 0.12 },
  dodge: { name: 'Ривок', when: 'ривок черевиків', wave: 'noise', freq: 1800, freqEnd: 600, dur: 0.16, gain: 0.18 },
  telegraph: { name: 'Телеграф', when: 'бос чи ворог готує удар (червона зона)', wave: 'square', freq: 330, freqEnd: 300, dur: 0.12, gain: 0.12, notes: [1, 1], gap: 0.3 },
  wave: { name: 'Хвиля', when: 'починається хвиля', wave: 'sawtooth', freq: 110, freqEnd: 130, dur: 0.35, gain: 0.18 },
  levelUp: { name: 'Новий рівень', when: 'герой підріс', wave: 'triangle', freq: 523, dur: 0.11, gain: 0.25, notes: [1, 1.26, 1.5, 2] },
  loot: { name: 'Річ', when: 'випала звичайна річ', wave: 'sine', freq: 880, dur: 0.1, gain: 0.2, notes: [1, 1.5] },
  lootRare: { name: 'Рідкісна річ', when: 'випала рідкісна чи краща річ', wave: 'triangle', freq: 988, dur: 0.12, gain: 0.25, notes: [1, 1.26, 1.5, 2, 2.52] },
  gold: { name: 'Золото', when: 'підібрано золото', wave: 'sine', freq: 1568, dur: 0.05, gain: 0.08, gap: 0.08 },
  heal: { name: 'Лікування', when: 'трава чи зілля', wave: 'sine', freq: 392, freqEnd: 784, dur: 0.3, gain: 0.2 },
  death: { name: 'Смерть героя', when: 'герой загинув', wave: 'sawtooth', freq: 300, freqEnd: 60, dur: 0.9, gain: 0.3 },
  ui: { name: 'Кнопка', when: 'натиснуто кнопку', wave: 'square', freq: 1200, dur: 0.03, gain: 0.07, gap: 0.04 },
};
