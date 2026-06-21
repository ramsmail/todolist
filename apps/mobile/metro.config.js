const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow monorepo packages to be resolved
config.watchFolders = [
  path.resolve(__dirname, '../../packages'),
];

module.exports = withNativewind(config, { input: './src/global.css' });
