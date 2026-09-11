import { Platform } from 'react-native';
import {
  type SuperwallPlatformConfiguration,
} from './superwall-contract';
import { createConfiguredSuperwallClient } from './superwall-loader';

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
export const superwallClient = createConfiguredSuperwallClient(Platform.OS, configuration);
