import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useClerkEmailPasswordSignIn, useMobileAuth } from '@/auth';

const configuredBaseUrl = process.env.EXPO_PUBLIC_APP_BASE_URL?.trim();
const appBaseUrl = configuredBaseUrl?.startsWith('http') ? configuredBaseUrl.replace(/\/$/, '') : 'https://www.girapphe.com';

export default function SignInScreen() {
  const router = useRouter();
  const auth = useMobileAuth();

  useEffect(() => {
    if (auth.isLoaded && auth.isSignedIn) router.replace('/(tabs)/account');
  }, [auth.isLoaded, auth.isSignedIn, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Girapphe account</Text>
        <Text style={styles.title}>Sign in to sync your subscription</Text>
        <Text style={styles.intro}>
          Your Clerk user ID is also used as the RevenueCat App User ID so purchases and restores stay attached to your account.
        </Text>

        {!auth.configured ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Mobile sign-in is not configured</Text>
            <Text style={styles.noticeText}>
              Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the current EAS Environment. Practice remains available without it.
            </Text>
          </View>
        ) : auth.isSignedIn ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>You are signed in</Text>
            <Text style={styles.noticeText}>Opening your account…</Text>
          </View>
        ) : (
          <ClerkSignInForm />
        )}

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Create an account on the Girapphe website"
          onPress={() => void Linking.openURL(`${appBaseUrl}/signup`)}
          style={({ pressed }) => [styles.webLink, pressed && styles.pressed]}
        >
          <Text style={styles.webLinkText}>Need an account? Sign up on the web</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ClerkSignInForm() {
  const router = useRouter();
  const form = useClerkEmailPasswordSignIn();

  async function submit() {
    if (await form.submit()) router.replace('/(tabs)/account');
  }

  return (
    <View style={styles.formCard}>
      <Text style={styles.label}>Email</Text>
      <TextInput
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={form.setEmailAddress}
        placeholder="you@example.com"
        returnKeyType="next"
        style={styles.input}
        textContentType="emailAddress"
        value={form.emailAddress}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        accessibilityLabel="Password"
        autoCapitalize="none"
        autoComplete="current-password"
        onChangeText={form.setPassword}
        onSubmitEditing={() => void submit()}
        placeholder="Password"
        returnKeyType="go"
        secureTextEntry
        style={styles.input}
        textContentType="password"
        value={form.password}
      />

      {form.error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {form.error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign in"
        accessibilityState={{ disabled: form.isBusy }}
        disabled={form.isBusy}
        onPress={() => void submit()}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, form.isBusy && styles.disabled]}
      >
        <Text style={styles.primaryButtonText}>{form.isBusy ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' },
  content: { flexGrow: 1, padding: 20, paddingBottom: 36 },
  kicker: { color: '#47606f', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#111827', fontSize: 30, fontWeight: '900', lineHeight: 36, marginTop: 6 },
  intro: { color: '#607080', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 18 },
  formCard: { borderRadius: 12, borderWidth: 1, borderColor: '#e0e5ec', backgroundColor: '#ffffff', padding: 18 },
  label: { color: '#111827', fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 8 },
  input: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: '#cbd3df', color: '#111827', backgroundColor: '#ffffff', paddingHorizontal: 14, fontSize: 16 },
  primaryButton: { minHeight: 50, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  noticeCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d8dee8', backgroundColor: '#ffffff', padding: 18 },
  noticeTitle: { color: '#111827', fontSize: 17, fontWeight: '900' },
  noticeText: { color: '#607080', fontSize: 14, lineHeight: 21, marginTop: 7 },
  errorText: { color: '#b42318', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 10 },
  webLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  webLinkText: { color: '#1f5fd1', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
