import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@wordshift/ui-tokens';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) {
          setError(err.message);
          return;
        }
        router.replace('/');
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim() } },
        });
        if (err) {
          setError(err.message);
          return;
        }
        router.replace('/');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>

      {mode === 'signup' && (
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={colors.dark.textMuted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.dark.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.dark.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.btn} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>{mode === 'login' ? 'Sign In' : 'Sign Up'}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.toggle}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.dark.bgPrimary,
    justifyContent: 'center',
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.dark.textPrimary, marginBottom: 8 },
  input: {
    backgroundColor: colors.dark.bgSecondary,
    borderColor: colors.dark.borderSubtle,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    color: colors.dark.textPrimary,
  },
  error: { color: colors.dark.danger, fontSize: 13 },
  btn: {
    backgroundColor: colors.dark.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  toggle: { color: colors.dark.textSecondary, textAlign: 'center', marginTop: 12 },
});
