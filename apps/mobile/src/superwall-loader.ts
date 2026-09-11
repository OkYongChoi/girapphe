import {
  createSuperwallClient,
  type SuperwallNativeModule,
  type SuperwallPlatformConfiguration,
} from './superwall-contract';

type SuperwallExports = {
  DefaultSuperwallOptions: Record<string, unknown>;
  SuperwallExpoModule: unknown;
};

type SuperwallModuleLoader = () => SuperwallExports;

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
