import { describe, expect, it } from 'vitest';
import { getDictionaryStats, getWordEntry, isValidDictionaryWord } from '../index.js';

describe('@wordshift/word-dictionary edge cases', () => {
  it('rejects empty, numeric, and out-of-range length strings', () => {
    expect(isValidDictionaryWord('')).toBe(false);
    expect(isValidDictionaryWord('cat')).toBe(false);
    expect(isValidDictionaryWord('planetarium')).toBe(false);
    expect(isValidDictionaryWord('1234')).toBe(false);
  });

  it('returns metadata for approved words', () => {
    const entry = getWordEntry('cold');
    expect(entry).toBeDefined();
    expect(entry?.length).toBe(4);
    const stats = getDictionaryStats();
    expect(stats.byLength[4]).toBeGreaterThan(4000);
    expect(stats.byLength[5]).toBeGreaterThan(8000);
  });
});
