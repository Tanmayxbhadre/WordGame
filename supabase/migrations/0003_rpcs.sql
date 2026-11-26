-- WordShift Atomic Server-Side RPCs
-- Migration 0003: Transactional, Concurrency-Safe Game Operations

-- Helper: update player stats when match finishes
CREATE OR REPLACE FUNCTION public._finalize_player_stats(
  p_match_id UUID,
  p_winner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT player_id FROM public.match_players WHERE match_id = p_match_id
  LOOP
    IF p_winner_id IS NULL THEN
      -- Draw
      UPDATE public.profiles
      SET draws = draws + 1,
          total_matches = total_matches + 1,
          current_streak = 0,
          updated_at = NOW()
      WHERE id = v_rec.player_id;

      UPDATE public.rankings
      SET draws = draws + 1,
          updated_at = NOW()
      WHERE player_id = v_rec.player_id;
    ELSIF v_rec.player_id = p_winner_id THEN
      -- Winner
      UPDATE public.profiles
      SET wins = wins + 1,
          total_matches = total_matches + 1,
          current_streak = current_streak + 1,
          best_streak = GREATEST(best_streak, current_streak + 1),
          updated_at = NOW()
      WHERE id = v_rec.player_id;

      UPDATE public.rankings
      SET wins = wins + 1,
          rating = rating + 25,
          updated_at = NOW()
      WHERE player_id = v_rec.player_id;
    ELSE
      -- Loser
      UPDATE public.profiles
      SET losses = losses + 1,
          total_matches = total_matches + 1,
          current_streak = 0,
          updated_at = NOW()
      WHERE id = v_rec.player_id;

      UPDATE public.rankings
      SET losses = losses + 1,
          rating = GREATEST(100, rating - 15),
          updated_at = NOW()
      WHERE player_id = v_rec.player_id;
    END IF;
  END LOOP;
END;
$$;

-- Helper: build full snapshot JSON for a match
CREATE OR REPLACE FUNCTION public._get_match_snapshot_json(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match JSONB;
  v_players JSONB;
  v_moves JSONB;
  v_used JSONB;
  v_start_word TEXT;
BEGIN
  SELECT to_jsonb(m.*), m.start_word
  INTO v_match, v_start_word
  FROM public.matches m
  WHERE m.id = p_match_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', mp.id,
      'match_id', mp.match_id,
      'player_id', mp.player_id,
      'seat', mp.seat,
      'is_ready', mp.is_ready,
      'is_connected', mp.is_connected,
      'last_seen_at', mp.last_seen_at,
      'disconnected_at', mp.disconnected_at,
      'timeout_count', mp.timeout_count,
      'username', p.username,
      'avatar_url', p.avatar_url
    ) ORDER BY mp.seat ASC
  ), '[]'::jsonb)
  INTO v_players
  FROM public.match_players mp
  JOIN public.profiles p ON p.id = mp.player_id
  WHERE mp.match_id = p_match_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(mm.*) ORDER BY mm.move_number ASC), '[]'::jsonb)
  INTO v_moves
  FROM public.match_moves mm
  WHERE mm.match_id = p_match_id;

  SELECT COALESCE(
    jsonb_agg(DISTINCT w),
    '[]'::jsonb
  )
  INTO v_used
  FROM (
    SELECT v_start_word AS w
    UNION
    SELECT mm.word AS w
    FROM public.match_moves mm
    WHERE mm.match_id = p_match_id AND mm.is_timeout_skip = false
  ) sub;

  RETURN jsonb_build_object(
    'match', v_match,
    'players', v_players,
    'moves', v_moves,
    'used_words', v_used,
    'server_now', NOW()
  );
END;
$$;

