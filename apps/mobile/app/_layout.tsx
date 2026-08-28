import { Stack } from 'expo-router';
import { MobileAuthProvider } from '@/auth';
import { I18nProvider, useI18n } from '@/i18n';
import { SubscriptionProvider } from '@/subscriptions';

export default function RootLayout() {
  return (
    <I18nProvider>
      <LocalizedApp />
    </I18nProvider>
  );
}

function LocalizedApp() {
  const { t } = useI18n();

  return (
    <MobileAuthProvider>
      <SubscriptionProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="topic/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="knowledge-topic/[topic]" options={{ headerShown: false }} />
          <Stack.Screen name="candidate-inbox" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="subscription" options={{ title: t('subscription.navigationTitle') }} />
          <Stack.Screen name="admin" options={{ title: t('admin.title') }} />
        </Stack>
      </SubscriptionProvider>
    </MobileAuthProvider>
  );
}
