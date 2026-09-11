import { Platform } from 'react-native';
import {
  createConfiguredSuperwallClient,
  getSuperwallPlatformConfiguration,
} from './superwall-loader';

export * from './superwall-contract';
export { getSuperwallPlatformConfiguration } from './superwall-loader';

const configuration = getSuperwallPlatformConfiguration(Platform.OS);
export const superwallClient = createConfiguredSuperwallClient(Platform.OS, configuration);
