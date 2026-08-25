import { useState } from 'react';
import { useReverification } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { mobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import { useI18n } from '@/i18n';
import { useSubscription } from '@/subscriptions';

export default function AccountScreen() {
  const router = useRouter();
  const auth = useMobileAuth();
  const subscription = useSubscription();
  const { direction, formatNumber, t } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const deleteAccountWithReverification = useReverification(mobileApi.deleteAccount);
  const supportUrl = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim() || 'https://www.girapphe.com/support';
  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim() || 'https://www.girapphe.com/terms';
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || 'https://www.girapphe.com/privacy';
  const deletionUrl = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL?.trim() || 'https://www.girapphe.com/account/delete';

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
      setPrivacyNotice(t('account.adPrivacyUnavailable'));
    }
  }

  async function deleteAccount() {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeletionError(null);
    try {
      const result = await deleteAccountWithReverification() as unknown as { deleted?: boolean };
      if (!result?.deleted) throw new Error('deletion_failed');
      await auth.signOut().catch(() => undefined);
      router.replace('/');
    } catch {
      setDeletionError(t('account.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  }

  function confirmAccountDeletion() {
    Alert.alert(
      t('account.deleteTitle'),
      t('account.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('account.deleteConfirm'), style: 'destructive', onPress: () => void deleteAccount() },
      ],
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{t('tabs.account')}</Text>
        <Text style={styles.title}>{auth.isSignedIn ? t('account.signedInTitle') : t('account.guestTitle')}</Text>

        {!auth.isLoaded ? (
          <InfoCard title={t('auth.loading')} body={t('account.loadingBody')} />
        ) : !auth.configured ? (
          <>
            <InfoCard
              title={t('account.guestAvailable')}
              body={t('account.clerkMissingBody')}
            />
            <PrimaryButton label={t('account.viewSetup')} onPress={() => router.push('/sign-in')} />
          </>
        ) : !auth.isSignedIn ? (
          <>
            <InfoCard
              title={t('account.signInBeforePurchase')}
              body={t('account.signInBeforePurchaseBody')}
            />
            <PrimaryButton label={t('auth.signIn')} onPress={() => router.push('/sign-in')} />
          </>
        ) : (
          <>
            <View style={styles.accountCard}>
              <Text style={styles.accountLabel}>{t('account.signedInAs')}</Text>
              <Text style={[styles.accountValue, auth.email ? styles.ltrText : null]}>{auth.email || t('account.clerkAccount')}</Text>
              <Text style={styles.accountLabel}>{t('account.subscriptionCustomerId')}</Text>
              <Text selectable style={[styles.userId, styles.ltrText]}>{auth.userId}</Text>
            </View>

            <View style={styles.entitlementCard}>
              <View style={styles.entitlementHeader}>
                <Text style={styles.entitlementTitle}>{t('subscription.kicker')}</Text>
                <Text style={[styles.statusPill, subscription.isAdFree && styles.statusPillActive]}>
                  {subscription.isAdFree ? t('account.statusActive') : t('account.statusFree')}
                </Text>
              </View>
              <Text style={styles.entitlementBody}>
                {subscription.isAdFree
                  ? t('account.adFreeActiveBody')
                  : t('account.freePracticeBody', { count: formatNumber(5) })}
              </Text>
            </View>

            <PrimaryButton label={subscription.isAdFree ? t('account.manageSubscription') : t('account.seePlans')} onPress={() => router.push('/subscription')} />
            <SecondaryButton label={t('account.refreshPurchase')} onPress={() => void subscription.refresh()} />
            <SecondaryButton label={isSigningOut ? t('account.signingOut') : t('auth.signOut')} disabled={isSigningOut} onPress={() => void signOut()} />
            <DangerButton
              label={isDeleting ? t('account.deleting') : t('account.deleteAccount')}
              disabled={isDeleting}
              onPress={confirmAccountDeletion}
            />
            {deletionError ? <Text accessibilityLiveRegion="polite" style={styles.deletionError}>{deletionError}</Text> : null}
            {deletionError ? <SecondaryButton label={t('account.openDeletionWeb')} onPress={() => void Linking.openURL(deletionUrl)} /> : null}
          </>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('account.learningTools')}</Text>
          <Text style={styles.sectionBody}>{t('account.learningToolsBody')}</Text>
          <SecondaryButton label={t('progress.title')} onPress={() => router.push('/(tabs)/progress')} />
          <SecondaryButton label={t('account.reviewQueue')} onPress={() => router.push('/(tabs)/review')} />
          <SecondaryButton label={t('ranking.title')} onPress={() => router.push('/(tabs)/ranking')} />
        </View>

        <SecondaryButton label={t('account.adPrivacyChoices')} onPress={() => void openAdPrivacyChoices()} />
        {privacyNotice ? <Text style={styles.privacyNotice}>{privacyNotice}</Text> : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('account.legal')}</Text>
          <Text style={styles.sectionBody}>{t('account.legalBody')}</Text>
          <SecondaryButton label={t('account.support')} onPress={() => void Linking.openURL(supportUrl)} />
          <SecondaryButton label={t('account.terms')} onPress={() => void Linking.openURL(termsUrl)} />
          <SecondaryButton label={t('account.privacy')} onPress={() => void Linking.openURL(privacyUrl)} />
        </View>
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

function DangerButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.dangerButtonText}>{label}</Text>
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
  ltrText: { textAlign: 'left', writingDirection: 'ltr' },
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
  dangerButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: '#f1a5a5', backgroundColor: '#fff7f7', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  dangerButtonText: { color: '#a51d1d', fontSize: 15, fontWeight: '900' },
  deletionError: { color: '#b42318', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 10 },
  disabled: { opacity: 0.55 },
  privacyNotice: { color: '#607080', fontSize: 12, lineHeight: 18, marginTop: 8 },
  pressed: { opacity: 0.72 },
});
