/* eslint-disable @typescript-eslint/no-require-imports, no-undef -- Expo's Metro config API is CommonJS. */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('woff2')) {
  config.resolver.assetExts.push('woff2');
}

module.exports = config;
