import { useRouter } from 'expo-router';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMobileAuth } from '@/auth';
import { appBaseUrl, useSubscription, type SubscriptionPlan } from '@/subscriptions';

const configuredTermsUrl = process.env.EXPO_PUBLIC_TERMS_URL?.trim();
const configuredPrivacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
const termsUrl = configuredTermsUrl && /^https:\/\//.test(configuredTermsUrl)
  ? configuredTermsUrl
  : null;
const privacyUrl = configuredPrivacyUrl && /^https:\/\//.test(configuredPrivacyUrl)
  ? configuredPrivacyUrl
  : null;

export default function SubscriptionScreen() {
  const router = useRouter();
  const auth = useMobileAuth();
  const subscription = useSubscription();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Ad-free</Text>
        <Text style={styles.title}>Remove every sponsored practice card</Text>
        <Text style={styles.intro}>
          Card creation and review stay free. The subscription benefit is ad removal across supported mobile stores.
        </Text>

        <View style={styles.benefitCard}>
          <Text style={styles.benefitTitle}>ad_free entitlement</Text>
          <Text style={styles.benefitText}>No NativeAd requests, no house promotion cards, and no ad interruption after 5 advances.</Text>
        </View>

        {!auth.configured ? (
          <SetupNotice body="Clerk is not configured for this build. Add the publishable key before offering account-linked purchases." />
        ) : !auth.isSignedIn ? (
          <>
            <SetupNotice body="Sign in first so RevenueCat uses your Clerk user ID instead of an anonymous device identity." />
            <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
          </>
        ) : !subscription.isReady ? (
          <SetupNotice body="Checking your web and store subscription status…" />
        ) : subscription.isAdFree ? (
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>Ad-free is active</Text>
            <Text style={styles.activeText}>This Clerk account currently has the ad_free entitlement across supported platforms.</Text>
          </View>
        ) : !subscription.isConfigured ? (
          <SetupNotice body="The RevenueCat public SDK key for this platform is missing. Practice continues with the safe sponsored fallback." />
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
          <SetupNotice body="No monthly or annual package is attached to the current RevenueCat offering yet." />
        )}

        {subscription.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {subscription.error}
          </Text>
        ) : null}

        {auth.isSignedIn && subscription.isConfigured ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            accessibilityState={{ disabled: subscription.isBusy }}
            disabled={subscription.isBusy}
            onPress={() => void subscription.restore()}
            style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed, subscription.isBusy && styles.disabled]}
          >
            <Text style={styles.restoreButtonText}>{subscription.isBusy ? 'Contacting store…' : 'Restore purchases'}</Text>
          </Pressable>
        ) : null}

        {auth.isSignedIn && subscription.isAdFree ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Manage active subscription"
            onPress={() => void Linking.openURL(subscription.managementUrl || `${appBaseUrl}/subscription`)}
            style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
          >
            <Text style={styles.restoreButtonText}>Manage active subscription</Text>
          </Pressable>
        ) : null}

        <Text style={styles.termsText}>
          Prices, introductory offers, renewal terms, and eligibility are shown by the App Store or Google Play purchase sheet. Manage or cancel through the store used to subscribe.
        </Text>
        {termsUrl && privacyUrl ? (
          <View style={styles.legalLinks}>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(termsUrl)}>
              <Text style={styles.legalLinkText}>Terms of Use</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(privacyUrl)}>
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({ plan, disabled, onPurchase }: { plan: SubscriptionPlan; disabled: boolean; onPurchase: () => void }) {
  return (
    <View style={styles.planCard}>
      <View style={styles.planHeader}>
        <View>
          <Text style={styles.planTitle}>{plan.title}</Text>
          <Text style={styles.planProduct}>{plan.productIdentifier}</Text>
        </View>
        <Text style={styles.planPrice}>{plan.price}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Subscribe to the ${plan.title.toLowerCase()} ad-free plan for ${plan.price}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPurchase}
        style={({ pressed }) => [styles.planButton, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Text style={styles.planButtonText}>Choose {plan.title.toLowerCase()}</Text>
      </Pressable>
    </View>
  );
}

function SetupNotice({ body }: { body: string }) {
  return (
    <View style={styles.noticeCard}>
      <Text style={styles.noticeTitle}>Setup needed</Text>
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
  noticeCard: { borderRadius: 12, borderWidth: 1, borderColor: '#e0e5ec', backgroundColor: '#ffffff', padding: 18 },
  noticeTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  noticeText: { color: '#607080', fontSize: 14, lineHeight: 21, marginTop: 7 },
  planList: { gap: 12 },
  planCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d8dee8', backgroundColor: '#ffffff', padding: 18 },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  planTitle: { color: '#111827', fontSize: 20, fontWeight: '900' },
  planProduct: { color: '#607080', fontSize: 11, fontWeight: '700', marginTop: 4 },
  planPrice: { color: '#111827', fontSize: 19, fontWeight: '900' },
  planButton: { minHeight: 48, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  planButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  primaryButton: { minHeight: 50, borderRadius: 8, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
  restoreButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: '#cbd3df', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  restoreButtonText: { color: '#111827', fontSize: 15, fontWeight: '800' },
  errorText: { color: '#b42318', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 12 },
  termsText: { color: '#73808c', fontSize: 12, lineHeight: 18, marginTop: 18 },
  legalLinks: { flexDirection: 'row', gap: 18, marginTop: 12 },
  legalLinkText: { color: '#1f5fd1', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
