import type { DifficultyTier } from '@wordshift/shared-types';
import rawEntries from './data/dictionary.json' with { type: 'json' };

export interface DictionaryEntry {
  word: string;
  length: number;
  difficulty: Exclude<DifficultyTier, 'mixed'>;
  degree: number;
  is_puzzle_candidate: boolean;
}

export const DICTIONARY_LICENSE = {
  name: 'Public Domain English Wordlist (Webster 1934 / System Words)',
  license: 'Public Domain',
  notes:
    'Filtered to lowercase ASCII 4- and 5-letter English words, excluding proper nouns, abbreviations, and offensive terms.',
} as const;

const entries = rawEntries as DictionaryEntry[];
const entryMap = new Map<string, DictionaryEntry>();
const byLengthMap = new Map<number, DictionaryEntry[]>();

for (const entry of entries) {
  entryMap.set(entry.word, entry);
  const bucket = byLengthMap.get(entry.length);
  if (bucket) {
    bucket.push(entry);
  } else {
    byLengthMap.set(entry.length, [entry]);
  }
}

export function normalizeDictionaryWord(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidDictionaryWord(word: string): boolean {
  const normalized = normalizeDictionaryWord(word);
  return entryMap.has(normalized);
}

export function getWordEntry(word: string): DictionaryEntry | undefined {
  return entryMap.get(normalizeDictionaryWord(word));
}

export function getWordsByLength(length: number): DictionaryEntry[] {
  return byLengthMap.get(length) ?? [];
}

export function getPuzzleCandidates(
  length: number,
  difficulty: DifficultyTier = 'mixed'
): DictionaryEntry[] {
  const words = getWordsByLength(length).filter((w) => w.is_puzzle_candidate);
  if (difficulty === 'mixed') {
    return words;
  }
  return words.filter((w) => w.difficulty === difficulty);
}

export function getDictionaryStats(): {
  total: number;
  byLength: Record<number, number>;
} {
  const byLength: Record<number, number> = {};
  for (const [len, list] of byLengthMap.entries()) {
    byLength[len] = list.length;
  }
  return { total: entries.length, byLength };
}
