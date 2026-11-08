// Copyright (c) 2026 Tediwave, all rights reserved, subject to the proprietary license located in the root directory

import React, { createContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { NavigationContainer } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform, Text, TextInput, AppState, StatusBar, StyleSheet, View, Image } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Application from 'expo-application';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { handleBackgroundUpdateCheck } from '@lib/update';
import * as NavigationBar from 'expo-navigation-bar';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import AppStack from './src/navigation/AppStack';
import { enableScreens, enableFreeze } from 'react-native-screens';
import AlertHost, { Alert } from '@components/common/Alert';
import LoadingScreen from '@components/Loading/LoadingScreen';
import { linking } from './src/navigation/linking';
import { ThemeProvider } from '@providers/ThemeProvider';
import PermissionSheet from '@components/PermissionSheet';
import { refreshAuthState, syncSessionTokenStorage } from '@hooks/useAuth';
import { LanguageProvider } from '@context/LanguageContext';

// Create a global reference interface handle pointer
export const permissionSheetRef = React.createRef();

// Enable native screen optimizations early to improve transition performance
try {
  enableScreens();
  if (typeof enableFreeze === 'function') enableFreeze(true);
} catch (e) {
  console.warn('react-native-screens enable failed', e);
}

// -------------------------
// Native-only startup configuration
// -------------------------
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// -------------------------
// Global Smart Image Manager Logic
// -------------------------
const IMAGE_CACHE_DIR = `${FileSystem.cacheDirectory}smart_images/`;
const MAX_IMAGE_RETRIES = 3;
const IMAGE_TIMEOUT = 5000;
const CONCURRENT_DOWNLOAD_LIMIT = 5;

let activeDownloads = 0;
const downloadQueue = [];
const inflightRequests = new Map();

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
  }
};

const getCacheKey = async (uri) => {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, uri);
  return `${IMAGE_CACHE_DIR}${hash}`;
};

const processQueue = async () => {
  if (activeDownloads >= CONCURRENT_DOWNLOAD_LIMIT || downloadQueue.length === 0) return;
  const nextTask = downloadQueue.shift();
  if (nextTask) await nextTask();
};

const smartDownload = async (uri, cachePath, attempt = 1) => {
  if (inflightRequests.has(uri)) return inflightRequests.get(uri);

  const downloadPromise = (async () => {
    try {
      activeDownloads++;
      const downloadRes = await Promise.race([
        FileSystem.downloadAsync(uri, cachePath),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), IMAGE_TIMEOUT))
      ]);

      if (downloadRes.status !== 200) throw new Error('Failed status');
      
      await AsyncStorage.setItem(`img_meta_${uri}`, new Date().toISOString());
      return cachePath;
    } catch (err) {
      if (attempt < MAX_IMAGE_RETRIES) {
        return smartDownload(uri, cachePath, attempt + 1);
      }
      throw err;
    } finally {
      activeDownloads--;
      inflightRequests.delete(uri);
      processQueue();
    }
  })();

  inflightRequests.set(uri, downloadPromise);
  return downloadPromise;
};

// -------------------------
// Disable font scaling globally & Fix Line Height
// -------------------------
if (Text.defaultProps == null) Text.defaultProps = {};
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
TextInput.defaultProps.allowFontScaling = false;
Text.defaultProps.maxFontSizeMultiplier = 1;
TextInput.defaultProps.maxFontSizeMultiplier = 1;

if (Platform.OS !== 'web' && Text.render) {
  const oldTextRender = Text.render;
  Text.render = function (...args) {
    const origin = oldTextRender.call(this, ...args);
    const originalStyle = StyleSheet.flatten(origin.props.style) || {};
    let newStyle = { ...originalStyle };

  if (!originalStyle.fontSize || originalStyle.fontSize === 14 || originalStyle.fontSize === 16) {
    newStyle.fontSize = 12.5;
  }

  if (newStyle.fontSize && !newStyle.lineHeight) {
    newStyle.lineHeight = Math.ceil(newStyle.fontSize * 1.3);
  }

  if (Platform.OS === 'android') {
    newStyle.paddingVertical = originalStyle.paddingVertical || 1;
  }

    return React.cloneElement(origin, {
      style: newStyle,
      allowFontScaling: false,
      maxFontSizeMultiplier: 1,
      numberOfLines: origin.props.numberOfLines || undefined
    });
  };
}

