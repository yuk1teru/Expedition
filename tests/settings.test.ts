import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, readSettings } from '../src/core/settings';

describe('settings', () => {
  it('missing or broken settings give the defaults; good values are kept', () => {
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings('{oops')).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(JSON.stringify({ volume: 7, shake: 'no' }))).toEqual(DEFAULT_SETTINGS);
    expect(readSettings(JSON.stringify({ volume: 0.3, shake: false, damageNumbers: false }))).toEqual({ volume: 0.3, shake: false, damageNumbers: false });
  });
});
