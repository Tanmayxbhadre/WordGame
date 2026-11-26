import {
  GAME_RULES,
  type ErrorCode,
  type MatchRecord,
  type MatchResultReason,
} from '@wordshift/shared-types';
import { validateMove } from './validation.js';

export function getNextSeat(seat: 1 | 2): 1 | 2 {
  return seat === 1 ? 2 : 1;
}

export interface TurnCheckResult {
  allowed: boolean;
  errorCode?: ErrorCode;
  errorMessage?: string;
}

export function canPlayerAct(params: {
  match: Pick<
    MatchRecord,
    'status' | 'current_turn_seat' | 'turn_deadline_at' | 'match_deadline_at' | 'move_number'
  >;
  playerSeat: 1 | 2 | null;
  expectedMoveNumber?: number;
  nowMs?: number;
}): TurnCheckResult {
  const nowMs = params.nowMs ?? Date.now();
  const { match, playerSeat, expectedMoveNumber } = params;

  if (playerSeat === null) {
    return {
      allowed: false,
      errorCode: 'NOT_A_PLAYER',
      errorMessage: 'You are not a participant in this match.',
    };
  }

  if (match.status === 'finished' || match.status === 'cancelled' || match.status === 'expired') {
    return {
      allowed: false,
      errorCode: 'MATCH_FINISHED',
      errorMessage: 'This match has already ended.',
    };
  }

  if (match.status !== 'active') {
    return {
      allowed: false,
      errorCode: 'INVALID_MATCH_STATE',
      errorMessage: 'The match is not currently active.',
    };
  }

  if (match.current_turn_seat !== playerSeat) {
    return {
      allowed: false,
      errorCode: 'NOT_YOUR_TURN',
      errorMessage: 'It is not your turn.',
    };
  }

  if (expectedMoveNumber !== undefined && expectedMoveNumber !== match.move_number) {
    return {
      allowed: false,
      errorCode: 'INVALID_MATCH_STATE',
      errorMessage: 'Match state has advanced. Please sync and try again.',
    };
  }

  if (match.match_deadline_at && nowMs > Date.parse(match.match_deadline_at)) {
    return {
      allowed: false,
      errorCode: 'TURN_EXPIRED',
      errorMessage: 'Match time limit has expired.',
    };
  }

  if (match.turn_deadline_at && nowMs > Date.parse(match.turn_deadline_at)) {
    return {
      allowed: false,
      errorCode: 'TURN_EXPIRED',
      errorMessage: 'Your turn timer has expired.',
    };
  }

  return { allowed: true };
}

export interface MoveTransitionOutput {
  ok: boolean;
  errorCode?: ErrorCode;
  errorMessage?: string;
  nextState?: {
    current_word: string;
    current_turn_seat: 1 | 2;
    move_number: number;
    consecutive_timeouts: number;
    status: 'active' | 'finished';
    winner_id: string | null;
    result_reason: MatchResultReason | null;
    turn_deadline_at: string | null;
    ended_at: string | null;
    version: number;
    changed_position: number;
  };
}

