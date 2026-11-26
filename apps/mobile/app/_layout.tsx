import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@wordshift/ui-tokens';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.dark.bgSecondary },
          headerTintColor: colors.dark.textPrimary,
          contentStyle: { backgroundColor: colors.dark.bgPrimary },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'WordShift' }} />
        <Stack.Screen name="auth" options={{ title: 'Sign In' }} />
        <Stack.Screen name="match/[id]" options={{ title: 'Match' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
