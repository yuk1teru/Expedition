import { describe, expect, it } from 'vitest';
import { LAND_THEMES, THEMES } from '../src/data/music';
import { BIOMES } from '../src/data/biomes';
import { readSettings } from '../src/core/settings';
import { themeFor } from '../src/render/music';

describe('music (ROADMAP 19.4)', () => {
  it('themes: a real mode and chords inside it, a sane tempo', () => {
    for (const [id, t] of Object.entries(THEMES)) {
      expect(t.scale.length, id).toBe(7);
      expect(t.bpm, id).toBeGreaterThan(40);
      expect(t.bpm, id).toBeLessThan(200);
      for (const c of t.chords) expect(c >= 0 && c < 7, id).toBe(true);
    }
  });

  it('every land has its theme; the screen and the battle choose it', () => {
    for (const land of Object.keys(BIOMES)) expect(LAND_THEMES[land], land).toBeDefined();
    expect(themeFor({ screen: 'town' })).toBe('town');
    expect(themeFor({ screen: 'map' })).toBe('map');
    expect(themeFor({ screen: 'tombstone' })).toBe('sorrow');
    const battle = { land: 'desert', boss: false, siege: false, tower: false };
    expect(themeFor({ screen: 'combat', battle })).toBe('desert');
    expect(themeFor({ screen: 'combat', battle: { ...battle, boss: true } })).toBe('boss');
    expect(themeFor({ screen: 'combat', battle: { ...battle, boss: true, siege: true } })).toBe('siege');
    expect(themeFor({ screen: 'combat', battle: { ...battle, tower: true } })).toBe('tower');
  });

  it('the music volume is its own setting', () => {
    expect(readSettings(null).music).toBeGreaterThan(0);
    expect(readSettings(JSON.stringify({ music: 0 })).music).toBe(0);
    expect(readSettings(JSON.stringify({ music: 7 })).music).toBe(readSettings(null).music);
  });
});
