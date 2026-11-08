import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { brandConfig } from '@config/brand';
// Helper to quickly verify session status synchronously or fallback during setup
// In your live app, map this to your core global state or storage engine
let userIsAuthenticated = false; 

export const setAuthStatusReference = (status) => {
  userIsAuthenticated = status;
};

export const linking = { 
  prefixes: [
    'paysmart://',
    'cardglade://',
    'tediwave://',
    'https://paysmart.com.ng',
    'https://*.paysmart.com.ng',
    'https://cardglade.com',
    'https://*.cardglade.com'
  ],

  config: {
    screens: {
      Splash: 'splash',
      JoinIn: 'login',
      Dashboard: '*',
    },
  },

  getStateFromPath(path, linkingConfig) {
    const cleanPath = path.split('?')[0].replace(/^\/+|\/+$/g, '');

    // 1. Identify target intent layout configuration
    let targetRoute = null;

    if (cleanPath === 'send-sms') {
      targetRoute = { name: 'SendSmsPage', params: {} };
    } else if (['splash', 'login', 'welcome'].includes(cleanPath)) {
      const screenMap = { splash: 'Splash', login: 'JoinIn', welcome: 'JoinIn' };
      return { routes: [{ name: screenMap[cleanPath] }] };
    } else {
      let destinationUrl = path;
      if (!path.startsWith('http://') && !path.startsWith('https://')) {
        destinationUrl = `https://paysmart.com.ng/${cleanPath}`;
      }
      targetRoute = {
        name: 'Dashboard',
        params: { browserUrl: destinationUrl, browserTitle: `${brandConfig.brandName}` },
      };
    }

    // 2. Authentication Barrier Logic
    // If user is unauthenticated, hijack the navigation flow and redirect to Login
    if (!userIsAuthenticated) {
      console.log('User is logged out, caching deep link intent for login screen redirection');
      return {
        routes: [
          {
            name: 'Login',
            params: {
              nextScreen: targetRoute.name,
              nextParams: targetRoute.params,
            },
          },
        ],
      };
    }

    // 3. User is logged in, pass through to target screen normally
    return {
      routes: [targetRoute],
    };
  },

  async getInitialURL() {
    const response = await Notifications.getLastNotificationResponseAsync();
    const notificationUrl = response?.notification?.request?.content?.data?.url;
    if (notificationUrl) return notificationUrl;

    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) return initialUrl;

    return null;
  },

  subscribe(listener) {
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response?.notification?.request?.content?.data?.url;
      if (url) listener(url);
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      if (url) listener(url);
    });

    return () => {
      notificationSubscription.remove();
      linkingSubscription.remove();
    };
  },
};