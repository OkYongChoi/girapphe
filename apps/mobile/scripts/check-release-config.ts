import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import appConfig from '../app.config';

type AppJson = {
  expo: {
    name?: string;
    slug?: string;
    scheme?: string;
    icon?: string;
    plugins?: Array<string | [string, Record<string, unknown>]>;
    ios?: { bundleIdentifier?: string };
    android?: { package?: string; adaptiveIcon?: { foregroundImage?: string } };
    extra?: { eas?: { projectId?: string } };
    [key: string]: unknown;
  };
};

const projectRoot = process.cwd();
const appJson = JSON.parse(readFileSync(resolve(projectRoot, 'app.json'), 'utf8')) as AppJson;
const easJson = JSON.parse(readFileSync(resolve(projectRoot, 'eas.json'), 'utf8')) as {
  cli?: { appVersionSource?: string; requireCommit?: boolean };
  build?: { production?: { autoIncrement?: boolean; distribution?: string; environment?: string } };
};

function pngSize(relativePath: string) {
  const path = resolve(projectRoot, relativePath);
  assert.ok(existsSync(path), `${relativePath} must exist.`);
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', `${relativePath} must be a PNG.`);
  const colorType = bytes.readUInt8(25);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    hasAlphaChannel: colorType === 4 || colorType === 6,
  };
}

function withProductionEnvironment<T>(operation: () => T): T {
  const values: Record<string, string> = {
    EAS_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_APP_BASE_URL: 'https://www.girapphe.com',
    EXPO_PUBLIC_TERMS_URL: 'https://www.girapphe.com/terms',
    EXPO_PUBLIC_PRIVACY_URL: 'https://www.girapphe.com/privacy',
    EXPO_PUBLIC_SUPPORT_URL: 'https://www.girapphe.com/support',
    EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://www.girapphe.com/account/delete',
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_releasecheck1234567890',
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_releasecheck',
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_releasecheck',
    EXPO_PUBLIC_REVENUECAT_MONTHLY_PACKAGE_ID: '$rc_monthly',
    EXPO_PUBLIC_REVENUECAT_ANNUAL_PACKAGE_ID: '$rc_annual',
    EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-1000000000000000~1000000000',
    EXPO_PUBLIC_ADMOB_ANDROID_APP_ID: 'ca-app-pub-2000000000000000~2000000000',
    EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID: 'ca-app-pub-1000000000000000/3000000000',
    EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID: 'ca-app-pub-2000000000000000/4000000000',
  };
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, process.env[name]);
    process.env[name] = value;
  }
  try {
    return operation();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

assert.equal(appJson.expo.name, 'Girapphe');
assert.equal(appJson.expo.slug, 'girapphe');
assert.equal(appJson.expo.scheme, 'girapphe');
assert.equal(appJson.expo.ios?.bundleIdentifier, 'com.girapphe.app');
assert.equal(appJson.expo.android?.package, 'com.girapphe.app');
assert.deepEqual(
  pngSize(appJson.expo.icon ?? ''),
  { width: 1024, height: 1024, hasAlphaChannel: false },
  'The iOS app icon must be a 1024x1024 PNG without an alpha channel.',
);
assert.deepEqual(
  pngSize(appJson.expo.android?.adaptiveIcon?.foregroundImage ?? ''),
  { width: 1024, height: 1024, hasAlphaChannel: true },
);
const splashPlugin = appJson.expo.plugins?.find(
  (plugin): plugin is [string, Record<string, unknown>] => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
);
const splashSize = pngSize(typeof splashPlugin?.[1].image === 'string' ? splashPlugin[1].image : '');
assert.ok(splashSize.width >= 1242 && splashSize.height >= 2436, 'The splash image must cover modern phone screens.');
assert.equal(easJson.cli?.appVersionSource, 'remote');
assert.equal(easJson.cli?.requireCommit, true);
assert.equal(easJson.build?.production?.autoIncrement, true);
assert.equal(easJson.build?.production?.distribution, 'store');
assert.equal(easJson.build?.production?.environment, 'production');

const productionConfig = withProductionEnvironment(() => appConfig({ config: appJson.expo } as never));
assert.equal(productionConfig.name, 'Girapphe');
assert.equal(productionConfig.ios?.bundleIdentifier, 'com.girapphe.app');
assert.equal(productionConfig.android?.package, 'com.girapphe.app');
assert.ok(productionConfig.ios?.privacyManifests?.NSPrivacyAccessedAPITypes?.length, 'An iOS privacy manifest is required.');

const projectId = (productionConfig.extra?.eas as { projectId?: unknown } | undefined)?.projectId;
if (process.argv.includes('--require-eas-project')) {
  assert.equal(typeof projectId, 'string', 'Run `pnpm eas:init` and commit extra.eas.projectId before a store build.');
  assert.ok(projectId, 'The EAS project id must not be empty.');
} else if (!projectId) {
  console.warn('Source release checks passed. EAS project linkage is still pending; run `pnpm release:check:linked` after `pnpm eas:init`.');
}

console.log('Mobile release source configuration is valid.');
