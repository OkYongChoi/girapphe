import { Stack } from 'expo-router';

import { ProgressProvider } from '@/state/progress-context';

export default function RootLayout() {
  return (
    <ProgressProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ProgressProvider>
  );
}
