module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-transform-flow-strip-types',
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      '@babel/plugin-proposal-export-namespace-from',
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@auth': './src/auth',
            '@config': './src/config',
            '@hooks': './src/hooks',
            '@lib': './src/lib',
            '@components': './src/components',
            '@providers': './src/providers',
            '@context': './src/context',
            '@dashboard': './src/screens/dashboard',
            '@app': './App',
          },
        },
      ],
      'react-native-worklets-core/plugin',
      'react-native-reanimated/plugin',
    ],
  };
};