import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@wordshift/ui-tokens';
import type { PlayerStatsResponse } from '@wordshift/shared-types';
import { mobileApiFetch } from '../lib/api';

export default function ProfileScreen() {
  const [stats, setStats] = useState<PlayerStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mobileApiFetch<PlayerStatsResponse>('/api/player/stats').then((res) => {
      if (res.ok) setStats(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.dark.accent} />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.sub}>Sign in to view your profile.</Text>
      </View>
    );
  }

  const { profile } = stats;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{profile.username}</Text>
      <Text style={styles.sub}>
        Wins: {profile.wins} · Losses: {profile.losses} · Draws: {profile.draws}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dark.bgPrimary },
  container: { flex: 1, padding: 20, backgroundColor: colors.dark.bgPrimary, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', color: colors.dark.textPrimary },
  sub: { fontSize: 14, color: colors.dark.textSecondary },
});
