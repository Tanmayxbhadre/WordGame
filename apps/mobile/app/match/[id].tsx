import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { countLetterDifferences, findChangedPosition } from '@wordshift/game-engine';
import type { MatchStateSnapshot, SubmitMoveResponse } from '@wordshift/shared-types';
import { supabase } from '../../lib/supabase';
import { makeIdempotencyKey, mobileApiFetch } from '../../lib/api';
import { sketchColors, sketchStyles } from '../../lib/theme';

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
        <ActivityIndicator color={sketchColors.accent} />
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
        <View style={[sketchStyles.card, styles.lobbyCard]}>
          <Text style={styles.lobbyLabel}>Room Code</Text>
          <Text style={styles.roomCode}>{match.room_code}</Text>
          <Text style={styles.sub}>{players.length}/2 players joined</Text>

          {me && (
            <Pressable
              style={[
                sketchStyles.button,
                styles.primaryBtn,
                me.is_ready && { backgroundColor: sketchColors.success },
              ]}
              onPress={async () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              style={[sketchStyles.button, styles.primaryBtn, { backgroundColor: sketchColors.accentSecondary }]}
              onPress={async () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
              <Text style={styles.btnText}>Start Match!</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (match.status === 'finished' || match.status === 'cancelled' || match.status === 'expired') {
    const won = match.winner_id === userId;
    return (
      <View style={styles.container}>
        <View style={[sketchStyles.card, styles.lobbyCard]}>
          <Text style={styles.roomCode}>
            {match.winner_id === null ? 'Match Draw!' : won ? 'You Won!' : 'You Lost'}
          </Text>
          <Text style={styles.sub}>
            {match.start_word.toUpperCase()} → {match.target_word.toUpperCase()} ({moves.length} moves)
          </Text>
          <Pressable
            style={[sketchStyles.button, styles.primaryBtn]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.btnText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isMyTurn = me?.seat === match.current_turn_seat;
  const diffCount = countLetterDifferences(match.current_word, draftWord);
  const changedPos = findChangedPosition(match.current_word, draftWord);

  return (
    <ScrollView contentContainerStyle={styles.gameContainer}>
      <View style={[sketchStyles.card, styles.headerBar]}>
        <View style={[styles.turnPill, isMyTurn && { backgroundColor: sketchColors.accent }]}>
          <Text style={styles.turnText}>{isMyTurn ? 'Your Turn!' : "Opponent's Turn"}</Text>
        </View>
        <View style={styles.targetPill}>
          <Text style={styles.targetText}>Goal: {match.target_word.toUpperCase()}</Text>
        </View>
      </View>

      <View style={[sketchStyles.card, styles.boardCard]}>
        <View style={styles.tileRow}>
          {draftWord.split('').map((ch, idx) => {
            const isSelected = selectedPos === idx && isMyTurn;
            const isChanged = changedPos === idx;
            return (
              <Pressable
                key={idx}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSelectedPos(idx);
                }}
                style={[
                  sketchStyles.tile,
                  styles.tile,
                  isChanged
                    ? { backgroundColor: sketchColors.success }
                    : isSelected
                      ? { backgroundColor: sketchColors.accent, transform: [{ translateY: -3 }] }
                      : { backgroundColor: sketchColors.bgElevated },
                ]}
              >
                <Text style={styles.tileLetter}>{ch.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

        <View style={styles.actionRow}>
          <Pressable
            style={[sketchStyles.button, styles.resetBtn, diffCount === 0 && { opacity: 0.4 }]}
            disabled={!isMyTurn || diffCount === 0 || busy}
            onPress={() => setDraftWord(match.current_word)}
          >
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <Pressable
            style={[
              sketchStyles.button,
              styles.submitBtn,
              (!isMyTurn || diffCount !== 1 || busy) && { opacity: 0.4 },
            ]}
            disabled={!isMyTurn || diffCount !== 1 || busy}
            onPress={async () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        </View>
      </View>

      {/* Word Chain */}
      <View style={styles.chainRow}>
        <View style={styles.chainChip}>
          <Text style={styles.chainChipText}>{match.start_word.toUpperCase()}</Text>
        </View>
        {moves
          .filter((m) => !m.is_timeout_skip)
          .map((m) => (
            <View key={m.id} style={styles.chainChip}>
              <Text style={styles.chainChipText}>{m.word.toUpperCase()}</Text>
            </View>
          ))}
      </View>

      {/* Thumb-friendly QWERTY Keyboard */}
      <View style={styles.keyboard}>
        {ROWS.map((row, rIdx) => (
          <View key={rIdx} style={styles.keyRow}>
            {row.map((letter) => (
              <Pressable
                key={letter}
                style={[sketchStyles.tile, styles.key]}
                disabled={!isMyTurn || busy}
                onPress={() => {
                  void Haptics.selectionAsync();
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: sketchColors.bgPrimary },
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: sketchColors.bgPrimary },
  lobbyCard: { padding: 24, gap: 14 },
  lobbyLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', color: sketchColors.textMuted, textAlign: 'center' },
  gameContainer: { padding: 14, gap: 14, backgroundColor: sketchColors.bgPrimary, flexGrow: 1 },
  roomCode: { fontSize: 32, fontWeight: '900', color: sketchColors.textPrimary, textAlign: 'center', letterSpacing: 4 },
  sub: { fontSize: 14, color: sketchColors.textSecondary, textAlign: 'center' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  turnPill: { backgroundColor: sketchColors.bgElevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  turnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  targetPill: { backgroundColor: 'rgba(52,211,153,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  targetText: { fontSize: 13, fontWeight: '900', color: sketchColors.success },
  boardCard: { padding: 18, gap: 14 },
  tileRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  tile: { width: 58, height: 64, justifyContent: 'center', alignItems: 'center' },
  tileLetter: { fontSize: 28, fontWeight: '900', color: sketchColors.textPrimary },
  feedback: { color: sketchColors.danger, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10 },
  resetBtn: { backgroundColor: sketchColors.bgElevated, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center' },
  resetText: { color: sketchColors.textPrimary, fontWeight: '800', fontSize: 14 },
  submitBtn: { flex: 1, backgroundColor: sketchColors.accent, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { backgroundColor: sketchColors.accent, paddingVertical: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  chainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chainChip: { backgroundColor: sketchColors.bgSecondary, borderColor: sketchColors.border, borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  chainChipText: { color: sketchColors.textPrimary, fontSize: 12, fontWeight: '900' },
  keyboard: { gap: 8, marginTop: 4 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  key: {
    flex: 1,
    maxWidth: 38,
    height: 48,
    borderRadius: 10,
    backgroundColor: sketchColors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: { color: sketchColors.textPrimary, fontWeight: '800', fontSize: 15 },
});
