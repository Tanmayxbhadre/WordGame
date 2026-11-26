import { describe, expect, it } from 'vitest';
import type { MatchRecord } from '@wordshift/shared-types';
import {
  computeMoveTransition,
  computeTimeoutTransition,
  generatePuzzle,
} from '@wordshift/game-engine';
import { checkRateLimit, generateSecureRoomCode } from '@/lib/api-helpers';

describe('WordShift API & Multiplayer Integration Flow', () => {
  it('generates secure 6-character alphanumeric room codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = generateSecureRoomCode(6);
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(45);
  });

  it('enforces per-key rate limits', () => {
    const key = `test-rate-${Date.now()}`;
    expect(checkRateLimit(key, 2, 10_000)).toBe(true);
    expect(checkRateLimit(key, 2, 10_000)).toBe(true);
    expect(checkRateLimit(key, 2, 10_000)).toBe(false);
  });

  it('executes a complete 2-player match from puzzle generation to victory and handles concurrency/timeouts', () => {
    const puzzle = generatePuzzle({ wordLength: 4, difficulty: 'easy', minSteps: 3, maxSteps: 5 });
    const now = Date.now();
    let match: MatchRecord = {
      id: 'm-int-1',
      room_code: generateSecureRoomCode(6),
      status: 'active',
      word_length: 4,
      difficulty: 'easy',
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
    };

    expect(puzzle.shortestPathLength).toBeGreaterThanOrEqual(3);

    const used = ['cold'];

    // Wrong turn (Player 2 tries on Player 1's turn)
    const wrongTurn = computeMoveTransition({
      match,
      playerId: 'p2',
      playerSeat: 2,
      candidateWord: 'cord',
      usedWords: used,
      expectedMoveNumber: 0,
      nowMs: now + 1000,
    });
    expect(wrongTurn.ok).toBe(false);
    expect(wrongTurn.errorCode).toBe('NOT_YOUR_TURN');

    // Player 1 plays 'cord'
    const m1 = computeMoveTransition({
      match,
      playerId: 'p1',
      playerSeat: 1,
      candidateWord: 'cord',
      usedWords: used,
      expectedMoveNumber: 0,
      nowMs: now + 2000,
    });
    expect(m1.ok).toBe(true);
    used.push('cord');
    match = { ...match, ...m1.nextState! };

    // Stale move_number rejected (simulating concurrent/duplicate submission)
    const staleMove = computeMoveTransition({
      match,
      playerId: 'p2',
      playerSeat: 2,
      candidateWord: 'card',
      usedWords: used,
      expectedMoveNumber: 0,
      nowMs: now + 3000,
    });
    expect(staleMove.ok).toBe(false);
    expect(staleMove.errorCode).toBe('INVALID_MATCH_STATE');

    // Player 2 times out -> turn skips back to Player 1
    const t1 = computeTimeoutTransition({ match, nowMs: now + 35_000 });
    expect(t1.shouldProcess).toBe(true);
    match = { ...match, ...t1.nextState! };
    expect(match.current_turn_seat).toBe(1);
    expect(match.consecutive_timeouts).toBe(1);

    // Player 1 plays 'card', Player 2 plays 'ward', Player 1 wins with 'warm'
    const m2 = computeMoveTransition({
      match,
      playerId: 'p1',
      playerSeat: 1,
      candidateWord: 'card',
      usedWords: used,
      expectedMoveNumber: match.move_number,
      nowMs: now + 36_000,
    });
    expect(m2.ok).toBe(true);
    used.push('card');
    match = { ...match, ...m2.nextState! };

    const m3 = computeMoveTransition({
      match,
      playerId: 'p2',
      playerSeat: 2,
      candidateWord: 'ward',
      usedWords: used,
      expectedMoveNumber: match.move_number,
      nowMs: now + 37_000,
    });
    expect(m3.ok).toBe(true);
    used.push('ward');
    match = { ...match, ...m3.nextState! };

    const m4 = computeMoveTransition({
      match,
      playerId: 'p1',
      playerSeat: 1,
      candidateWord: 'warm',
      usedWords: used,
      expectedMoveNumber: match.move_number,
      nowMs: now + 38_000,
    });
    expect(m4.ok).toBe(true);
    expect(m4.nextState?.status).toBe('finished');
    expect(m4.nextState?.winner_id).toBe('p1');
    expect(m4.nextState?.result_reason).toBe('target_reached');
  });
});
