const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Forces Metro to run Babel transformers over dependency packages that use modern private properties (#)
config.transformer.unstable_transformModulesAtBootTime = [
  'react-native-vision-camera',
];

// This tells Metro to ignore native-only modules when building for Web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (
    moduleName === 'react-native-torch' || 
    moduleName === 'freerasp-react-native'
  )) {
    return {
      type: 'empty',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
