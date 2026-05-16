module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin MUST be the last plugin.
    plugins: ['react-native-worklets/plugin'],
  };
};
