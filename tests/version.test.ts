import { describe, expect, it } from 'vitest';
import { CHANGELOG, CHANGELOG_BASE_VERSION, GAME_VERSION } from '../src/data/changelog';
import { compareVersions, unseenUpdates } from '../src/core/version';

describe('update list', () => {
  it('compares versions numerically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
    expect(compareVersions('0.5.0', '0.5')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('the changelog is newest first and the game version is the newest entry', () => {
    for (let i = 1; i < CHANGELOG.length; i++) expect(compareVersions(CHANGELOG[i - 1]!.version, CHANGELOG[i]!.version)).toBe(1);
    expect(GAME_VERSION).toBe(CHANGELOG[0]!.version);
  });

  it('shows only updates after the last seen version; nothing when up to date', () => {
    expect(unseenUpdates(CHANGELOG, GAME_VERSION, CHANGELOG_BASE_VERSION)).toHaveLength(0);
    const older = CHANGELOG[2]!.version;
    expect(unseenUpdates(CHANGELOG, older, CHANGELOG_BASE_VERSION).map((e) => e.version)).toEqual([CHANGELOG[0]!.version, CHANGELOG[1]!.version]);
    // Never saved a version (played before the list existed): everything after the base.
    expect(unseenUpdates(CHANGELOG, null, CHANGELOG_BASE_VERSION)).toHaveLength(CHANGELOG.length);
  });
});
