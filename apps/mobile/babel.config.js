module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource: 'nativewind' lets className work on RN components (NativeWind v4).
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      // NativeWind v4 ships its Babel config as a PRESET, not a plugin.
      'nativewind/babel',
    ],
    // No reanimated plugin here: babel-preset-expo (SDK 56) auto-configures the
    // reanimated/worklets Babel plugin when react-native-reanimated is installed.
    // Adding it manually causes a duplicate-plugin error.
  };
};
