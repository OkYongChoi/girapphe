import { useEffect, useRef } from 'react';
import { type Href, useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMobileAuth } from '@/auth';
import { useI18n } from '@/i18n';
import { appBaseUrl, useSubscription, type SubscriptionPlan } from '@/subscriptions';
import { buildMobileAuthContinuationParams } from '@/auth-continuation';
import {
  advanceDuplicateSubscriptionAnnouncement,
  duplicateSubscriptionAnnouncementKey,
} from '@/subscription-accessibility';

const configuredTermsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim();
const configuredPrivacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
const configuredSupportUrl = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim();
const termsUrl = configuredTermsUrl && /^https:\/\//.test(configuredTermsUrl)
  ? configuredTermsUrl
  : null;
const privacyUrl = configuredPrivacyUrl && /^https:\/\//.test(configuredPrivacyUrl)
  ? configuredPrivacyUrl
  : null;
const supportUrl = configuredSupportUrl && /^https:\/\//.test(configuredSupportUrl)
  ? configuredSupportUrl
  : null;

export default function SubscriptionScreen() {
  const router = useRouter();
  const auth = useMobileAuth();
  const subscription = useSubscription();
  const { direction, formatDate, formatNumber, locale, t } = useI18n();
  const announcedDuplicateKey = useRef<string | null>(null);
  const active = subscription.activeSubscription;
  const legacyWebProvider = active?.provider === 'stripe'
    ? 'Stripe'
    : active?.provider === 'toss'
      ? 'Toss Payments'
      : active?.provider ?? '';
  const source = active?.provider === 'creem'
    ? t('subscription.sourceWeb')
    : active?.store === 'app_store'
      ? t('subscription.sourceApple')
      : active?.store === 'play_store'
        ? t('subscription.sourceGoogle')
        : active?.store === 'web'
          ? t('subscription.sourceLegacyWeb', { provider: legacyWebProvider })
          : null;
  const accessThroughDate = active?.currentPeriodEnd
    ? new Date(active.currentPeriodEnd)
    : null;
  const accessThrough = accessThroughDate && Number.isFinite(accessThroughDate.getTime())
    ? formatDate(accessThroughDate, { dateStyle: 'medium' })
    : null;
  const duplicateAnnouncement = [
    t('subscription.duplicateTitle'),
    t('subscription.duplicateBody'),
  ].join('\n');
  const duplicateAnnouncementKey = duplicateSubscriptionAnnouncementKey(
    auth.userId,
    locale,
    subscription.duplicateDetected,
  );

  useEffect(() => {
    const transition = advanceDuplicateSubscriptionAnnouncement(
      announcedDuplicateKey.current,
      duplicateAnnouncementKey,
    );
    announcedDuplicateKey.current = transition.key;
    if (transition.shouldAnnounce && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(duplicateAnnouncement);
    }
  }, [duplicateAnnouncement, duplicateAnnouncementKey]);

  return (
    <SafeAreaView style={[styles.safeArea, { direction }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{t('subscription.kicker')}</Text>
        <Text style={styles.title}>{t('subscription.title')}</Text>
        <Text style={styles.intro}>{t('subscription.intro')}</Text>

        <View style={styles.benefitCard}>
          <Text style={styles.benefitTitle}>{t('subscription.benefitTitle')}</Text>
          <Text style={styles.benefitText}>{t('subscription.benefitText', { count: formatNumber(5) })}</Text>
        </View>

        {subscription.duplicateDetected ? (
          <View
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
            style={styles.duplicateCard}
          >
            <Text style={styles.duplicateTitle}>{t('subscription.duplicateTitle')}</Text>
            <Text style={styles.duplicateText}>{t('subscription.duplicateBody')}</Text>
            {supportUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(supportUrl)}
                style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}
              >
                <Text style={styles.inlineLinkText}>{t('subscription.contactSupport')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!auth.configured ? (
          <SetupNotice body={t('subscription.clerkMissing')} />
        ) : !auth.isSignedIn ? (
          <>
            <SetupNotice body={t('subscription.signInFirst')} />
            <PrimaryButton
              label={t('auth.signIn')}
              onPress={() => router.push({
                pathname: '/sign-in',
                params: buildMobileAuthContinuationParams({ destination: 'subscription' }),
              } as Href)}
            />
          </>
        ) : !subscription.isReady ? (
          <SetupNotice body={t('subscription.checking')} title={t('subscription.kicker')} />
        ) : subscription.isAdFree ? (
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>{t('subscription.activeTitle')}</Text>
            <Text style={styles.activeText}>{t('subscription.activeText')}</Text>
            {active && source ? (
              <Text style={styles.activeMeta}>
                {t('subscription.activeMeta', {
                  plan: active.plan === 'annual' ? t('subscription.annual') : t('subscription.monthly'),
                  source,
                  date: accessThrough ?? t('subscription.datePending'),
                })}
              </Text>
            ) : null}
            {active?.cancelAtPeriodEnd ? (
              <Text style={styles.activeMeta}>{t('subscription.cancelsAtPeriodEnd')}</Text>
            ) : null}
          </View>
        ) : subscription.isConfirming || subscription.acquisitionBlocked ? (
          <SetupNotice body={t('subscription.confirming')} title={t('subscription.kicker')} />
        ) : !subscription.isConfigured ? (
          <SetupNotice body={t('subscription.storeKeyMissing')} />
        ) : !subscription.acquisitionEnabled ? (
          <SetupNotice body={t('subscription.acquisitionDisabled')} title={t('subscription.kicker')} />
        ) : subscription.plans.length > 0 ? (
          <View style={styles.planList}>
            {subscription.plans.map((plan) => (
              <PlanCard
                key={plan.id}
                disabled={subscription.isBusy}
                onPurchase={() => void subscription.purchase(plan.id)}
                plan={plan}
              />
            ))}
          </View>
        ) : (
          <SetupNotice body={t('subscription.noPlans')} />
        )}

        {subscription.trialProductIds.length > 0 ? (
          <Text accessibilityLiveRegion="polite" style={styles.trialNotice}>
            {t('subscription.existingTrialDetected')}
          </Text>
        ) : null}

        {subscription.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {subscription.error}
          </Text>
        ) : null}

        {auth.isSignedIn && subscription.isReady && subscription.acquisitionBlocked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('subscription.refreshStatus')}
            accessibilityState={{ disabled: subscription.isBusy }}
            disabled={subscription.isBusy}
            onPress={() => void subscription.refresh()}
            style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed, subscription.isBusy && styles.disabled]}
          >
            <Text style={styles.restoreButtonText}>{t('subscription.refreshStatus')}</Text>
          </Pressable>
        ) : null}

        {auth.isSignedIn && subscription.isConfigured ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('subscription.restore')}
            accessibilityState={{ disabled: subscription.isBusy }}
            disabled={subscription.isBusy}
            onPress={() => void subscription.restore()}
            style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed, subscription.isBusy && styles.disabled]}
          >
            <Text style={styles.restoreButtonText}>{subscription.isBusy ? t('subscription.contactingStore') : t('subscription.restore')}</Text>
          </Pressable>
        ) : null}

        {auth.isSignedIn && subscription.isAdFree ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('subscription.manageActive')}
            onPress={() => void Linking.openURL(subscription.managementUrl || `${appBaseUrl}/subscription`)}
            style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
          >
            <Text style={styles.restoreButtonText}>{t('subscription.manageActive')}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.termsText}>{t('subscription.termsText')}</Text>
        {termsUrl && privacyUrl ? (
          <View style={styles.legalLinks}>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(termsUrl)}>
              <Text style={styles.legalLinkText}>{t('subscription.terms')}</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(privacyUrl)}>
              <Text style={styles.legalLinkText}>{t('subscription.privacy')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({ plan, disabled, onPurchase }: { plan: SubscriptionPlan; disabled: boolean; onPurchase: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.planCard}>
      <View style={styles.planHeader}>
        <View>
          <Text style={styles.planTitle}>{plan.title}</Text>
          <Text style={[styles.planProduct, styles.ltrText]}>{plan.productIdentifier}</Text>
        </View>
        <Text style={styles.planPrice}>{plan.price}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('subscription.subscribeA11y', { plan: plan.title, price: plan.price })}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPurchase}
        style={({ pressed }) => [styles.planButton, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Text style={styles.planButtonText}>{t('subscription.choosePlan', { plan: plan.title })}</Text>
      </Pressable>
    </View>
  );
}

