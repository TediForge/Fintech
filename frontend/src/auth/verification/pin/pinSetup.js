import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Vibration, Image,
  Dimensions, 
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';
import LoadingScreen from '@components/Loading/LoadingScreen';

const { height: screenHeight } = Dimensions.get('window');
const BRAND_COLOR = '#0E3C2E';

const PinSetup = ({ visible, onClose }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Securing Account');
  const [isSuccess, setIsSuccess] = useState(false);
  
  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    const startAnimation = () => {
      Animated.parallel([
        Animated.spring(animValue, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    };

    const closeAnimation = () => {
      Animated.parallel([
        Animated.timing(animValue, { toValue: screenHeight, duration: 250, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    };

    if (visible) {
      // First, check whether the user already has a PIN. Only show sheet if they don't.
      setLoadingMessage('Checking PIN status');
      setLoading(true);
      (async () => {
        try {
          const token = await getSessionToken();
          if (!token) {
            Alert.sheet('Authentication Error', 'Missing session. Please login again.');
            onClose?.();
            return;
          }

          const resp = await fetch(`${apiConfig.baseUrl}/v1/auth/verification/pin/index.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', [config.sessionToken]: token }),
          });

          let statusResult;
          try {
            statusResult = await resp.json();
          } catch (e) {
            statusResult = null;
          }
          console.log('[PinSetup] status response', { status: resp.status, statusResult });

          const hasPin = Boolean(statusResult?.hasPin);

          if (resp.ok && statusResult?.success === true) {
            if (hasPin) {
              Alert.sheet('PIN Exists', 'You already have a transaction PIN set up.');
              onClose?.();
            } else {
              startAnimation();
            }
          } else {
            Alert.sheet('Unable to check PIN status', statusResult?.message || 'Please try again later.');
            onClose?.();
          }
        } catch (error) {
          console.log('[PinSetup] check status error', error);
          Alert.sheet('Error', 'Unable to verify PIN status. Please try again later.');
          onClose?.();
        } finally {
          if (mounted) setLoading(false);
        }
      })();
    } else {
      closeAnimation();
      // Reset state on close
      setPin('');
      setConfirmPin('');
      setIsConfirming(false);
      setIsSuccess(false);
      setLoading(false);
      setLoadingMessage('Securing Account');
    }

    return () => {
      mounted = false;
    };
  }, [visible]);

  const handlePress = (num) => {
    if (isSuccess || loading) return;
    const currentPin = isConfirming ? confirmPin : pin;
    if (currentPin.length < 4) {
      isConfirming ? setConfirmPin(currentPin + num) : setPin(currentPin + num);
    }
  };

  const handleBackspace = () => {
    if (isSuccess || loading) return;
    const currentPin = isConfirming ? confirmPin : pin;
    isConfirming ? setConfirmPin(currentPin.slice(0, -1)) : setPin(currentPin.slice(0, -1));
  };

  const triggerShake = () => {
    Vibration.vibrate(400);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (pin.length === 4 && !isConfirming) {
      const isRepeat = /^(\d)\1{3}$/.test(pin);
      const isSequence = pin === "1234" || pin === "4321" || pin === "2345" || pin === "6789";
      
      if (isRepeat || isSequence) {
        triggerShake();
        Alert.sheet("Weak PIN Error", "This PIN is too simple to use.");
        setPin('');
      } else {
        setTimeout(() => setIsConfirming(true), 300);
      }
    } else if (confirmPin.length === 4 && isConfirming) {
      validateAndSubmit();
    }
  }, [pin, confirmPin]);

  const validateAndSubmit = async () => {
    if (pin !== confirmPin) {
      triggerShake();
      Alert.sheet("PIN Matching Error", "Confirmation PIN does not match.");
      setConfirmPin('');
      return;
    }

    setLoadingMessage('Setting up your PIN');
    setLoading(true);
    try {
      const token = await getSessionToken();
      const response = await fetch(`${apiConfig.baseUrl}/v1/auth/verification/pin/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', [config.sessionToken]: token, pin: confirmPin, confirmPin })
      });

      const rawText = await response.text();
      let result = {};

      try {
        result = rawText ? JSON.parse(rawText) : {};
      } catch (parseError) {
        result = { success: false, status: response.status, message: 'Invalid response from server.' };
      }

      console.log('[PIN setup response]', { status: response.status, result });

      if (response.ok && result?.success === true) {
        setIsSuccess(true);
        setLoading(false);
        setTimeout(() => {
          onClose();
        }, 5000);
      } else {
        setLoading(false);
        const errorMessage = result?.message || result?.error || 'We could not complete your request.';
        Alert.sheet('Setup Error', errorMessage);
        setPin('');
        setConfirmPin('');
        setIsConfirming(false);
      }
    } catch (error) {
      setLoading(false);
      Alert.sheet("Connection Error", "Check your connection and retry.");
    }
  };

  if (!visible && animValue._value === screenHeight) return null;

  return (
    <View style={styles.container} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: animValue }] }]}>
        <View style={styles.dragIndicator} />
        
        <View style={styles.content}>
          {isSuccess ? (
            <View style={styles.successContent}>
              <Ionicons name="checkmark-circle" size={70} color="#10b981" />
              <Text style={styles.successTitle}>PIN Set</Text>
              <Text style={styles.successMessage}>Your transaction PIN has been secured</Text>
            </View>
          ) : (
            <>
              <View style={styles.topSection}>
                <View style={styles.iconContainer}>
                                                <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/18145/18145162.png' }} style={styles.nimcLogo} />
                                              </View>
                <Text style={styles.title}>{isConfirming ? "Repeat your PIN" : "Set 4-digit PIN"}</Text>
                <Text style={styles.message}>
                  {isConfirming
                    ? "Re-enter your 4-digit PIN to confirm now"
                    : "Create a 4-digit PIN for wallet security"}
                </Text>
              </View>

              <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
                {[...Array(4)].map((_, i) => {
                  const code = isConfirming ? confirmPin : pin;
                  return <View key={i} style={[styles.dot, code.length > i && styles.activeDot]} />;
                })}
              </Animated.View>

              <View style={styles.numpad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "empty", 0, "back"].map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.key} 
                    disabled={item === "empty" || loading}
                    onPress={() => {
                      if (item === "back") handleBackspace();
                      else if (item !== "empty") handlePress(item);
                    }}
                  >
                    {item === "back" ? (
                      <Ionicons name="backspace-outline" size={24} color="#333" />
                    ) : item === "empty" ? (
                      null
                    ) : (
                      <Text style={styles.keyText}>{item}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </Animated.View>
      <LoadingScreen visible={loading} message={loadingMessage} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    ...StyleSheet.absoluteFillObject, 
    zIndex: 9998, 
    justifyContent: 'flex-end' 
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    width: '100%',
  },
  dragIndicator: { width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3, alignSelf: 'center', marginTop: 12 },
  content: { paddingHorizontal: 24, paddingTop: 10, alignItems: 'center' },
  topSection: { alignItems: 'center', marginBottom: 5, marginTop: 15, },
  iconContainer: { backgroundColor: '#fff', borderRadius: 30, height: 60, width: 60, marginBottom: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', },
  nimcLogo: { width: 35, height: 35, resizeMode: 'contain' },
  title: { fontSize: 16, fontWeight: '700', color: BRAND_COLOR, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  // DOTS
  dotsRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#E2E8F0' },
  activeDot: { backgroundColor: BRAND_COLOR, borderColor: BRAND_COLOR },

  // NUMPAD
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginTop: 5 },
  key: { width: '33.33%', height: 60, justifyContent: 'center', alignItems: 'center' },
  keyText: { color: '#333', fontSize: 22, fontWeight: '600' },

  // SUCCESS STATE
  successContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    width: '100%'
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginTop: 10,
    marginBottom: 8
  },
  successMessage: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 30
  }
});

export default PinSetup;