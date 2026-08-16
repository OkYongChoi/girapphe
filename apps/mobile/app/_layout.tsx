import { Stack } from 'expo-router';
import { MobileAuthProvider } from '@/auth';
import { SubscriptionProvider } from '@/subscriptions';

export default function RootLayout() {
  return (
    <MobileAuthProvider>
      <SubscriptionProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="topic/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
          <Stack.Screen name="subscription" options={{ title: 'Ad-free subscription' }} />
        </Stack>
      </SubscriptionProvider>
    </MobileAuthProvider>
  );
}