-- 1. Create Match
CREATE OR REPLACE FUNCTION public.rpc_create_match(
  p_user_id UUID,
  p_word_length SMALLINT,
  p_difficulty TEXT,
  p_start_word TEXT,
  p_target_word TEXT,
  p_room_code TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached JSONB;
  v_match_id UUID;
  v_resp JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_json INTO v_cached
    FROM public.idempotency_keys
    WHERE key = p_idempotency_key AND user_id = p_user_id AND operation = 'create_match';
    IF v_cached IS NOT NULL THEN
      RETURN v_cached;
    END IF;
  END IF;

  INSERT INTO public.matches (
    room_code, status, word_length, difficulty,
    start_word, target_word, current_word,
    current_turn_seat, move_number, created_by, expires_at
  ) VALUES (
    UPPER(TRIM(p_room_code)), 'waiting', p_word_length, p_difficulty,
    LOWER(p_start_word), LOWER(p_target_word), LOWER(p_start_word),
    1, 0, p_user_id, NOW() + INTERVAL '30 minutes'
  )
  RETURNING id INTO v_match_id;

  INSERT INTO public.match_players (match_id, player_id, seat, is_ready, is_connected)
  VALUES (v_match_id, p_user_id, 1, false, true);

  INSERT INTO public.match_invites (match_id, room_code, created_by, expires_at)
  VALUES (v_match_id, UPPER(TRIM(p_room_code)), p_user_id, NOW() + INTERVAL '30 minutes');

  INSERT INTO public.match_audit_logs (match_id, actor_id, event_type, payload)
  VALUES (v_match_id, p_user_id, 'match_created', jsonb_build_object('room_code', UPPER(TRIM(p_room_code))));

  v_resp := jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(v_match_id));

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.idempotency_keys (key, user_id, operation, response_json)
    VALUES (p_idempotency_key, p_user_id, 'create_match', v_resp)
    ON CONFLICT (key) DO NOTHING;
  END IF;

  RETURN v_resp;
END;
$$;

-- 2. Join Match
CREATE OR REPLACE FUNCTION public.rpc_join_match(
  p_user_id UUID,
  p_room_code TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached JSONB;
  v_match RECORD;
  v_count INTEGER;
  v_already BOOLEAN;
  v_resp JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_json INTO v_cached
    FROM public.idempotency_keys
    WHERE key = p_idempotency_key AND user_id = p_user_id AND operation = 'join_match';
    IF v_cached IS NOT NULL THEN
      RETURN v_cached;
    END IF;
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE room_code = UPPER(TRIM(p_room_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'ROOM_EXPIRED',
      'message', 'Room not found or has expired.'
    ));
  END IF;

  IF v_match.expires_at < NOW() OR v_match.status IN ('cancelled', 'expired', 'finished') THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'ROOM_EXPIRED',
      'message', 'This room is no longer available.'
    ));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.match_players WHERE match_id = v_match.id AND player_id = p_user_id
  ) INTO v_already;

  IF v_already THEN
    v_resp := jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(v_match.id));
    RETURN v_resp;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.match_players WHERE match_id = v_match.id;
  IF v_count >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'ROOM_FULL',
      'message', 'This room already has 2 players.'
    ));
  END IF;

  INSERT INTO public.match_players (match_id, player_id, seat, is_ready, is_connected)
  VALUES (v_match.id, p_user_id, 2, false, true);

  UPDATE public.match_invites
  SET used_by = p_user_id, used_at = NOW()
  WHERE match_id = v_match.id AND used_by IS NULL;

  INSERT INTO public.match_audit_logs (match_id, actor_id, event_type, payload)
  VALUES (v_match.id, p_user_id, 'player_joined', '{}'::jsonb);

  v_resp := jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(v_match.id));

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.idempotency_keys (key, user_id, operation, response_json)
    VALUES (p_idempotency_key, p_user_id, 'join_match', v_resp)
    ON CONFLICT (key) DO NOTHING;
  END IF;

  RETURN v_resp;
END;
$$;

-- 3. Set Ready
CREATE OR REPLACE FUNCTION public.rpc_set_ready(
  p_user_id UUID,
  p_match_id UUID,
  p_is_ready BOOLEAN,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_ready_count INTEGER;
  v_player_count INTEGER;
  v_resp JSONB;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Match not found.'));
  END IF;

  IF v_match.status NOT IN ('waiting', 'ready') THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Match is not in lobby state.'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.match_players WHERE match_id = p_match_id AND player_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_A_PLAYER', 'message', 'You are not in this match.'));
  END IF;

  UPDATE public.match_players
  SET is_ready = p_is_ready, last_seen_at = NOW(), is_connected = true
  WHERE match_id = p_match_id AND player_id = p_user_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_ready = true)
  INTO v_player_count, v_ready_count
  FROM public.match_players
  WHERE match_id = p_match_id;

  UPDATE public.matches
  SET status = CASE WHEN v_player_count = 2 AND v_ready_count = 2 THEN 'ready' ELSE 'waiting' END,
      version = version + 1,
      updated_at = NOW()
  WHERE id = p_match_id;

  v_resp := jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
  RETURN v_resp;