export function computeMoveTransition(params: {
  match: MatchRecord;
  playerId: string;
  playerSeat: 1 | 2 | null;
  candidateWord: string;
  usedWords: Iterable<string>;
  expectedMoveNumber?: number;
  nowMs?: number;
  dictionaryCheck?: (word: string) => boolean;
}): MoveTransitionOutput {
  const nowMs = params.nowMs ?? Date.now();
  const turnCheck = canPlayerAct({
    match: params.match,
    playerSeat: params.playerSeat,
    expectedMoveNumber: params.expectedMoveNumber,
    nowMs,
  });

  if (!turnCheck.allowed) {
    return {
      ok: false,
      errorCode: turnCheck.errorCode,
      errorMessage: turnCheck.errorMessage,
    };
  }

  const moveValidation = validateMove({
    candidateWord: params.candidateWord,
    currentWord: params.match.current_word,
    targetWord: params.match.target_word,
    usedWords: params.usedWords,
    dictionaryCheck: params.dictionaryCheck,
  });

  if (!moveValidation.valid || moveValidation.changedPosition === null) {
    return {
      ok: false,
      errorCode: moveValidation.errorCode,
      errorMessage: moveValidation.errorMessage,
    };
  }

  const nextMoveNumber = params.match.move_number + 1;
  const nowIso = new Date(nowMs).toISOString();

  if (moveValidation.isDestination) {
    return {
      ok: true,
      nextState: {
        current_word: moveValidation.normalizedWord,
        current_turn_seat: params.match.current_turn_seat,
        move_number: nextMoveNumber,
        consecutive_timeouts: 0,
        status: 'finished',
        winner_id: params.playerId,
        result_reason: 'target_reached',
        turn_deadline_at: null,
        ended_at: nowIso,
        version: params.match.version + 1,
        changed_position: moveValidation.changedPosition,
      },
    };
  }

  const nextDeadline = new Date(nowMs + GAME_RULES.TURN_DURATION_SECONDS * 1000).toISOString();

  return {
    ok: true,
    nextState: {
      current_word: moveValidation.normalizedWord,
      current_turn_seat: getNextSeat(params.playerSeat!),
      move_number: nextMoveNumber,
      consecutive_timeouts: 0,
      status: 'active',
      winner_id: null,
      result_reason: null,
      turn_deadline_at: nextDeadline,
      ended_at: null,
      version: params.match.version + 1,
      changed_position: moveValidation.changedPosition,
    },
  };
}

export interface TimeoutTransitionOutput {
  shouldProcess: boolean;
  nextState?: {
    current_turn_seat: 1 | 2;
    move_number: number;
    consecutive_timeouts: number;
    status: 'active' | 'finished';
    winner_id: null;
    result_reason: MatchResultReason | null;
    turn_deadline_at: string | null;
    ended_at: string | null;
    version: number;
  };
}

export function computeTimeoutTransition(params: {
  match: MatchRecord;
  nowMs?: number;
}): TimeoutTransitionOutput {
  const nowMs = params.nowMs ?? Date.now();
  const { match } = params;

  if (match.status !== 'active') {
    return { shouldProcess: false };
  }

  const matchExpired =
    match.match_deadline_at !== null && nowMs >= Date.parse(match.match_deadline_at);
  const turnExpired =
    match.turn_deadline_at !== null && nowMs >= Date.parse(match.turn_deadline_at);

  if (!matchExpired && !turnExpired) {
    return { shouldProcess: false };
  }

  const nowIso = new Date(nowMs).toISOString();

  if (matchExpired) {
    return {
      shouldProcess: true,
      nextState: {
        current_turn_seat: match.current_turn_seat,
        move_number: match.move_number + 1,
        consecutive_timeouts: match.consecutive_timeouts,
        status: 'finished',
        winner_id: null,
        result_reason: 'match_duration_draw',
        turn_deadline_at: null,
        ended_at: nowIso,
        version: match.version + 1,
      },
    };
  }

  const nextConsecutive = match.consecutive_timeouts + 1;
  if (nextConsecutive >= GAME_RULES.MAX_CONSECUTIVE_TIMEOUTS) {
    return {
      shouldProcess: true,
      nextState: {
        current_turn_seat: match.current_turn_seat,
        move_number: match.move_number + 1,
        consecutive_timeouts: nextConsecutive,
        status: 'finished',
        winner_id: null,
        result_reason: 'timeout_draw',
        turn_deadline_at: null,
        ended_at: nowIso,
        version: match.version + 1,
      },
    };
  }

  const nextDeadline = new Date(nowMs + GAME_RULES.TURN_DURATION_SECONDS * 1000).toISOString();

  return {
    shouldProcess: true,
    nextState: {
      current_turn_seat: getNextSeat(match.current_turn_seat),
      move_number: match.move_number + 1,
      consecutive_timeouts: nextConsecutive,
      status: 'active',
      winner_id: null,
      result_reason: null,
      turn_deadline_at: nextDeadline,
      ended_at: null,
      version: match.version + 1,
    },
  };
}
