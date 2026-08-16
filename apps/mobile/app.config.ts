import type { ConfigContext, ExpoConfig } from 'expo/config';

const GOOGLE_SAMPLE_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const GOOGLE_SAMPLE_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

function clean(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function requireProductionUrl(name: string): void {
  const value = clean(process.env[name]);
  if (!value) throw new Error(`Production builds require ${name}.`);
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.hostname.endsWith('.example')
      || url.hostname === 'example.com'
    ) throw new Error('invalid production URL');
  } catch {
    throw new Error(`Production builds require ${name} to be an absolute HTTPS URL.`);
  }
}

function requireProductionPattern(name: string, pattern: RegExp, description: string): string {
  const value = clean(process.env[name]);
  if (!value || !pattern.test(value)) {
    throw new Error(`Production builds require ${name} to be ${description}.`);
  }
  return value;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = config as ExpoConfig;
  const isProduction = process.env.EAS_BUILD_PROFILE === 'production';
  const clerkPublishableKey = clean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const appBaseUrl = clean(process.env.EXPO_PUBLIC_APP_BASE_URL);
  const monthlyPackageId = clean(process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PACKAGE_ID) ?? '$rc_monthly';
  const annualPackageId = clean(process.env.EXPO_PUBLIC_REVENUECAT_ANNUAL_PACKAGE_ID) ?? '$rc_annual';
  const iosAppId = isProduction
    ? clean(process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID)
    : GOOGLE_SAMPLE_IOS_APP_ID;
  const androidAppId = isProduction
    ? clean(process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID)
    : GOOGLE_SAMPLE_ANDROID_APP_ID;
  if (!isProduction && clerkPublishableKey) {
    if (!/^pk_test_[A-Za-z0-9_]{12,}$/.test(clerkPublishableKey)) {
      throw new Error('Non-production builds require a Clerk pk_test_ publishable key.');
    }
    if (!appBaseUrl || appBaseUrl === 'https://www.girapphe.com') {
      throw new Error('Non-production Clerk builds require a matching non-production EXPO_PUBLIC_APP_BASE_URL.');
    }
    try {
      const parsed = new URL(appBaseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('invalid non-production URL');
      }
    } catch {
      throw new Error('Non-production EXPO_PUBLIC_APP_BASE_URL must be an absolute http(s) URL without credentials.');
    }
  }
  if (isProduction) {
    requireProductionPattern(
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
      /^pk_live_[A-Za-z0-9_]{12,}$/,
      'a Clerk live publishable key',
    );
    requireProductionPattern(
      'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
      /^appl_[A-Za-z0-9_]+$/,
      'a RevenueCat Apple public SDK key',
    );
    requireProductionPattern(
      'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
      /^goog_[A-Za-z0-9_]+$/,
      'a RevenueCat Google public SDK key',
    );
    const productionIosAppId = requireProductionPattern(
      'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
      /^ca-app-pub-\d+~\d+$/,
      'an AdMob iOS app ID',
    );
    const productionAndroidAppId = requireProductionPattern(
      'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
      /^ca-app-pub-\d+~\d+$/,
      'an AdMob Android app ID',
    );
    const productionIosUnitId = requireProductionPattern(
      'EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID',
      /^ca-app-pub-\d+\/\d+$/,
      'an AdMob iOS NativeAd unit ID',
    );
    const productionAndroidUnitId = requireProductionPattern(
      'EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID',
      /^ca-app-pub-\d+\/\d+$/,
      'an AdMob Android NativeAd unit ID',
    );
    if (productionIosAppId === productionAndroidAppId) {
      throw new Error('Production iOS and Android AdMob app IDs must be distinct.');
    }
    if (productionIosUnitId === productionAndroidUnitId) {
      throw new Error('Production iOS and Android NativeAd unit IDs must be distinct.');
    }
    if (monthlyPackageId === annualPackageId) {
      throw new Error('RevenueCat monthly and annual package IDs must be distinct.');
    }
    requireProductionUrl('EXPO_PUBLIC_APP_BASE_URL');
    if (clean(process.env.EXPO_PUBLIC_APP_BASE_URL) !== 'https://www.girapphe.com') {
      throw new Error('Production EXPO_PUBLIC_APP_BASE_URL must be exactly https://www.girapphe.com.');
    }
    requireProductionUrl('EXPO_PUBLIC_TERMS_URL');
    requireProductionUrl('EXPO_PUBLIC_PRIVACY_URL');
  }
  const adMobPlugin: NonNullable<ExpoConfig['plugins']>[number] | null = iosAppId || androidAppId
    ? [
        'react-native-google-mobile-ads',
        {
          ...(iosAppId ? { iosAppId } : {}),
          ...(androidAppId ? { androidAppId } : {}),
          delayAppMeasurementInit: true,
          userTrackingUsageDescription:
            'This identifier may be used to deliver and measure ads when you allow tracking.',
        },
      ]
    : null;

  return {
    ...baseConfig,
    extra: {
      ...baseConfig.extra,
      easBuildProfile: process.env.EAS_BUILD_PROFILE ?? 'development',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      ...(adMobPlugin ? [adMobPlugin] : []),
    ],
  };
};