// -------------------------
// Global Image Override
// -------------------------
const OriginalImage = Image;
const SmartImageWrapper = (props) => {
  const [source, setSource] = useState(props.source);
  const uri = props.source?.uri;

  useEffect(() => {
    if (!uri || typeof uri !== 'string' || uri.startsWith('file://') || uri.startsWith('data:')) {
      setSource(props.source);
      return;
    }

    let isMounted = true;

    const handleImage = async () => {
      await ensureDirExists();
      const cachePath = await getCacheKey(uri);
      const fileInfo = await FileSystem.getInfoAsync(cachePath);
      const netState = await NetInfo.fetch();

      if (fileInfo.exists) {
        if (isMounted) setSource({ uri: cachePath });
        
        if (netState.isConnected) {
          try {
            const task = () => smartDownload(uri, cachePath);
            downloadQueue.push(task);
            processQueue();
          } catch (e) { /* Silent fail */ }
        }
      } else {
        if (netState.isConnected) {
          try {
            const downloadedPath = await smartDownload(uri, cachePath);
            if (isMounted) setSource({ uri: downloadedPath });
          } catch (e) {
            if (isMounted) setSource(props.source);
          }
        } else {
          if (isMounted) setSource(props.source);
        }
      }
    };

    handleImage();
    return () => { isMounted = false; };
  }, [uri, props.source]);

  return <OriginalImage {...props} source={source} onError={() => {
    getCacheKey(uri).then(path => {
      FileSystem.getInfoAsync(path).then(info => {
        if (info.exists) setSource({ uri: path });
      });
    });
  }} />;
};

// Apply the override safely on native platforms only.
if (Platform.OS !== 'web') {
  // @ts-ignore
  Image.render = function(...args) {
    return <SmartImageWrapper {...args[0]} />;
  };
}

// -------------------------
// Fallback UI for ErrorBoundary
// -------------------------
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#121212' }}>
    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#E4E4E4', marginBottom: 10 }}>
      Something went wrong
    </Text>
    <Text style={{ fontSize: 14, color: '#ff6b6b', textAlign: 'center', marginBottom: 20 }}>
      {error?.message || 'Unknown error'}
    </Text>
    <Text
      style={{ color: '#E4E4E4', textDecorationLine: 'underline', fontSize: 16 }}
      onPress={resetErrorBoundary}
    >
      Tap here to try again
    </Text>
  </View>
);

// -------------------------
// Security Context
// -------------------------
export const SecurityContext = createContext({
  checking: false,
  progress: 0,
  securityPassed: false,
  checkSecurity: () => {},
  warnings: [],
  error: null,
});

