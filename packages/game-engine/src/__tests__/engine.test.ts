import { describe, expect, it } from 'vitest';
import type { MatchRecord } from '@wordshift/shared-types';
import {
  computeMoveTransition,
  computeTimeoutTransition,
  findChangedPosition,
  findShortestPath,
  generatePuzzle,
  isOneLetterDiff,
  validateMove,
} from '../index.js';

function makeMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  const now = Date.now();
  return {
    id: 'match-1',
    room_code: 'ABC123',
    status: 'active',
    word_length: 4,
    difficulty: 'mixed',
    start_word: 'cold',
    target_word: 'warm',
    current_word: 'cold',
    current_turn_seat: 1,
    move_number: 0,
    consecutive_timeouts: 0,
    winner_id: null,
    result_reason: null,
    turn_deadline_at: new Date(now + 30_000).toISOString(),
    match_deadline_at: new Date(now + 300_000).toISOString(),
    started_at: new Date(now).toISOString(),
    ended_at: null,
    expires_at: new Date(now + 1800_000).toISOString(),
    version: 1,
    created_by: 'p1',
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    ...overrides,
  };
}

describe('@wordshift/game-engine', () => {
  it('detects one-letter differences and changed positions', () => {
    expect(isOneLetterDiff('cold', 'cord')).toBe(true);
    expect(findChangedPosition('cold', 'cord')).toBe(2);
    expect(isOneLetterDiff('cold', 'cold')).toBe(false);
    expect(isOneLetterDiff('cold', 'warm')).toBe(false);
  });

  it('validates moves against dictionary, length, one-letter diff, and used words', () => {
    const valid = validateMove({
      candidateWord: 'CORD',
      currentWord: 'cold',
      targetWord: 'warm',
      usedWords: ['cold'],
    });
    expect(valid.valid).toBe(true);
    expect(valid.normalizedWord).toBe('cord');
    expect(valid.changedPosition).toBe(2);

    const repeated = validateMove({
      candidateWord: 'cold',
      currentWord: 'cord',
      targetWord: 'warm',
      usedWords: ['cold', 'cord'],
    });
    expect(repeated.valid).toBe(false);
    expect(repeated.errorCode).toBe('WORD_ALREADY_USED');

    const multi = validateMove({
      candidateWord: 'warm',
      currentWord: 'cold',
      targetWord: 'warm',
      usedWords: ['cold'],
    });
    expect(multi.valid).toBe(false);
    expect(multi.errorCode).toBe('MULTIPLE_LETTERS_CHANGED');

    const invalidDict = validateMove({
      candidateWord: 'colz',
      currentWord: 'cold',
      targetWord: 'warm',
      usedWords: ['cold'],
    });
    expect(invalidDict.valid).toBe(false);
    expect(invalidDict.errorCode).toBe('INVALID_WORD');
  });

  it('finds shortest paths with BFS and generates guaranteed solvable puzzles', () => {
    const path = findShortestPath('cold', 'warm');
    expect(path).not.toBeNull();
    expect(path![0]).toBe('cold');
    expect(path![path!.length - 1]).toBe('warm');

    const puzzle = generatePuzzle({ wordLength: 4, difficulty: 'easy', minSteps: 3, maxSteps: 5 });
    expect(puzzle.startWord).not.toBe(puzzle.targetWord);
    expect(puzzle.shortestPathLength).toBeGreaterThanOrEqual(3);
    expect(puzzle.shortestPathLength).toBeLessThanOrEqual(5);
    const verified = findShortestPath(puzzle.startWord, puzzle.targetWord);
    expect(verified).not.toBeNull();
  });

  it('handles move transitions, turn switching, and winning move', () => {
    const match = makeMatch({ current_word: 'ward', target_word: 'warm', move_number: 3 });
    const winResult = computeMoveTransition({
      match,
      playerId: 'p1',
      playerSeat: 1,
      candidateWord: 'warm',
      usedWords: ['cold', 'cord', 'card', 'ward'],
      expectedMoveNumber: 3,
    });
    expect(winResult.ok).toBe(true);
    expect(winResult.nextState?.status).toBe('finished');
    expect(winResult.nextState?.winner_id).toBe('p1');
    expect(winResult.nextState?.result_reason).toBe('target_reached');
  });

  it('handles timeout skipping and 3-timeout draw', () => {
    const now = Date.now();
    const expiredTurnMatch = makeMatch({
      turn_deadline_at: new Date(now - 1000).toISOString(),
      consecutive_timeouts: 0,
    });
    const skip = computeTimeoutTransition({ match: expiredTurnMatch, nowMs: now });
    expect(skip.shouldProcess).toBe(true);
    expect(skip.nextState?.status).toBe('active');
    expect(skip.nextState?.current_turn_seat).toBe(2);
    expect(skip.nextState?.consecutive_timeouts).toBe(1);

    const thirdTimeoutMatch = makeMatch({
      turn_deadline_at: new Date(now - 1000).toISOString(),
      consecutive_timeouts: 2,
    });
    const draw = computeTimeoutTransition({ match: thirdTimeoutMatch, nowMs: now });
    expect(draw.shouldProcess).toBe(true);
    expect(draw.nextState?.status).toBe('finished');
    expect(draw.nextState?.result_reason).toBe('timeout_draw');
  });
});