END;
$$;

-- 4. Start Match
CREATE OR REPLACE FUNCTION public.rpc_start_match(
  p_user_id UUID,
  p_match_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_ready_count INTEGER;
  v_player_count INTEGER;
  v_resp JSONB;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Match not found.'));
  END IF;

  IF v_match.status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
  END IF;

  IF v_match.status NOT IN ('waiting', 'ready') THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Match cannot be started.'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.match_players WHERE match_id = p_match_id AND player_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_A_PLAYER', 'message', 'You are not in this match.'));
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_ready = true)
  INTO v_player_count, v_ready_count
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_player_count < 2 OR v_ready_count < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Both players must be ready before starting.'));
  END IF;

  UPDATE public.matches
  SET status = 'active',
      started_at = NOW(),
      turn_deadline_at = NOW() + INTERVAL '30 seconds',
      match_deadline_at = NOW() + INTERVAL '5 minutes',
      current_turn_seat = 1,
      move_number = 0,
      version = version + 1,
      updated_at = NOW()
  WHERE id = p_match_id;

  INSERT INTO public.match_audit_logs (match_id, actor_id, event_type, payload)
  VALUES (p_match_id, p_user_id, 'match_started', '{}'::jsonb);

  v_resp := jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
  RETURN v_resp;
END;
$$;

-- 5. Leave Lobby
CREATE OR REPLACE FUNCTION public.rpc_leave_lobby(
  p_user_id UUID,
  p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Match not found.'));
  END IF;

  IF v_match.status NOT IN ('waiting', 'ready') THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Cannot leave an active or finished match.'));
  END IF;

  DELETE FROM public.match_players WHERE match_id = p_match_id AND player_id = p_user_id;

  IF v_match.created_by = p_user_id THEN
    UPDATE public.matches SET status = 'cancelled', ended_at = NOW(), result_reason = 'cancelled', version = version + 1, updated_at = NOW()
    WHERE id = p_match_id;
  ELSE
    UPDATE public.matches SET status = 'waiting', version = version + 1, updated_at = NOW()
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'data', jsonb_build_object('left', true));
END;
$$;

