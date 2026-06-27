module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Path aliases — resolves @nouri/shared/* and @/*
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
      // Reanimated must be last
      'react-native-reanimated/plugin',
    ],
  };
};
