import {
  createSuperwallClient,
  type SuperwallNativeModule,
  type SuperwallPlatformConfiguration,
} from './superwall-contract';

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

type SuperwallExports = {
  DefaultSuperwallOptions: Record<string, unknown>;
  SuperwallExpoModule: unknown;
};

type SuperwallModuleLoader = () => SuperwallExports;

export function getSuperwallPlatformConfiguration(platform: string): SuperwallPlatformConfiguration | null {
  const configuration = platform === 'ios'
    ? {
        apiKey: clean(process.env.EXPO_PUBLIC_SUPERWALL_IOS_API_KEY),
        store: 'app_store' as const,
        monthlyProductId: clean(process.env.EXPO_PUBLIC_SUPERWALL_IOS_MONTHLY_PURCHASE_IDENTIFIER),
        annualProductId: clean(process.env.EXPO_PUBLIC_SUPERWALL_IOS_ANNUAL_PURCHASE_IDENTIFIER),
      }
    : platform === 'android'
      ? {
          apiKey: clean(process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY),
          store: 'play_store' as const,
          monthlyProductId: clean(process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_MONTHLY_PURCHASE_IDENTIFIER),
          annualProductId: clean(process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_ANNUAL_PURCHASE_IDENTIFIER),
        }
      : null;
  return configuration?.apiKey ? configuration : null;
}

function loadSuperwallModule(): SuperwallExports {
  // Expo must resolve this native module only after the platform guard above.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-superwall') as SuperwallExports;
}

export function createConfiguredSuperwallClient(
  platform: string,
  platformConfiguration: SuperwallPlatformConfiguration | null,
  moduleLoader: SuperwallModuleLoader = loadSuperwallModule,
) {
  if (platform === 'web' || !platformConfiguration) return null;

  try {
    const superwallExports = moduleLoader();
    const nativeOptions: Record<string, unknown> = {
      ...superwallExports.DefaultSuperwallOptions,
      paywalls: {
        ...(superwallExports.DefaultSuperwallOptions as Record<string, unknown>).paywalls as Record<string, unknown>,
        shouldPreload: false,
      },
      logging: {
        ...(superwallExports.DefaultSuperwallOptions as Record<string, unknown>).logging as Record<string, unknown>,
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

    return createSuperwallClient(
      superwallExports.SuperwallExpoModule as unknown as SuperwallNativeModule,
      platformConfiguration,
      nativeOptions,
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('Superwall SDK is unavailable; mobile subscriptions are disabled in this environment.', error);
    } else {
      console.error('Superwall SDK is unavailable; mobile subscriptions are disabled.');
    }
    return null;
  }
}
