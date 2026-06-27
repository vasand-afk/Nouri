module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // NativeWind
      'nativewind/babel',
      // Path aliases — resolves @nouri/shared/* and @/*
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@nouri/shared': '../../packages/shared',
            '@': './src',
          },
        },
      ],
      // Reanimated must be last
      'react-native-reanimated/plugin',
    ],
  };
};
