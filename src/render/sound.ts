// Procedural sound (ROADMAP 13.5): game events become short synthesised sounds (recipes in
// data/sounds.ts). The AudioContext starts on the first key or click (browsers allow sound
// only after one); the master volume is read from the settings on every sound.

import { RARITY_ORDER } from '../data/items';
import { SOUNDS, type SoundId, type Wave } from '../data/sounds';
import type { GameEvent } from '../systems/gameEvents';

/** Which sound a game event makes (null: none). */
export function eventSound(e: GameEvent): SoundId | null {
  switch (e.type) {
    case 'hit':
      return e.crit ? 'crit' : 'hit';
    case 'kill':
      return e.boss || e.elite ? 'bigKill' : 'kill';
    case 'heroHurt':
      return 'hurt';
    case 'heroDodge':
      return 'dodge';
    case 'telegraph':
      return 'telegraph';
    case 'wave':
    case 'miniboss':
      return 'wave';
    case 'levelUp':
      return 'levelUp';
    case 'loot':
      return RARITY_ORDER.indexOf(e.rarity) >= RARITY_ORDER.indexOf('rare') ? 'lootRare' : 'loot';
    case 'gold':
      return 'gold';
    case 'trophy':
      return e.kind === 'common' ? 'loot' : 'lootRare';
    case 'healUse':
      return 'heal';
    case 'heroDeath':
      return 'death';
    default:
      return null;
  }
}

export class SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<SoundId, number>();

  constructor(private volume: () => number) {}

  /** Starts the audio (call from a key or click handler). */
  unlock(): void {
    if (this.ctx || typeof AudioContext === 'undefined') {
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    // One second of white noise, reused by every noise sound.
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  play(id: SoundId): void {
    const ctx = this.ctx;
    const vol = this.volume();
    if (!ctx || !this.master || vol <= 0 || ctx.state !== 'running') return;
    const def = SOUNDS[id];
    const now = ctx.currentTime;
    if (def.gap && now - (this.last.get(id) ?? -Infinity) < def.gap) return;
    this.last.set(id, now);
    this.master.gain.value = vol;
    const notes = def.notes ?? [1];
    notes.forEach((k, i) => this.tone(def.wave, def.freq * k, (def.freqEnd ?? def.freq) * k, def.dur, def.gain, now + i * def.dur * 0.9));
  }

  private tone(wave: Wave, f0: number, f1: number, dur: number, gain: number, at: number): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.01, dur * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    env.connect(this.master!);
    let src: AudioScheduledSourceNode;
    if (wave === 'noise') {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(f0, at);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
      n.connect(filter);
      filter.connect(env);
      src = n;
    } else {
      const o = ctx.createOscillator();
      o.type = wave;
      o.frequency.setValueAtTime(f0, at);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
      o.connect(env);
      src = o;
    }
    src.start(at);
    src.stop(at + dur + 0.02);
  }
}
