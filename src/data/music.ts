// Procedural music (ROADMAP 19.4): every theme is a recipe — tempo, the mode, a chord
// progression and the timbres; the player (render/music.ts) plays it as long pads, a bass and
// a wandering arpeggio, never the same twice. Themes: the title, a town, the map, each land,
// a boss, the siege, the tower, a death.

import type { Wave } from './sounds';

export type ThemeId = 'title' | 'town' | 'map' | 'forest' | 'swamp' | 'desert' | 'ice' | 'coast' | 'mountain' | 'boss' | 'siege' | 'tower' | 'sorrow';

export interface ThemeDef {
  name: string;
  /** Beats per minute. */
  bpm: number;
  /** The root note (MIDI). */
  root: number;
  /** The mode: semitones above the root. */
  scale: number[];
  /** Chords as scale degrees (0-based), one per bar of 4 beats. */
  chords: number[];
  pad: Wave;
  lead: Wave;
  /** Chance an eighth note of the arpeggio sounds (0 — none). */
  density: number;
  /** A bass note on beats 1 and 3. */
  bass: boolean;
  /** Loudness of the theme 0..1 (before the music volume). */
  gain: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

export const THEMES: Record<ThemeId, ThemeDef> = {
  title: { name: 'Королівство', bpm: 70, root: 50, scale: DORIAN, chords: [0, 5, 3, 4], pad: 'triangle', lead: 'sine', density: 0.35, bass: false, gain: 0.5 },
  town: { name: 'Місто', bpm: 84, root: 55, scale: MAJOR, chords: [0, 3, 4, 0], pad: 'triangle', lead: 'sine', density: 0.45, bass: true, gain: 0.45 },
  map: { name: 'Дорога', bpm: 76, root: 52, scale: DORIAN, chords: [0, 6, 3, 4], pad: 'sine', lead: 'triangle', density: 0.3, bass: true, gain: 0.45 },
  forest: { name: 'Ліс', bpm: 96, root: 52, scale: MINOR, chords: [0, 5, 2, 6], pad: 'triangle', lead: 'triangle', density: 0.5, bass: true, gain: 0.5 },
  swamp: { name: 'Болото', bpm: 78, root: 48, scale: PHRYGIAN, chords: [0, 1, 0, 6], pad: 'sine', lead: 'square', density: 0.35, bass: true, gain: 0.45 },
  desert: { name: 'Пустеля', bpm: 100, root: 50, scale: HARMONIC, chords: [0, 1, 4, 0], pad: 'triangle', lead: 'sawtooth', density: 0.5, bass: true, gain: 0.4 },
  ice: { name: 'Крига', bpm: 72, root: 57, scale: LYDIAN, chords: [0, 1, 4, 3], pad: 'sine', lead: 'sine', density: 0.4, bass: false, gain: 0.45 },
  coast: { name: 'Узбережжя', bpm: 88, root: 53, scale: DORIAN, chords: [0, 3, 6, 4], pad: 'sine', lead: 'triangle', density: 0.45, bass: true, gain: 0.45 },
  mountain: { name: 'Гори', bpm: 80, root: 47, scale: MINOR, chords: [0, 3, 5, 4], pad: 'triangle', lead: 'triangle', density: 0.35, bass: true, gain: 0.45 },
  boss: { name: 'Бос', bpm: 128, root: 45, scale: HARMONIC, chords: [0, 5, 6, 4], pad: 'sawtooth', lead: 'square', density: 0.7, bass: true, gain: 0.45 },
  siege: { name: 'Облога', bpm: 136, root: 43, scale: PHRYGIAN, chords: [0, 1, 6, 4], pad: 'sawtooth', lead: 'square', density: 0.75, bass: true, gain: 0.45 },
  tower: { name: 'Вежа', bpm: 112, root: 46, scale: HARMONIC, chords: [0, 3, 1, 4], pad: 'triangle', lead: 'square', density: 0.6, bass: true, gain: 0.45 },
  sorrow: { name: 'Смуток', bpm: 60, root: 45, scale: MINOR, chords: [0, 5, 3, 4], pad: 'sine', lead: 'sine', density: 0.15, bass: false, gain: 0.4 },
};

/** A land's own theme (others fall back to the closest). */
export const LAND_THEMES: Record<string, ThemeId> = {
  forest: 'forest',
  swamp: 'swamp',
  swampEdge: 'swamp',
  desert: 'desert',
  scrub: 'desert',
  ice: 'ice',
  mountain: 'mountain',
  coast: 'coast',
};
