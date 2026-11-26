import { isValidDictionaryWord } from '@wordshift/word-dictionary';
import type { ErrorCode } from '@wordshift/shared-types';

const ASCII_LOWERCASE_RE = /^[a-z]+$/;

export function normalizeWord(input: string): string {
  return input.trim().toLowerCase();
}

export function isAsciiLowercaseWord(word: string): boolean {
  return ASCII_LOWERCASE_RE.test(word);
}

export function hasEqualLength(a: string, b: string): boolean {
  return a.length === b.length;
}

export function countLetterDifferences(a: string, b: string): number {
  if (a.length !== b.length) {
    return Math.abs(a.length - b.length) + Math.min(a.length, b.length);
  }
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
  }
  return diffs;
}

export function findChangedPosition(fromWord: string, toWord: string): number | null {
  if (fromWord.length !== toWord.length) return null;
  let changedIndex: number | null = null;
  for (let i = 0; i < fromWord.length; i++) {
    if (fromWord[i] !== toWord[i]) {
      if (changedIndex !== null) return null; // More than one letter changed
      changedIndex = i;
    }
  }
  return changedIndex;
}

export function isOneLetterDiff(fromWord: string, toWord: string): boolean {
  return findChangedPosition(fromWord, toWord) !== null;
}

export function isWordUsed(word: string, usedWords: Iterable<string>): boolean {
  const norm = normalizeWord(word);
  for (const used of usedWords) {
    if (normalizeWord(used) === norm) return true;
  }
  return false;
}

export function isDestinationReached(word: string, targetWord: string): boolean {
  return normalizeWord(word) === normalizeWord(targetWord);
}

export interface MoveValidationResult {
  valid: boolean;
  normalizedWord: string;
  changedPosition: number | null;
  isDestination: boolean;
  errorCode?: ErrorCode;
  errorMessage?: string;
}

export function validateMove(params: {
  candidateWord: string;
  currentWord: string;
  targetWord: string;
  usedWords: Iterable<string>;
  dictionaryCheck?: (word: string) => boolean;
}): MoveValidationResult {
  const normalizedWord = normalizeWord(params.candidateWord);
  const current = normalizeWord(params.currentWord);
  const target = normalizeWord(params.targetWord);

  if (!isAsciiLowercaseWord(normalizedWord) || !hasEqualLength(normalizedWord, current)) {
    return {
      valid: false,
      normalizedWord,
      changedPosition: null,
      isDestination: false,
      errorCode: 'INVALID_WORD',
      errorMessage: `Word must be ${current.length} lowercase English letters.`,
    };
  }

  const diffCount = countLetterDifferences(current, normalizedWord);
  if (diffCount === 0) {
    return {
      valid: false,
      normalizedWord,
      changedPosition: null,
      isDestination: false,
      errorCode: 'NO_LETTER_CHANGED',
      errorMessage: 'You must change exactly one letter.',
    };
  }

  if (diffCount > 1) {
    return {
      valid: false,
      normalizedWord,
      changedPosition: null,
      isDestination: false,
      errorCode: 'MULTIPLE_LETTERS_CHANGED',
      errorMessage: 'Only one letter may be changed per turn.',
    };
  }

  const changedPosition = findChangedPosition(current, normalizedWord);

  if (isWordUsed(normalizedWord, params.usedWords)) {
    return {
      valid: false,
      normalizedWord,
      changedPosition,
      isDestination: false,
      errorCode: 'WORD_ALREADY_USED',
      errorMessage: `"${normalizedWord.toUpperCase()}" has already been used in this match.`,
    };
  }

  const checkDict = params.dictionaryCheck ?? isValidDictionaryWord;
  if (!checkDict(normalizedWord)) {
    return {
      valid: false,
      normalizedWord,
      changedPosition,
      isDestination: false,
      errorCode: 'INVALID_WORD',
      errorMessage: `"${normalizedWord.toUpperCase()}" is not in the approved dictionary.`,
    };
  }

  return {
    valid: true,
    normalizedWord,
    changedPosition,
    isDestination: normalizedWord === target,
  };
}
