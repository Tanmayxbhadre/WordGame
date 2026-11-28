import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { sketchColors, sketchStyles } from '../lib/theme';

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
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
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
      <View style={[sketchStyles.card, styles.card]}>
        <Text style={styles.title}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={sketchColors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={sketchColors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={sketchColors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[sketchStyles.button, styles.btn]}
          onPress={handleSubmit}
          disabled={loading}
        >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: sketchColors.bgPrimary,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: sketchColors.textPrimary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: sketchColors.bgPrimary,
    borderColor: sketchColors.border,
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    color: sketchColors.textPrimary,
    fontWeight: '600',
  },
  error: { color: sketchColors.danger, fontSize: 13, fontWeight: '700' },
  btn: {
    backgroundColor: sketchColors.accent,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  toggle: {
    color: sketchColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
});
