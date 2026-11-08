module.exports = ({ config }) => {
  return {
    ...config,
    name: "Tediwave",
    slug: "tediwave",
    owner: "tediwave",
    scheme: "tediwave",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash-icon-dark.png",
      resizeMode: "contain",
      backgroundColor: "#122C25",
    },
    updates: {
      url: "https://u.expo.dev/914f0093-611e-4ff7-99c0-911dc8318152",
      fallbackToCacheTimeout: 0,
      checkAutomatically: "ON_LOAD",
    },
    runtimeVersion: { policy: "appVersion" },
    assetBundlePatterns: ["**/*"],
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/favicon.png",
      splash: {
        image: "./assets/splash-icon-dark.png",
        resizeMode: "contain",
        backgroundColor: "#122C25",
      }
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tediwave.app",
      buildNumber: "1.0.0",
      associatedDomains: [
        "applinks:paysmart.com.ng",
        "applinks:*.paysmart.com.ng",
        "applinks:tediwave.com",
        "applinks:*.tediwave.com"
      ],
      icon: {
        dark: "./assets/ios-dark.png",
        light: "./assets/ios-light.png",
        tinted: "./assets/ios-tinted.png",
      },
      splash: {
        image: "./assets/splash-icon-dark.png",
        tabletImage: "./assets/splash-icon-dark.png",
        backgroundColor: "#122C25",
      },
      infoPlist: {
        NSCameraUsageDescription: "Tediwave needs camera access to scan QR codes, ID cards, take profile photos, and perform liveness verification.",
        NSPhotoLibraryUsageDescription: "Tediwave needs photo library access to select profile pictures and save scanned documents.",
        NSPhotoLibraryAddUsageDescription: "Tediwave needs permission to save scanned ID cards to your photo library.",
        NSLocationWhenInUseUsageDescription: "Tediwave uses location for security and fraud detection.",
        NSLocationAlwaysUsageDescription: "Tediwave uses background location for enhanced fraud prevention.",
        NSMicrophoneUsageDescription: "Tediwave may use microphone for future voice features.",
        UIBackgroundModes: ["location", "fetch", "remote-notification"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundImage: "./assets/adaptive-background.png",
      },
      splash: {
        image: "./assets/splash-icon-dark.png",
        resizeMode: "contain",
        backgroundColor: "#122C25",
      },
      package: "com.tediwave.app",
      usesCleartextTraffic: false, 
      allowBackup: false,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.VIBRATE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.DETECT_SCREEN_CAPTURE",
        "android.permission.DETECT_SCREEN_RECORDING"
      ],
      googleServicesFile: "./google-services.json",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            { scheme: "https", host: "paysmart.com.ng", pathPrefix: "/" },
            { scheme: "https", host: "*.paysmart.com.ng", pathPrefix: "/" },
            { scheme: "https", host: "tediwave.com", pathPrefix: "/" },
            { scheme: "https", host: "*.tediwave.com", pathPrefix: "/" }
          ],
          category: ["BROWSABLE", "DEFAULT"],
        }
      ],
    },
    plugins: [
      "expo-font", 
      "expo-system-ui", 
      "expo-asset", 
      "expo-localization",
      "expo-tracking-transparency", 
      "expo-location", 
      "expo-media-library", 
      "expo-camera",
      ["react-native-vision-camera", {
        cameraPermissionText: "Tediwave needs camera access for face verification.",
        enableMicrophonePermission: false,
      }],
      "./plugins/withAndroidXCoreVersion",
      "expo-updates",
      ["freerasp-react-native", {}],
      ["expo-splash-screen", { backgroundColor: "#122C25", image: "./assets/splash-icon-dark.png" }],
      ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#122C25" }],
      ["expo-build-properties", {
        ios: { useFrameworks: "static" },
        android: {
          kotlinVersion: "2.1.21",
          minSdkVersion: 26,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          enableProguardInReleaseBuilds: true,
          shrinkResourcesInReleaseBuilds: true,
          packagingOptions: { pickFirst: ["**/libcrypto.so", "**/libssl.so", "**/libc++_shared.so"] },
          extraMavenRepos: ["https://europe-west3-maven.pkg.dev/talsec-artifact-repository/freerasp"]
        }
      }]
    ],
    extra: { eas: { projectId: "914f0093-611e-4ff7-99c0-911dc8318152" } },
  };
};