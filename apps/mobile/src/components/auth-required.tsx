import { Fragment, type PropsWithChildren } from 'react';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMobileAuth } from '@/auth';
import {
  buildMobileAuthContinuationParams,
  type MobileAuthContinuation,
} from '@/auth-continuation';
import { useI18n } from '@/i18n';

type AuthRequiredProps = PropsWithChildren<{ continuation: MobileAuthContinuation }>;

export function AuthRequired({ children, continuation }: AuthRequiredProps) {
  const { isLoaded, isSignedIn, userId } = useMobileAuth();
  const router = useRouter();
  const { direction, t } = useI18n();

  if (!isLoaded) return <View style={[styles.center, { direction }]}><Text style={styles.text}>{t('auth.loading')}</Text></View>;
  if (isSignedIn) return <Fragment key={userId}>{children}</Fragment>;

  return (
    <View style={[styles.center, { direction }]}>
      <Text style={styles.title}>{t('auth.title')}</Text>
      <Text style={styles.text}>{t('auth.copy')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.action')}
        onPress={() => router.push({
          pathname: '/sign-in',
          params: buildMobileAuthContinuationParams(continuation),
        } as Href)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{t('auth.action')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f7f8fb' },
  title: { color: '#111827', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  text: { color: '#607080', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  button: { backgroundColor: '#111827', borderRadius: 10, minHeight: 48, justifyContent: 'center', marginTop: 22, paddingHorizontal: 16 },
  buttonText: { color: '#ffffff', fontWeight: '800', textAlign: 'center' },
});
