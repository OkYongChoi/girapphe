import type { PropsWithChildren } from 'react';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMobileAuth } from '@/auth';

export function AuthRequired({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn } = useMobileAuth();
  const router = useRouter();

  if (!isLoaded) return <View style={styles.center}><Text style={styles.text}>Loading account…</Text></View>;
  if (isSignedIn) return <>{children}</>;

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Sign in to continue</Text>
      <Text style={styles.text}>Your notes and learning progress stay in sync across web, iOS, and Android.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in' as Href)} style={styles.button}>
        <Text style={styles.buttonText}>Sign in or create account</Text>
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
