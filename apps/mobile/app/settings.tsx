import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { sketchColors, sketchStyles } from '../lib/theme';

export default function SettingsScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/auth');
  };

  return (
    <View style={styles.container}>
      <View style={[sketchStyles.card, styles.card]}>
        <Text style={styles.title}>Account</Text>
        <Pressable style={[sketchStyles.button, styles.logoutBtn]} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: sketchColors.bgPrimary },
  card: { padding: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: '900', color: sketchColors.textPrimary },
  logoutBtn: {
    backgroundColor: sketchColors.danger,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
