import { Tabs } from 'expo-router';
import { useI18n } from '@/i18n';

export default function TabLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#73808c',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarStyle: {
          borderTopColor: '#e4e7ec',
          backgroundColor: '#ffffff',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="browse" options={{ title: t('tabs.browse') }} />
      <Tabs.Screen name="practice" options={{ title: t('tabs.practice') }} />
      <Tabs.Screen name="notes" options={{ title: t('tabs.notes') }} />
      <Tabs.Screen name="account" options={{ title: t('tabs.account') }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
      <Tabs.Screen name="review" options={{ href: null }} />
      <Tabs.Screen name="ranking" options={{ href: null }} />
    </Tabs>
  );
}
