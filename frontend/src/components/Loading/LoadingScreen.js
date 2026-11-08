import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StatusBar,
  InteractionManager,
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useTheme } from '@providers/ThemeProvider';

const { width, height } = Dimensions.get('screen');

const LoadingScreen = ({ visible, message }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { colors } = useTheme();
  
  // Local state synchronization layer to delay visual mount until transitions finish
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let rotateAnimation;
    let breathAnimation;
    let interactionHandle = null;

    const toggleSystemUI = async (shouldHide) => {
      if (Platform.OS === 'android') {
        try {
          if (shouldHide) {
            await NavigationBar.setVisibilityAsync('hidden');
            await NavigationBar.setBackgroundColorAsync('transparent');
            await NavigationBar.setButtonStyleAsync('light');
          } else {
            await NavigationBar.setVisibilityAsync('hidden');
            await NavigationBar.setBackgroundColorAsync('transparent');
            await NavigationBar.setButtonStyleAsync('light');
          }
        } catch (e) {
          console.log("Nav Bar Control Error:", e);
        }
      }
    };

    if (visible) {
      // PERFORMANCE OPTIMIZATION: Wait for navigation animation frames to fully settle (maintain 60FPS)
      interactionHandle = InteractionManager.runAfterInteractions(() => {
        setShouldRender(true);
        toggleSystemUI(true);

        // 1. Rotation Animation (The Ring)
        rotateAnim.setValue(0);
        rotateAnimation = Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 400, // Increased speed from 1200 to 400
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );

        // 2. Breath Animation (The Logo Scale)
        scaleAnim.setValue(1);
        breathAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.15,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );

        rotateAnimation.start();
        breathAnimation.start();
      });
    } else {
      // Terminate rendering cleanly and restore global system UI layouts safely
      setShouldRender(false);
      toggleSystemUI(false);
    }

    return () => {
      if (interactionHandle) interactionHandle.cancel();
      if (rotateAnimation) rotateAnimation.stop();
      if (breathAnimation) breathAnimation.stop();
    };
  }, [visible]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      transparent={true}
      visible={visible && shouldRender}
      animationType="none"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay}>
        <StatusBar hidden={visible && shouldRender} translucent backgroundColor="transparent" />
        <View style={styles.loaderWrapper}>
          {/* Spinning Ring */}
          <Animated.View style={[styles.ring, { transform: [{ rotate }], borderTopColor: colors.textPrimary }]} />

          {/* Animated Breathing Logo */}
          <Animated.View style={[styles.logoWrapper, { transform: [{ scale: scaleAnim }] }]}> 
            <Image
              source={{ uri: 'https://paysmart.com.ng/assets/brand-logos/bitmap.png' }}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Removed periods from message via regex and logic */}
        {message ? (
          <Text style={[styles.message, { color: colors.textPrimary }]}>{message.trim().replace(/\.+$/, '')}</Text>
        ) : null}
      </View>
    </Modal>
  );
};

export default LoadingScreen;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loaderWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    width: 57, 
    height: 57,
    borderRadius: 30,
    borderWidth: 3,
    borderTopColor: '#fff',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    position: 'absolute',
  },
  logoWrapper: {
    width: 41,
    height: 41,
    borderRadius: 41,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    overflow: "hidden",
  },
  logo: {
    width: 41,
    height: 41,
  },
  message: {
    marginTop: 20,
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
    lineHeight: 14,
    letterSpacing: 0.5,
  },
});

/*
=============================================================================
                          USAGE DOCUMENTATION EXAMPLES
=============================================================================

1. Standard Declarative Usage inside Functional Component State Layouts:
-----------------------------------------------------------------------------
const MyScreenComponent = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchData = async () => {
    setIsLoading(true);
    try {
      await api.fetchAccountDetails();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LoadingScreen visible={isLoading} message="Synchronizing securely..." />
      <Button title="Sync Profile" onPress={handleFetchData} />
    </View>
  );
};


2. Screen-to-Screen Sequential Transition Integration (React Navigation):
-----------------------------------------------------------------------------
const TransferFundsButton = ({ navigation }) => {
  const [processing, setProcessing] = useState(false);

  const handleTransactionExecution = () => {
    setProcessing(true);
    
    // Simulate back-end process handling
    setTimeout(() => {
      setProcessing(false);
      
      // Navigation happens cleanly. InteractionManager in LoadingScreen guarantees 
      // that native window overlays dismantle elegantly without clipping active route transitions.
      navigation.navigate('SuccessReceiptScreen');
    }, 2000);
  };

  return (
    <View>
      <LoadingScreen visible={processing} message="Processing Transaction..." />
      <TouchableOpacity onPress={handleTransactionExecution}>
        <Text>Confirm Payment</Text>
      </TouchableOpacity>
    </View>
  );
};


3. Global Root Context State Provider Wiring Variant:
-----------------------------------------------------------------------------
// Within your App.tsx root tree component architecture setup
export const GlobalLoadingContext = React.createContext({ show: (msg) => {}, hide: () => {} });

export const AppRootNavigator = () => {
  const [globalLoading, setGlobalLoading] = useState({ visible: false, message: '' });

  const loaderContextValue = React.useMemo(() => ({
    show: (msg) => setGlobalLoading({ visible: true, message: msg }),
    hide: () => setGlobalLoading({ visible: false, message: '' })
  }), []);

  return (
    <GlobalLoadingContext.Provider value={loaderContextValue}>
      <NavigationContainer>
        <RootStack />
      </NavigationContainer>
      <LoadingScreen visible={globalLoading.visible} message={globalLoading.message} />
    </GlobalLoadingContext.Provider>
  );
};
*/