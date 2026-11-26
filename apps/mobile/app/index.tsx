import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@wordshift/ui-tokens';
import type { CreateMatchResponse, JoinMatchResponse } from '@wordshift/shared-types';
import { makeIdempotencyKey, mobileApiFetch } from '../lib/api';

export default function HomeScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
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
    <View style={styles.container}>
      <Text style={styles.title}>WordShift</Text>
      <Text style={styles.subtitle}>
        Change one letter per turn. Reach the target word first.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primaryBtn} onPress={handleCreate} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Create Private Room</Text>
        )}
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>Join with Room Code</Text>
        <TextInput
          style={styles.input}
          value={roomCode}
          onChangeText={(t) => setRoomCode(t.toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor={colors.dark.textMuted}
          autoCapitalize="characters"
          maxLength={8}
        />
        <Pressable style={styles.secondaryBtn} onPress={handleJoin} disabled={loading}>
          <Text style={styles.secondaryBtnText}>Join Match</Text>
        </Pressable>
      </View>

      <View style={styles.navRow}>
        <Pressable style={styles.navBtn} onPress={() => router.push('/profile')}>
          <Text style={styles.navBtnText}>Profile</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => router.push('/settings')}>
          <Text style={styles.navBtnText}>Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.dark.bgPrimary,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.dark.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    marginBottom: 8,
  },
  error: {
    color: colors.dark.danger,
    fontSize: 13,
    backgroundColor: 'rgba(239,68,68,0.12)',
    padding: 10,
    borderRadius: 10,
  },
  primaryBtn: {
    backgroundColor: colors.dark.accent,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  card: {
    backgroundColor: colors.dark.bgSecondary,
    borderColor: colors.dark.borderSubtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  label: {
    color: colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.dark.bgPrimary,
    borderColor: colors.dark.borderSubtle,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: colors.dark.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
  },
  secondaryBtn: {
    backgroundColor: colors.dark.bgElevated,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.dark.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  navBtn: {
    flex: 1,
    borderColor: colors.dark.borderSubtle,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  navBtnText: {
    color: colors.dark.textSecondary,
    fontWeight: '600',
  },
});
