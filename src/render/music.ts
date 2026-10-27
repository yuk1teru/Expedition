// The music player (ROADMAP 19.4): plays the theme the game is in (`themeFor`) as long pads,
// a bass and a wandering arpeggio, scheduled a little ahead on the WebAudio clock; a new theme
// fades in over the old one. Starts with the sound (after the first key or click).

import { LAND_THEMES, THEMES, type ThemeDef, type ThemeId } from '../data/music';
import type { Wave } from '../data/sounds';

/** What the game is showing, for the theme choice. */
export interface MusicContext {
  screen: string;
  /** In battle: its land, whether a boss is on the field, the siege, the tower. */
  battle?: { land: string; boss: boolean; siege: boolean; tower: boolean } | null;
}

/** The theme of the moment. */
export function themeFor(c: MusicContext): ThemeId {
  if (c.screen === 'title' || c.screen === 'victory') return 'title';
  if (c.screen === 'death' || c.screen === 'tombstone') return 'sorrow';
  if (c.screen === 'town') return 'town';
  if (c.screen === 'combat' && c.battle) {
    if (c.battle.siege) return 'siege';
    if (c.battle.boss) return 'boss';
    if (c.battle.tower) return 'tower';
    return LAND_THEMES[c.battle.land] ?? 'forest';
  }
  return 'map';
}

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private themeGain: GainNode | null = null;
  private theme: ThemeId | null = null;
  private nextBeat = 0;
  private beat = 0;

  constructor(private volume: () => number) {}

  /** Starts on the sound's AudioContext. */
  attach(ctx: AudioContext): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.connect(ctx.destination);
    setInterval(() => this.schedule(), 100);
  }

  /** Switches to a theme (a fade); the same theme keeps playing. */
  play(id: ThemeId): void {
    if (!this.ctx || !this.bus || id === this.theme) return;
    const now = this.ctx.currentTime;
    if (this.themeGain) {
      const old = this.themeGain;
      old.gain.setTargetAtTime(0.0001, now, 0.4);
      setTimeout(() => old.disconnect(), 3000);
    }
    this.themeGain = this.ctx.createGain();
    this.themeGain.gain.setValueAtTime(0.0001, now);
    this.themeGain.gain.setTargetAtTime(THEMES[id].gain, now, 0.6);
    this.themeGain.connect(this.bus);
    this.theme = id;
    this.nextBeat = now + 0.1;
    this.beat = 0;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus || !this.theme || !this.themeGain || ctx.state !== 'running') return;
    this.bus.gain.value = this.volume();
    const t = THEMES[this.theme];
    const spb = 60 / t.bpm;
    while (this.nextBeat < ctx.currentTime + 0.4) {
      this.playBeat(t, this.beat, this.nextBeat, spb);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  /** The note of a scale degree (wraps into higher octaves). */
  private note(t: ThemeDef, degree: number, octave = 0): number {
    const n = t.scale.length;
    const d = ((degree % n) + n) % n;
    return t.root + t.scale[d]! + 12 * (octave + Math.floor(degree / n));
  }

  private playBeat(t: ThemeDef, beat: number, at: number, spb: number): void {
    const bar = Math.floor(beat / 4);
    const inBar = beat % 4;
    const chord = t.chords[bar % t.chords.length]!;
    const tones = [chord, chord + 2, chord + 4];
    // A pad on every bar: the three tones, long and soft.
    if (inBar === 0) for (const d of tones) this.tone(t.pad, midi(this.note(t, d)), at, spb * 4, 0.05);
    if (t.bass && (inBar === 0 || inBar === 2)) this.tone('triangle', midi(this.note(t, chord, -1)), at, spb * 1.6, 0.09);
    // The arpeggio: eighth notes, some of them silent.
    for (const half of [0, 0.5]) {
      if (Math.random() > t.density) continue;
      const d = tones[Math.floor(Math.random() * tones.length)]! + (Math.random() < 0.3 ? 7 : 0);
      this.tone(t.lead, midi(this.note(t, d, 1)), at + half * spb, spb * 0.45, 0.035);
    }
  }

  private tone(wave: Wave, freq: number, at: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.3, dur * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    env.connect(this.themeGain!);
    const o = ctx.createOscillator();
    o.type = wave === 'noise' ? 'sine' : wave;
    o.frequency.setValueAtTime(freq, at);
    o.connect(env);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
}
