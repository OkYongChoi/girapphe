import {
  DefaultSuperwallOptions,
  SuperwallExpoModule,
} from 'expo-superwall';
import { Platform } from 'react-native';
import {
  createSuperwallClient,
  type SuperwallNativeModule,
  type SuperwallPlatformConfiguration,
} from './superwall-contract';

export * from './superwall-contract';

const iosConfiguration: SuperwallPlatformConfiguration = {
  apiKey: process.env.EXPO_PUBLIC_SUPERWALL_IOS_API_KEY?.trim() ?? '',
  store: 'app_store',
  monthlyProductId: process.env.EXPO_PUBLIC_SUPERWALL_IOS_MONTHLY_PURCHASE_IDENTIFIER?.trim() ?? '',
  annualProductId: process.env.EXPO_PUBLIC_SUPERWALL_IOS_ANNUAL_PURCHASE_IDENTIFIER?.trim() ?? '',
};

const androidConfiguration: SuperwallPlatformConfiguration = {
  apiKey: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY?.trim() ?? '',
  store: 'play_store',
  monthlyProductId: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_MONTHLY_PURCHASE_IDENTIFIER?.trim() ?? '',
  annualProductId: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_ANNUAL_PURCHASE_IDENTIFIER?.trim() ?? '',
};

export function getSuperwallPlatformConfiguration(): SuperwallPlatformConfiguration | null {
  if (Platform.OS === 'ios') return iosConfiguration;
  if (Platform.OS === 'android') return androidConfiguration;
  return null;
}

const configuration = getSuperwallPlatformConfiguration();
const nativeOptions: Record<string, unknown> = {
  ...DefaultSuperwallOptions,
  paywalls: {
    ...DefaultSuperwallOptions.paywalls,
    shouldPreload: false,
  },
  logging: {
    ...DefaultSuperwallOptions.logging,
    level: __DEV__ ? 'debug' : 'info',
  },
  // Infrastructure events are required for subscription status and webhooks;
  // Girapphe does not send unrelated app analytics or use paywall campaigns.
  eventTrackingBehavior: 'superwallOnly',
  manualPurchaseManagement: false,
  passIdentifiersToPlayStore: true,
  shouldObservePurchases: false,
  // Real StoreKit / Play sandbox transactions are required for activation;
  // dashboard test purchases must not masquerade as provider verification.
  testModeBehavior: 'never',
};

export const superwallClient = configuration
  ? createSuperwallClient(
      SuperwallExpoModule as unknown as SuperwallNativeModule,
      configuration,
      nativeOptions,
    )
  : null;