function SetupNotice({ body, title }: { body: string; title?: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.noticeCard}>
      <Text style={styles.noticeTitle}>{title ?? t('subscription.setupNeeded')}</Text>
      <Text style={styles.noticeText}>{body}</Text>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8fb' },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  kicker: { color: '#47606f', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#111827', fontSize: 31, fontWeight: '900', lineHeight: 37, marginTop: 5 },
  intro: { color: '#607080', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 16 },
  benefitCard: { borderRadius: 12, backgroundColor: '#18212f', padding: 18, marginBottom: 14 },
  benefitTitle: { color: '#ffffff', fontSize: 19, fontWeight: '900' },
  benefitText: { color: '#d7dee8', fontSize: 14, lineHeight: 21, marginTop: 8 },
  activeCard: { borderRadius: 12, borderWidth: 1, borderColor: '#a6e7bd', backgroundColor: '#eafcf0', padding: 18 },
  activeTitle: { color: '#176b38', fontSize: 19, fontWeight: '900' },
  activeText: { color: '#2a7145', fontSize: 14, lineHeight: 21, marginTop: 7 },
  activeMeta: { color: '#2a7145', fontSize: 12, lineHeight: 18, marginTop: 7 },
  duplicateCard: { borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fffbeb', padding: 18, marginBottom: 14 },
  duplicateTitle: { color: '#78350f', fontSize: 18, fontWeight: '900' },
  duplicateText: { color: '#92400e', fontSize: 14, lineHeight: 21, marginTop: 7 },
  inlineLink: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 6 },
  inlineLinkText: { color: '#1d4ed8', fontSize: 14, fontWeight: '900', textDecorationLine: 'underline' },
  noticeCard: { borderRadius: 12, borderWidth: 1, borderColor: '#e0e5ec', backgroundColor: '#ffffff', padding: 18 },
  noticeTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  noticeText: { color: '#607080', fontSize: 14, lineHeight: 21, marginTop: 7 },
  planList: { gap: 12 },
  planCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d8dee8', backgroundColor: '#ffffff', padding: 18 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  planTitle: { color: '#111827', fontSize: 20, fontWeight: '900' },
  planProduct: { color: '#607080', fontSize: 11, fontWeight: '700', marginTop: 4 },
  ltrText: { textAlign: 'left', writingDirection: 'ltr' },
  planPrice: { color: '#111827', fontSize: 19, fontWeight: '900' },
  planButton: { minHeight: 48, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  planButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  primaryButton: { minHeight: 50, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  restoreButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: '#cbd3df', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  restoreButtonText: { color: '#111827', fontSize: 15, fontWeight: '800' },
  errorText: { color: '#b42318', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 12 },
  trialNotice: { color: '#8a4b0f', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 12 },
  termsText: { color: '#73808c', fontSize: 12, lineHeight: 18, marginTop: 18 },
  legalLinks: { flexDirection: 'row', gap: 18, marginTop: 12 },
  legalLinkText: { color: '#1f5fd1', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
