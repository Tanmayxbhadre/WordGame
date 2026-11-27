import { describe, expect, it } from 'vitest';
import { findShortestPath, generatePuzzle, normalizeWord } from '../index.js';

describe('@wordshift/game-engine edge cases', () => {
  it('normalizes whitespace and mixed case', () => {
    expect(normalizeWord('  WaRm \n')).toBe('warm');
  });

  it('generates solvable 5-letter puzzles', () => {
    const puzzle = generatePuzzle({ wordLength: 5, difficulty: 'mixed', minSteps: 3, maxSteps: 6 });
    expect(puzzle.wordLength).toBe(5);
    expect(puzzle.startWord).toHaveLength(5);
    expect(puzzle.targetWord).toHaveLength(5);
    const path = findShortestPath(puzzle.startWord, puzzle.targetWord);
    expect(path).not.toBeNull();
  });
});
