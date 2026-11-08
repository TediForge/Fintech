// Copyright (c) 2026 Tediwave, all rights reserved, subject to the proprietary license located in the root directory
import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import { useFonts, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  Animated,
  Image,
  Easing,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import { SecurityContext } from '@app';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';

const SplashScreen = () => {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { progress: appProgress, checking: contextChecking } = useContext(SecurityContext);

  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);
  const mounted = useRef(false);

  const logoUrl = 'https://paysmart.com.ng/assets/splash-logo/splash-logo-001.png';

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    Image.prefetch(logoUrl);
  }, []);

  useEffect(() => {
    if (appProgress != null) setProgress(appProgress);
    setChecking(contextChecking);
  }, [appProgress, contextChecking]);

  const handleNavigation = useCallback(async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 7000));

      const now = new Date().getTime();

      const joinInDataRaw = await AsyncStorage.getItem('JoinInNavigated');
      let joinInRecent = false;
      
      if (joinInDataRaw) {
        const { navigated, timestamp } = JSON.parse(joinInDataRaw);
        const ONE_HOUR = 60 * 60 * 1000;
        
        if (navigated && now - timestamp < ONE_HOUR) {
          joinInRecent = true;
        }
      }

      if (joinInRecent) {
        navigation.replace('Dashboard'); 
      } else {
        navigation.replace('Dashboard');
      }
    } catch (error) {
      console.log('Navigation execution failed caught routing stack error:', error);
      navigation.replace('Dashboard'); 
    }
  }, [navigation]);

  useEffect(() => {
    if (progress === 100 && !checking && !mounted.current) {
      mounted.current = true;
      handleNavigation();
    }
  }, [progress, checking, handleNavigation]);

  const [fontsLoaded] = useFonts({ Inter_700Bold });

  useEffect(() => {
    if (Platform.OS === 'android') {
      const configureNavigationBar = async () => {
        try {
          await NavigationBar.setButtonStyleAsync('light');
          await NavigationBar.setBackgroundColorAsync('#122C25');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
          await NavigationBar.setBorderColorAsync('#122C25');
          await NavigationBar.setPositionAsync('relative');
        } catch (err) {
          console.warn('NavigationBar config failed:', err);
        }
      };

      configureNavigationBar();
    }
  }, []);

  return (
    <>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.container}>
          <Animated.View
            style={{
              opacity: fadeAnim,
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/cardglade-logo-horizontal-white.png')} style={styles.logo} resizeMode="contain" />
            </View>
          </Animated.View>
        </View>

        <View style={styles.bottomContainer}>
            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={styles.iconsRow}>
                <Image
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/128/3914/3914222.png' }}
                  style={styles.smallIcon}
                />
                <Image
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/128/14897/14897409.png' }}
                  style={styles.smallIcon}
                />
                <Image
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/128/10506/10506960.png' }}
                  style={styles.smallIcon}
                />
              </View>
              <Text style={styles.tagline} allowFontScaling={false}>
                v{Constants.expoConfig.version} Standard Edition
              </Text>
            </Animated.View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#122C25',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    height: '100%',
    width: 250,
    aspectRatio: 3.5,
    marginLeft: 0,
  },
  bottomContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 5,
  },
  smallIcon: {
    width: 12,
    height: 12,
    tintColor: '#688276',
    opacity: 0.7,
  },
  tagline: {
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#688276',
    textAlign: 'center',
  },
});

export default SplashScreen;