-- 6. Submit Move (Atomic Validation + Commit)
CREATE OR REPLACE FUNCTION public.rpc_submit_move(
  p_user_id UUID,
  p_match_id UUID,
  p_word TEXT,
  p_expected_move_number INTEGER,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached JSONB;
  v_match RECORD;
  v_player RECORD;
  v_norm_word TEXT;
  v_len INTEGER;
  v_i INTEGER;
  v_diff_count INTEGER := 0;
  v_changed_pos INTEGER := NULL;
  v_next_move_num INTEGER;
  v_is_winner BOOLEAN := false;
  v_next_seat SMALLINT;
  v_move_row JSONB;
  v_resp JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT response_json INTO v_cached
    FROM public.idempotency_keys
    WHERE key = p_idempotency_key AND user_id = p_user_id AND operation = 'submit_move';
    IF v_cached IS NOT NULL THEN
      RETURN v_cached;
    END IF;
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Match not found.'));
  END IF;

  SELECT * INTO v_player FROM public.match_players WHERE match_id = p_match_id AND player_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_A_PLAYER', 'message', 'You are not a player in this match.'));
  END IF;

  IF v_match.status IN ('finished', 'cancelled', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'MATCH_FINISHED', 'message', 'Match has already finished.'));
  END IF;

  IF v_match.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Match is not active.'));
  END IF;

  IF v_match.current_turn_seat <> v_player.seat THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_YOUR_TURN', 'message', 'It is not your turn.'));
  END IF;

  IF p_expected_move_number IS NOT NULL AND p_expected_move_number <> v_match.move_number THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Move number mismatch. Syncing state.'));
  END IF;

  IF v_match.match_deadline_at < NOW() OR v_match.turn_deadline_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'TURN_EXPIRED', 'message', 'Your turn timer has expired.'));
  END IF;

  v_norm_word := LOWER(TRIM(p_word));
  v_len := LENGTH(v_match.current_word);

  IF v_norm_word !~ '^[a-z]+$' OR LENGTH(v_norm_word) <> v_len THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_WORD', 'message', 'Word must be ' || v_len || ' lowercase English letters.'));
  END IF;

  FOR v_i IN 1..v_len LOOP
    IF SUBSTRING(v_norm_word, v_i, 1) <> SUBSTRING(v_match.current_word, v_i, 1) THEN
      v_diff_count := v_diff_count + 1;
      v_changed_pos := v_i - 1; -- 0-indexed
    END IF;
  END LOOP;

  IF v_diff_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NO_LETTER_CHANGED', 'message', 'You must change exactly one letter.'));
  END IF;

  IF v_diff_count > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'MULTIPLE_LETTERS_CHANGED', 'message', 'Only one letter may be changed per turn.'));
  END IF;

  IF v_norm_word = v_match.start_word OR EXISTS (
    SELECT 1 FROM public.match_moves
    WHERE match_id = p_match_id AND is_timeout_skip = false AND word = v_norm_word
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'WORD_ALREADY_USED', 'message', UPPER(v_norm_word) || ' has already been used in this match.'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.words WHERE word = v_norm_word AND is_approved = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_WORD', 'message', UPPER(v_norm_word) || ' is not in the approved dictionary.'));
  END IF;

  v_next_move_num := v_match.move_number + 1;
  v_is_winner := (v_norm_word = v_match.target_word);
  v_next_seat := CASE WHEN v_player.seat = 1 THEN 2 ELSE 1 END;

  INSERT INTO public.match_moves (
    match_id, move_number, player_id, seat, word, previous_word, changed_position, is_timeout_skip
  ) VALUES (
    p_match_id, v_next_move_num, p_user_id, v_player.seat, v_norm_word, v_match.current_word, v_changed_pos, false
  )
  RETURNING to_jsonb(match_moves.*) INTO v_move_row;

  IF v_is_winner THEN
    UPDATE public.matches
    SET current_word = v_norm_word,
        move_number = v_next_move_num,
        consecutive_timeouts = 0,
        status = 'finished',
        winner_id = p_user_id,
        result_reason = 'target_reached',
        turn_deadline_at = NULL,
        ended_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_match_id;

    PERFORM public._finalize_player_stats(p_match_id, p_user_id);
  ELSE
    UPDATE public.matches
    SET current_word = v_norm_word,
        current_turn_seat = v_next_seat,
        move_number = v_next_move_num,
        consecutive_timeouts = 0,
        turn_deadline_at = NOW() + INTERVAL '30 seconds',
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_match_id;
  END IF;

  UPDATE public.match_players
  SET last_seen_at = NOW(), is_connected = true, disconnected_at = NULL
  WHERE match_id = p_match_id AND player_id = p_user_id;

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'snapshot', public._get_match_snapshot_json(p_match_id),
      'move', v_move_row,
      'is_winner', v_is_winner
    )
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.idempotency_keys (key, user_id, operation, response_json)
    VALUES (p_idempotency_key, p_user_id, 'submit_move', v_resp)
    ON CONFLICT (key) DO NOTHING;
  END IF;

  RETURN v_resp;
END;
$$;

