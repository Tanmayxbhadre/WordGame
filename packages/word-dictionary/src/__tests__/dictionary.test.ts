import { describe, expect, it } from 'vitest';
import {
  DICTIONARY_LICENSE,
  getDictionaryStats,
  getPuzzleCandidates,
  isValidDictionaryWord,
  normalizeDictionaryWord,
} from '../index.js';

describe('@wordshift/word-dictionary', () => {
  it('documents licensing', () => {
    expect(DICTIONARY_LICENSE.license).toBe('Public Domain');
  });

  it('normalizes and validates known English words', () => {
    expect(normalizeDictionaryWord('  COLD  ')).toBe('cold');
    expect(isValidDictionaryWord('cold')).toBe(true);
    expect(isValidDictionaryWord('WARM')).toBe(true);
    expect(isValidDictionaryWord('zzzz')).toBe(false);
    expect(isValidDictionaryWord('1234')).toBe(false);
  });

  it('has 4-letter and 5-letter puzzle candidates across difficulty tiers', () => {
    const stats = getDictionaryStats();
    expect(stats.total).toBeGreaterThan(10000);
    expect(getPuzzleCandidates(4, 'easy').length).toBeGreaterThan(100);
    expect(getPuzzleCandidates(4, 'medium').length).toBeGreaterThan(100);
    expect(getPuzzleCandidates(4, 'hard').length).toBeGreaterThan(100);
    expect(getPuzzleCandidates(5, 'mixed').length).toBeGreaterThan(500);
  });
});
