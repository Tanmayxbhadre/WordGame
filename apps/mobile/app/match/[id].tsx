import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@wordshift/ui-tokens';
import { countLetterDifferences } from '@wordshift/game-engine';
import type { MatchStateSnapshot, SubmitMoveResponse } from '@wordshift/shared-types';
import { supabase } from '../../lib/supabase';
import { makeIdempotencyKey, mobileApiFetch } from '../../lib/api';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export default function MobileMatchScreen() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<MatchStateSnapshot | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPos, setSelectedPos] = useState(0);
  const [draftWord, setDraftWord] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchState = useCallback(async () => {
    const res = await mobileApiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/state`);
    if (res.ok) {
      setSnapshot(res.data);
      setDraftWord(res.data.match.current_word);
    }
  }, [matchId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!userId || !matchId) return;
    void fetchState();

    const channel = supabase
      .channel(`mobile-match:${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => void fetchState()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${matchId}` },
        () => void fetchState()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, matchId, fetchState]);

  if (!snapshot || !userId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.dark.accent} />
      </View>
    );
  }

  const { match, players, moves } = snapshot;
  const me = players.find((p) => p.player_id === userId);

  if (match.status === 'waiting' || match.status === 'ready') {
    const bothReady = players.length === 2 && players.every((p) => p.is_ready);
    const isHost = match.created_by === userId;
    return (
      <View style={styles.container}>
        <Text style={styles.roomCode}>{match.room_code}</Text>
        <Text style={styles.sub}>{players.length}/2 players in room</Text>

        {me && (
          <Pressable
            style={styles.primaryBtn}
            onPress={async () => {
              setBusy(true);
              const res = await mobileApiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/ready`, {
                method: 'POST',
                body: JSON.stringify({ is_ready: !me.is_ready, idempotency_key: makeIdempotencyKey() }),
              });
              if (res.ok) setSnapshot(res.data);
              setBusy(false);
            }}
            disabled={busy}
          >
            <Text style={styles.btnText}>{me.is_ready ? 'Ready ✓' : 'Mark Ready'}</Text>
          </Pressable>
        )}

        {bothReady && isHost && (
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.dark.success }]}
            onPress={async () => {
              setBusy(true);
              const res = await mobileApiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/start`, {
                method: 'POST',
                body: JSON.stringify({ idempotency_key: makeIdempotencyKey() }),
              });
              if (res.ok) setSnapshot(res.data);
              setBusy(false);
            }}
            disabled={busy}
          >
            <Text style={styles.btnText}>Start Match</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (match.status === 'finished' || match.status === 'cancelled' || match.status === 'expired') {
    const won = match.winner_id === userId;
    return (
      <View style={styles.container}>
        <Text style={styles.roomCode}>
          {match.winner_id === null ? 'Match Draw' : won ? 'You Won!' : 'You Lost'}
        </Text>
        <Text style={styles.sub}>
          {match.start_word.toUpperCase()} → {match.target_word.toUpperCase()} ({moves.length} moves)
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
          <Text style={styles.btnText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const isMyTurn = me?.seat === match.current_turn_seat;
  const diffCount = countLetterDifferences(match.current_word, draftWord);

  return (
    <ScrollView contentContainerStyle={styles.gameContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.turnText}>{isMyTurn ? 'Your Turn' : "Opponent's Turn"}</Text>
        <Text style={styles.targetText}>Target: {match.target_word.toUpperCase()}</Text>
      </View>

      <View style={styles.tileRow}>
        {draftWord.split('').map((ch, idx) => (
          <Pressable
            key={idx}
            onPress={() => setSelectedPos(idx)}
            style={[
              styles.tile,
              selectedPos === idx && isMyTurn ? styles.tileSelected : null,
            ]}
          >
            <Text style={styles.tileLetter}>{ch.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      <Pressable
        style={[styles.primaryBtn, (!isMyTurn || diffCount !== 1 || busy) && { opacity: 0.4 }]}
        disabled={!isMyTurn || diffCount !== 1 || busy}
        onPress={async () => {
          setBusy(true);
          setFeedback(null);
          const res = await mobileApiFetch<SubmitMoveResponse>(`/api/matches/${matchId}/move`, {
            method: 'POST',
            body: JSON.stringify({
              word: draftWord,
              expected_move_number: match.move_number,
              idempotency_key: makeIdempotencyKey(),
            }),
          });
          if (!res.ok) {
            setFeedback(res.error.message);
          } else {
            setSnapshot(res.data.snapshot);
            setDraftWord(res.data.snapshot.match.current_word);
          }
          setBusy(false);
        }}
      >
        <Text style={styles.btnText}>Submit Word</Text>
      </Pressable>

      <View style={styles.keyboard}>
        {ROWS.map((row, rIdx) => (
          <View key={rIdx} style={styles.keyRow}>
            {row.map((letter) => (
              <Pressable
                key={letter}
                style={styles.key}
                disabled={!isMyTurn || busy}
                onPress={() => {
                  const chars = match.current_word.split('');
                  chars[selectedPos] = letter.toLowerCase();
                  setDraftWord(chars.join(''));
                }}
              >
                <Text style={styles.keyText}>{letter}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark.bgPrimary },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14, backgroundColor: colors.dark.bgPrimary },
  gameContainer: { padding: 16, gap: 18, backgroundColor: colors.dark.bgPrimary, flexGrow: 1 },
  roomCode: { fontSize: 32, fontWeight: '700', color: colors.dark.textPrimary, textAlign: 'center', letterSpacing: 4 },
  sub: { fontSize: 14, color: colors.dark.textSecondary, textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  turnText: { fontSize: 16, fontWeight: '700', color: colors.dark.accent },
  targetText: { fontSize: 14, fontWeight: '700', color: colors.dark.textPrimary },
  tileRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 12 },
  tile: {
    width: 56,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.dark.tileDefaultBorder,
    backgroundColor: colors.dark.tileDefaultBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileSelected: { borderColor: colors.dark.accent, backgroundColor: colors.dark.tileSelectedBg },
  tileLetter: { fontSize: 26, fontWeight: '700', color: colors.dark.textPrimary },
  feedback: { color: colors.dark.danger, textAlign: 'center', fontSize: 13 },
  primaryBtn: { backgroundColor: colors.dark.accent, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  keyboard: { gap: 8, marginTop: 12 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  key: {
    flex: 1,
    maxWidth: 36,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.dark.bgSecondary,
    borderWidth: 1,
    borderColor: colors.dark.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: { color: colors.dark.textPrimary, fontWeight: '600', fontSize: 14 },
});
