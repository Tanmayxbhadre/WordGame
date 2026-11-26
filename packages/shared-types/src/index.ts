export const GAME_RULES = {
  PLAYERS_PER_MATCH: 2,
  TURN_DURATION_SECONDS: 30,
  MAX_MATCH_DURATION_SECONDS: 300, // 5 minutes
  RECONNECT_GRACE_SECONDS: 15,
  MAX_CONSECUTIVE_TIMEOUTS: 3,
  ROOM_CODE_LENGTH: 6,
  ROOM_EXPIRY_MINUTES: 30,
  SUPPORTED_WORD_LENGTHS: [4, 5] as const,
  DEFAULT_WORD_LENGTH: 4,
} as const;

export type WordLength = (typeof GAME_RULES.SUPPORTED_WORD_LENGTHS)[number];

export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'mixed';

export type MatchStatus =
  | 'waiting'
  | 'ready'
  | 'active'
  | 'finished'
  | 'cancelled'
  | 'expired';

export type MatchResultReason =
  | 'target_reached'
  | 'forfeit'
  | 'timeout_draw'
  | 'match_duration_draw'
  | 'disconnect_forfeit'
  | 'cancelled';

export type ErrorCode =
  | 'NOT_YOUR_TURN'
  | 'INVALID_WORD'
  | 'MULTIPLE_LETTERS_CHANGED'
  | 'NO_LETTER_CHANGED'
  | 'WORD_ALREADY_USED'
  | 'TURN_EXPIRED'
  | 'MATCH_FINISHED'
  | 'INVALID_MATCH_STATE'
  | 'NOT_A_PLAYER'
  | 'ROOM_FULL'
  | 'ROOM_EXPIRED'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface PlayerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  draws: number;
  total_matches: number;
  current_streak: number;
  best_streak: number;
  created_at: string;
  updated_at: string;
}

export interface MatchPlayerState {
  id: string;
  match_id: string;
  player_id: string;
  seat: 1 | 2;
  is_ready: boolean;
  is_connected: boolean;
  last_seen_at: string;
  disconnected_at: string | null;
  timeout_count: number;
  username: string;
  avatar_url: string | null;
}

export interface MatchMoveRecord {
  id: string;
  match_id: string;
  move_number: number;
  player_id: string | null;
  seat: 1 | 2 | null;
  word: string;
  previous_word: string;
  changed_position: number | null;
  is_timeout_skip: boolean;
  created_at: string;
}

export interface MatchRecord {
  id: string;
  room_code: string;
  status: MatchStatus;
  word_length: number;
  difficulty: DifficultyTier;
  start_word: string;
  target_word: string;
  current_word: string;
  current_turn_seat: 1 | 2;
  move_number: number;
  consecutive_timeouts: number;
  winner_id: string | null;
  result_reason: MatchResultReason | null;
  turn_deadline_at: string | null;
  match_deadline_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MatchStateSnapshot {
  match: MatchRecord;
  players: MatchPlayerState[];
  moves: MatchMoveRecord[];
  used_words: string[];
  server_now: string;
}

// --- API Request / Response Contracts ---

export interface CreateMatchRequest {
  word_length?: WordLength;
  difficulty?: DifficultyTier;
  idempotency_key: string;
}

export interface CreateMatchResponse {
  match: MatchRecord;
  players: MatchPlayerState[];
}

export interface JoinMatchRequest {
  room_code: string;
  idempotency_key: string;
}

export interface JoinMatchResponse {
  match: MatchRecord;
  players: MatchPlayerState[];
}

export interface LeaveLobbyRequest {
  match_id: string;
  idempotency_key: string;
}

export interface SetReadyRequest {
  match_id: string;
  is_ready: boolean;
  idempotency_key: string;
}

export interface StartMatchRequest {
  match_id: string;
  idempotency_key: string;
}

export interface GetMatchStateRequest {
  match_id: string;
}

export interface SubmitMoveRequest {
  match_id: string;
  word: string;
  expected_move_number: number;
  idempotency_key: string;
}

export interface SubmitMoveResponse {
  snapshot: MatchStateSnapshot;
  move: MatchMoveRecord;
  is_winner: boolean;
}

export interface ProcessTimeoutRequest {
  match_id: string;
  expected_move_number?: number;
}

export interface ForfeitMatchRequest {
  match_id: string;
  idempotency_key: string;
}

export interface ReconnectMatchRequest {
  match_id: string;
}

export interface RematchRequest {
  match_id: string;
  idempotency_key: string;
}

export interface PlayerStatsResponse {
  profile: PlayerProfile;
  recent_matches: Array<{
    match_id: string;
    room_code: string;
    start_word: string;
    target_word: string;
    status: MatchStatus;
    result_reason: MatchResultReason | null;
    winner_id: string | null;
    move_count: number;
    duration_seconds: number | null;
    opponent_username: string | null;
    ended_at: string | null;
    created_at: string;
  }>;
}