-- 7. Process Timeout (Idempotent, concurrency-safe)
CREATE OR REPLACE FUNCTION public.rpc_process_timeout(
  p_match_id UUID,
  p_expected_move_number INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_next_move_num INTEGER;
  v_next_seat SMALLINT;
  v_next_timeouts INTEGER;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.status <> 'active' THEN
    RETURN jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
  END IF;

  IF p_expected_move_number IS NOT NULL AND p_expected_move_number <> v_match.move_number THEN
    RETURN jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
  END IF;

  -- Check 5-minute match duration expiry first
  IF v_match.match_deadline_at IS NOT NULL AND NOW() >= v_match.match_deadline_at THEN
    UPDATE public.matches
    SET status = 'finished',
        winner_id = NULL,
        result_reason = 'match_duration_draw',
        turn_deadline_at = NULL,
        ended_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_match_id;

    PERFORM public._finalize_player_stats(p_match_id, NULL);
    RETURN jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
  END IF;

  -- Check 30-second turn expiry
  IF v_match.turn_deadline_at IS NOT NULL AND NOW() >= v_match.turn_deadline_at THEN
    v_next_move_num := v_match.move_number + 1;
    v_next_timeouts := v_match.consecutive_timeouts + 1;
    v_next_seat := CASE WHEN v_match.current_turn_seat = 1 THEN 2 ELSE 1 END;

    INSERT INTO public.match_moves (
      match_id, move_number, player_id, seat, word, previous_word, changed_position, is_timeout_skip
    ) VALUES (
      p_match_id, v_next_move_num, NULL, v_match.current_turn_seat, v_match.current_word, v_match.current_word, NULL, true
    );

    UPDATE public.match_players
    SET timeout_count = timeout_count + 1
    WHERE match_id = p_match_id AND seat = v_match.current_turn_seat;

    IF v_next_timeouts >= 3 THEN
      UPDATE public.matches
      SET move_number = v_next_move_num,
          consecutive_timeouts = v_next_timeouts,
          status = 'finished',
          winner_id = NULL,
          result_reason = 'timeout_draw',
          turn_deadline_at = NULL,
          ended_at = NOW(),
          version = version + 1,
          updated_at = NOW()
      WHERE id = p_match_id;

      PERFORM public._finalize_player_stats(p_match_id, NULL);
    ELSE
      UPDATE public.matches
      SET move_number = v_next_move_num,
          consecutive_timeouts = v_next_timeouts,
          current_turn_seat = v_next_seat,
          turn_deadline_at = NOW() + INTERVAL '30 seconds',
          version = version + 1,
          updated_at = NOW()
      WHERE id = p_match_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
END;
$$;

-- 8. Process All Expired Matches (for background worker / cron)
CREATE OR REPLACE FUNCTION public.rpc_process_all_expired_matches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_processed INTEGER := 0;
BEGIN
  FOR v_rec IN
    SELECT id FROM public.matches
    WHERE status = 'active'
      AND (turn_deadline_at <= NOW() OR match_deadline_at <= NOW())
    LIMIT 100
  LOOP
    PERFORM public.rpc_process_timeout(v_rec.id, NULL);
    v_processed := v_processed + 1;
  END LOOP;

  -- Expire stale waiting rooms
  UPDATE public.matches
  SET status = 'expired', ended_at = NOW(), updated_at = NOW()
  WHERE status IN ('waiting', 'ready') AND expires_at < NOW();

  RETURN v_processed;
END;
$$;

-- 9. Forfeit Match
CREATE OR REPLACE FUNCTION public.rpc_forfeit_match(
  p_user_id UUID,
  p_match_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_winner_id UUID;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'INVALID_MATCH_STATE', 'message', 'Match not found.'));
  END IF;

  IF v_match.status IN ('finished', 'cancelled', 'expired') THEN
    RETURN jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
  END IF;

  SELECT player_id INTO v_winner_id
  FROM public.match_players
  WHERE match_id = p_match_id AND player_id <> p_user_id
  LIMIT 1;

  UPDATE public.matches
  SET status = 'finished',
      winner_id = v_winner_id,
      result_reason = 'forfeit',
      turn_deadline_at = NULL,
      ended_at = NOW(),
      version = version + 1,
      updated_at = NOW()
  WHERE id = p_match_id;

  PERFORM public._finalize_player_stats(p_match_id, v_winner_id);

  RETURN jsonb_build_object('ok', true, 'data', public._get_match_snapshot_json(p_match_id));
END;
$$;

-- 10. Reconnect Match (marks player connected without resetting turn deadline)
CREATE OR REPLACE FUNCTION public.rpc_reconnect_match(
  p_user_id UUID,
  p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.match_players WHERE match_id = p_match_id AND player_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'NOT_A_PLAYER', 'message', 'You are not a player in this match.'));
  END IF;

  UPDATE public.match_players
  SET is_connected = true,
      last_seen_at = NOW(),
      disconnected_at = NULL
  WHERE match_id = p_match_id AND player_id = p_user_id;

  -- Also process any pending timeout on reconnect so state is fresh
  RETURN public.rpc_process_timeout(p_match_id, NULL);
END;
$$;
