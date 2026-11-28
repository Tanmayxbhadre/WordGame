import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { PlayerStatsResponse } from '@wordshift/shared-types';
import { mobileApiFetch } from '../lib/api';
import { sketchColors, sketchStyles } from '../lib/theme';

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
        <ActivityIndicator color={sketchColors.accent} />
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
      <View style={[sketchStyles.card, styles.card]}>
        <Text style={styles.title}>{profile.username}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{profile.wins}</Text>
            <Text style={styles.statLbl}>Wins</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{profile.losses}</Text>
            <Text style={styles.statLbl}>Losses</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{profile.draws}</Text>
            <Text style={styles.statLbl}>Draws</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: sketchColors.bgPrimary },
  container: { flex: 1, padding: 20, backgroundColor: sketchColors.bgPrimary },
  card: { padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: '900', color: sketchColors.textPrimary },
  sub: { fontSize: 14, color: sketchColors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: sketchColors.bgPrimary,
    borderColor: sketchColors.border,
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statVal: { fontSize: 22, fontWeight: '900', color: sketchColors.textPrimary },
  statLbl: { fontSize: 11, fontWeight: '700', color: sketchColors.textMuted, textTransform: 'uppercase' },
});
