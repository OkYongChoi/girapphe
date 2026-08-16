import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMobileAuth } from '@/auth';
import { useSubscription } from '@/subscriptions';

export default function AccountScreen() {
  const router = useRouter();
  const auth = useMobileAuth();
  const subscription = useSubscription();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await auth.signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  async function openAdPrivacyChoices() {
    setPrivacyNotice(null);
    try {
      const { AdsConsent } = await import('react-native-google-mobile-ads');
      await AdsConsent.showPrivacyOptionsForm();
    } catch {
      setPrivacyNotice('Ad privacy choices are available in a configured native build when required for your region.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Account</Text>
        <Text style={styles.title}>{auth.isSignedIn ? 'Your Girapphe account' : 'Practice now, sync when ready'}</Text>

        {!auth.isLoaded ? (
          <InfoCard title="Loading account…" body="Checking your saved mobile session." />
        ) : !auth.configured ? (
          <>
            <InfoCard
              title="Guest practice is available"
              body="Clerk is not configured for this build. Add the mobile publishable key to enable account-linked purchases and restore."
            />
            <PrimaryButton label="View setup status" onPress={() => router.push('/sign-in')} />
          </>
        ) : !auth.isSignedIn ? (
          <>
            <InfoCard
              title="Sign in before purchasing"
              body="A signed-in Clerk user ID prevents a subscription from becoming attached only to an anonymous device."
            />
            <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
          </>
        ) : (
          <>
            <View style={styles.accountCard}>
              <Text style={styles.accountLabel}>Signed in as</Text>
              <Text style={styles.accountValue}>{auth.email || 'Clerk account'}</Text>
              <Text style={styles.accountLabel}>Subscription customer ID</Text>
              <Text selectable style={styles.userId}>{auth.userId}</Text>
            </View>

            <View style={styles.entitlementCard}>
              <View style={styles.entitlementHeader}>
                <Text style={styles.entitlementTitle}>Ad-free</Text>
                <Text style={[styles.statusPill, subscription.isAdFree && styles.statusPillActive]}>
                  {subscription.isAdFree ? 'ACTIVE' : 'FREE'}
                </Text>
              </View>
              <Text style={styles.entitlementBody}>
                {subscription.isAdFree
                  ? 'This Clerk account has ad_free from the web or a supported store. Sponsored practice cards are not mounted.'
                  : 'Free practice includes one clearly labeled sponsored card after every 5 card advances.'}
              </Text>
            </View>

            <PrimaryButton label={subscription.isAdFree ? 'Manage subscription' : 'See ad-free plans'} onPress={() => router.push('/subscription')} />
            <SecondaryButton label="Refresh purchase status" onPress={() => void subscription.refresh()} />
            <SecondaryButton label={isSigningOut ? 'Signing out…' : 'Sign out'} disabled={isSigningOut} onPress={() => void signOut()} />
          </>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Learning tools</Text>
          <Text style={styles.sectionBody}>Open the synced progress, review, and community views without crowding the tab bar.</Text>
          <SecondaryButton label="Progress" onPress={() => router.push('/(tabs)/progress')} />
          <SecondaryButton label="Review queue" onPress={() => router.push('/(tabs)/review')} />
          <SecondaryButton label="Ranking" onPress={() => router.push('/(tabs)/ranking')} />
        </View>

        <SecondaryButton label="Ad privacy choices" onPress={() => void openAdPrivacyChoices()} />
        {privacyNotice ? <Text style={styles.privacyNotice}>{privacyNotice}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36 },
  kicker: { color: '#47606f', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#111827', fontSize: 30, fontWeight: '900', lineHeight: 36, marginTop: 5, marginBottom: 18 },
  infoCard: { borderRadius: 12, borderWidth: 1, borderColor: '#e0e5ec', backgroundColor: '#ffffff', padding: 18, marginBottom: 14 },
  infoTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  infoBody: { color: '#607080', fontSize: 14, lineHeight: 21, marginTop: 7 },
  accountCard: { borderRadius: 12, backgroundColor: '#18212f', padding: 18, marginBottom: 14 },
  accountLabel: { color: '#aebac9', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 7 },
  accountValue: { color: '#ffffff', fontSize: 20, fontWeight: '900', marginTop: 4, marginBottom: 12 },
  userId: { color: '#d7dee8', fontSize: 13, lineHeight: 19, marginTop: 4 },
  entitlementCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d8dee8', backgroundColor: '#ffffff', padding: 18, marginBottom: 14 },
  entitlementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  entitlementTitle: { color: '#111827', fontSize: 19, fontWeight: '900' },
  statusPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#eef1f5', color: '#607080', fontSize: 11, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 6 },
  statusPillActive: { backgroundColor: '#d9fbe5', color: '#176b38' },
  entitlementBody: { color: '#607080', fontSize: 14, lineHeight: 21, marginTop: 12 },
  sectionCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d8dee8', backgroundColor: '#ffffff', padding: 16, marginTop: 14 },
  sectionTitle: { color: '#111827', fontSize: 17, fontWeight: '900' },
  sectionBody: { color: '#607080', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 2 },
  primaryButton: { minHeight: 52, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: '#cbd3df', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#111827', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  privacyNotice: { color: '#607080', fontSize: 12, lineHeight: 18, marginTop: 8 },
  pressed: { opacity: 0.72 },
});
