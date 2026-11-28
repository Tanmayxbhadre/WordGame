import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { sketchColors } from '../lib/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: sketchColors.bgSecondary },
          headerTintColor: sketchColors.textPrimary,
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: sketchColors.bgPrimary },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'WordShift' }} />
        <Stack.Screen name="vs-computer" options={{ title: 'vs Computer' }} />
        <Stack.Screen name="auth" options={{ title: 'Sign In' }} />
        <Stack.Screen name="match/[id]" options={{ title: 'Match' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
