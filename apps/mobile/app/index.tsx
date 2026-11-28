import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { CreateMatchResponse, JoinMatchResponse } from '@wordshift/shared-types';
import { makeIdempotencyKey, mobileApiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { sketchColors, sketchStyles } from '../lib/theme';

async function ensureMobileSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return true;

  const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
  if (!anonErr && anon.user) return true;

  const res = await mobileApiFetch<{ email: string; password: string }>('/api/auth/guest', {
    method: 'POST',
  });
  if (!res.ok) return false;

  const { error } = await supabase.auth.signInWithPassword({
    email: res.data.email,
    password: res.data.password,
  });
  return !error;
}

export default function HomeScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      await ensureMobileSession();
      const res = await mobileApiFetch<CreateMatchResponse>('/api/matches/create', {
        method: 'POST',
        body: JSON.stringify({
          word_length: 4,
          difficulty: 'mixed',
          idempotency_key: makeIdempotencyKey(),
        }),
      });
      if (!res.ok) {
        if (res.error.code === 'UNAUTHORIZED') {
          router.push('/auth');
          return;
        }
        setError(res.error.message);
        return;
      }
      router.push(`/match/${res.data.match.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Enter a valid room code.');
      return;
    }
    setLoading(true);
    try {
      await ensureMobileSession();
      const res = await mobileApiFetch<JoinMatchResponse>('/api/matches/join', {
        method: 'POST',
        body: JSON.stringify({
          room_code: code,
          idempotency_key: makeIdempotencyKey(),
        }),
      });
      if (!res.ok) {
        if (res.error.code === 'UNAUTHORIZED') {
          router.push('/auth');
          return;
        }
        setError(res.error.message);
        return;
      }
      router.push(`/match/${res.data.match.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Playful Tile Preview */}
      <View style={styles.previewRow}>
        {['C', 'O', 'L', 'D'].map((ch, idx) => (
          <View
            key={idx}
            style={[
              sketchStyles.tile,
              styles.miniTile,
              idx === 2 ? { backgroundColor: sketchColors.accent } : { backgroundColor: sketchColors.bgSecondary },
            ]}
          >
            <Text style={styles.miniTileText}>{ch}</Text>
          </View>
        ))}
        <Text style={styles.arrow}>→</Text>
        {['W', 'A', 'R', 'M'].map((ch, idx) => (
          <View
            key={idx}
            style={[sketchStyles.tile, styles.miniTile, { backgroundColor: 'rgba(52,211,153,0.2)' }]}
          >
            <Text style={[styles.miniTileText, { color: sketchColors.success }]}>{ch}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.title}>Shift one letter. Beat your friend.</Text>
      <Text style={styles.subtitle}>
        Take 30s turns on a shared word chain. First to reach the target wins!
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[sketchStyles.button, styles.primaryBtn]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>+ Create Private Room</Text>
        )}
      </Pressable>

      <View style={[sketchStyles.card, styles.card]}>
        <Text style={styles.label}>Join with Room Code</Text>
        <TextInput
          style={styles.input}
          value={roomCode}
          onChangeText={(t) => setRoomCode(t.toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor={sketchColors.textMuted}
          autoCapitalize="characters"
          maxLength={8}
        />
        <Pressable
          style={[sketchStyles.button, styles.secondaryBtn]}
          onPress={handleJoin}
          disabled={loading}
        >
          <Text style={styles.secondaryBtnText}>Join Match</Text>
        </Pressable>
      </View>

      <Pressable
        style={[sketchStyles.button, styles.secondaryBtn]}
        onPress={() => router.push('/vs-computer')}
      >
        <Text style={styles.secondaryBtnText}>Play vs Computer</Text>
      </Pressable>

      <View style={styles.navRow}>
        <Pressable style={[sketchStyles.button, styles.navBtn]} onPress={() => router.push('/profile')}>
          <Text style={styles.navBtnText}>Profile</Text>
        </Pressable>
        <Pressable style={[sketchStyles.button, styles.navBtn]} onPress={() => router.push('/settings')}>
          <Text style={styles.navBtnText}>Settings</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: sketchColors.bgPrimary,
    justifyContent: 'center',
    gap: 16,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 4,
  },
  miniTile: {
    width: 34,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  miniTileText: {
    color: sketchColors.textPrimary,
    fontWeight: '900',
    fontSize: 15,
  },
  arrow: {
    color: sketchColors.textMuted,
    fontWeight: '800',
    fontSize: 16,
    marginHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: sketchColors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: sketchColors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  error: {
    color: sketchColors.danger,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(248,113,113,0.14)',
    borderColor: sketchColors.border,
    borderWidth: 2,
    padding: 12,
    borderRadius: 14,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: sketchColors.accent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  card: {
    padding: 18,
    gap: 12,
  },
  label: {
    color: sketchColors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: sketchColors.bgPrimary,
    borderColor: sketchColors.border,
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    color: sketchColors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  secondaryBtn: {
    backgroundColor: sketchColors.bgElevated,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: sketchColors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  navBtn: {
    flex: 1,
    backgroundColor: sketchColors.bgSecondary,
    paddingVertical: 13,
    alignItems: 'center',
  },
  navBtnText: {
    color: sketchColors.textPrimary,
    fontWeight: '700',
  },
});