// -------------------------
// App Component
// -------------------------
const App = () => {
  const appState = useRef(AppState.currentState);

  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [securityPassed, setSecurityPassed] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState(null);

  const [isRestarting, setIsRestarting] = useState(false);

  const intervalRef = useRef(null);

  useEffect(() => {
    const initializeAuthStorage = async () => {
      try {
        await syncSessionTokenStorage();
        await refreshAuthState();
      } catch (error) {
        console.warn('Auth storage sync failed:', error);
      }
    };

    initializeAuthStorage();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const setupNavigationBar = async () => {
        try {
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setButtonStyleAsync('light');
          console.log('Android navigation bar hidden (immersive mode enabled)');
        } catch (err) {
          console.warn('Failed to configure Android navigation bar:', err);
        }
      };

      setupNavigationBar();

      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          setupNavigationBar();
        }
      });

      return () => subscription.remove();
    }
  }, []);

  useEffect(() => {
    handleBackgroundUpdateCheck().catch((error) => {
      console.warn('Error fetching OTA update:', error);
    });
  }, []);

  useEffect(() => {
    const lockOrientationAsync = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (err) {
        console.warn('Orientation lock failed:', err);
      }
    };
    lockOrientationAsync();
  }, []);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const securitySteps = [
    {
      name: 'Network Check',
      fn: async () => {
        const state = await NetInfo.fetch();
        if (!state.isConnected || !state.isInternetReachable) {
          throw { title: 'No Internet', message: 'Please check your network connection' };
        }
      },
    },
    {
      name: 'Emulator Detection',
      fn: async () => {
        if (!Device.isDevice) {
          throw { title: 'Emulator Detected', message: 'This app cannot run on emulators.' };
        }
      },
    },
    {
      name: 'Root/Jailbreak Detection',
      fn: async () => {
        if (Device.isRooted !== undefined && Device.isRooted) {
          throw { title: 'Device Rooted', message: 'Rooted or jailbroken devices are not supported.' };
        }
      },
    },
    {
      name: 'App Installer Source (Android)',
      fn: async () => {
        if (Platform.OS === 'android') {
          try {
            const referrer = await Application.getInstallReferrerAsync();
            if (referrer && !referrer.includes('com.android.vending') && referrer !== 'organic') {
              setWarnings((prev) => [...prev, 'App installed from unknown source']);
            }
          } catch (e) {
            console.warn('Could not retrieve install referrer:', e);
          }
        }
      },
    },
  ];

  const checkSecurity = useCallback(async () => {
    setError(null);
    setWarnings([]);
    setSecurityPassed(false);
    setChecking(true);

    let stepProgress = 0;
    const stepIncrement = Math.floor(100 / securitySteps.length);

    try {
      for (const step of securitySteps) {
        await step.fn();
        stepProgress += stepIncrement;
        setProgress(Math.min(stepProgress, 100));
        await delay(300);
      }
      setSecurityPassed(true);
    } catch (err) {
      setError(err);
      Alert.sheet(
        err?.title || 'Security Check Failed',
        err?.message || 'An unknown security issue was detected.',
        [{ text: 'Try Again', onPress: checkSecurity }]
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkSecurity();

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('User interacted with notification:', response);
    });

    intervalRef.current = setInterval(() => {
      if (AppState.currentState === 'active') {
        checkSecurity();
      }
    }, 10000);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkSecurity();
      }
      appState.current = nextAppState;
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
      notificationListener.remove();
      responseListener.remove();
    };
  }, [checkSecurity]);

  useEffect(() => {
    const originalReject = Promise.reject;
    Promise.reject = function (reason) {
      console.error('[Unhandled Promise Rejection]:', reason);
      return originalReject.call(this, reason);
    };

    return () => {
      Promise.reject = originalReject;
    };
  }, []);

  const securityContextValue = useMemo(() => ({
    checking,
    progress,
    securityPassed,
    checkSecurity,
    warnings,
    error,
  }), [checking, progress, securityPassed, checkSecurity, warnings, error]);

  return (
    <LanguageProvider>
      <ThemeProvider>
        <SafeAreaProvider>
          <SecurityContext.Provider value={securityContextValue}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onReset={checkSecurity}
              onError={(error, info) => {
                console.error('ErrorBoundary caught:', error, info);
              }}
            >
              <NavigationContainer 
                linking={linking}
                onUnhandledAction={(action) => {
                  Alert.sheet(
                    "We’re Building This",
                    "This feature is currently under development and will be available soon",
                    [ { text: "Understood" } ]
                  );
                }}
              >
                <View style={{ flex: 1, backgroundColor: isRestarting ? '#0D1B2A' : 'transparent' }}>
                  <AppStack securityPassed={securityPassed} />
                  <AlertHost />
                  {isRestarting && <LoadingScreen visible={true} message="Restarting app" />}
                  
                  <PermissionSheet 
                    ref={permissionSheetRef} 
                    onComplete={(states) => {
                      console.log("Required permissions parameters validated successfully:", states);
                    }} 
                  />
                </View>
              </NavigationContainer>
            </ErrorBoundary>
          </SecurityContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
};

export default App;