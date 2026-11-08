const { withProjectBuildGradle } = require('@expo/config-plugins');

const ANDROIDX_CORE_VERSION = '1.13.1';
const MARKER = '// CardGlade AndroidX Core compatibility constraint';

const withAndroidXCoreVersion = (config) => withProjectBuildGradle(config, (projectConfig) => {
  if (projectConfig.modResults.language !== 'groovy' || projectConfig.modResults.contents.includes(MARKER)) {
    return projectConfig;
  }

  projectConfig.modResults.contents += `\n${MARKER}\nallprojects {\n  configurations.all {\n    resolutionStrategy.eachDependency { dependency ->\n      if (dependency.requested.group == 'androidx.core' && ['core', 'core-ktx'].contains(dependency.requested.name)) {\n        dependency.useVersion '${ANDROIDX_CORE_VERSION}'\n      }\n    }\n  }\n}\n`;

  return projectConfig;
});

module.exports = withAndroidXCoreVersion;
