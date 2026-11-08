import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Animated, 
  StyleSheet, 
  Dimensions, 
  Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import LoadingScreen from '@components/Loading/LoadingScreen';
import PinSetup from '@auth/verification/pin/pinSetup';
import useApiClient from '@hooks/apiClient'; 
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';
import { getBiometricPaymentEnabled } from '@auth/verification/pin/utilities/biometricPaymentStorage';
import { useTheme } from '@providers/ThemeProvider';

const api = apiConfig.baseUrl;

const { height, width } = Dimensions.get('window');

// Key dimensions
const keyWidthPercent = 28;
const keyMarginHorizontal = 3; // in pixels
// For zero key: add the pixel margin as a percentage
const zeroKeyWidthPercent = keyWidthPercent * 2 + 1.5;

export default function PinVerify({ visible, onResult, onClose, isPayment = false }) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [animValue] = useState(new Animated.Value(height));
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true); 
  const [attempts, setAttempts] = useState(0);
  const [showBiometricUI, setShowBiometricUI] = useState(false);
  const [isBioEnabledForUser, setIsBioEnabledForUser] = useState(false);
  const [pinStatus, setPinStatus] = useState(null);
  const [isAutoBiometricPending, setIsAutoBiometricPending] = useState(false);
  
  const navigation = useNavigation(); 
  const { user } = useApiClient();
  const { colors, isDark } = useTheme();

  const accentColor = colors.accent;
  // In light mode, `surface` is darker than `background`.
  // To create elevation, the sheet should be lighter. We use `card` for the sheet.
  // The keys should then be a step "down" (darker), so we use `surface`.
  // In dark mode, `card` and `surface` are very similar, and `background` is darkest,
  // so the original logic of sheet=`surface` and keys=`background` works best.
  const sheetBackgroundColor = isDark ? colors.surface : colors.card;
  const keyBackgroundColor = isDark ? colors.background : colors.accentSoft;
  const textPrimaryColor = colors.textPrimary;
  const textSecondaryColor = colors.textSecondary;
  const mutedColor = colors.textDisabled;

  const getBioKey = () => {
    if (!user?.phone_number) return null;
    const cleanPhone = user.phone_number.replace(/\D/g, '');
    return `@biometricPayEnabled_${cleanPhone}`;
  };

  useEffect(() => {
    if (visible) {
      setIsChecking(true);
      setPinStatus(null);
      verifyPinStatus();
    } else {
      Animated.timing(animValue, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setPin(['', '', '', '']);
        setAttempts(0);
        setShowBiometricUI(false);
        setPinStatus(null);
        setIsAutoBiometricPending(false);
        setIsChecking(true);
      });
    }
  }, [visible]);

  const normalizePinStatus = (statusResult) => ({
    success: statusResult?.success,
    status: statusResult?.status,
    message: statusResult?.message,
    hasPin: Boolean(statusResult?.hasPin),
    canSetup: Boolean(statusResult?.canSetup),
    canUpdate: Boolean(statusResult?.canUpdate),
    verify: statusResult?.verify ?? {},
    update: statusResult?.update ?? {},
  });

  const verifyPinStatus = async () => {
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        setPinStatus({ error: 'missing_session' });
        setIsChecking(false);
        return;
      }

      const response = await fetch(`${api}/v1/auth/verification/pin/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', [config.sessionToken]: sessionToken }),
      });

      const statusResult = await response.json();
      console.log('[PinVerify] pin status response', statusResult);
      const normalizedStatus = normalizePinStatus(statusResult);
      setPinStatus(normalizedStatus);

      if (!response.ok || normalizedStatus?.success !== true) {
        setIsChecking(false);
        if (normalizedStatus?.status === 401) {
          Alert.sheet('Authentication Failed', 'Your session is invalid. Please log in again.');
          onResult('failed');
          return;
        }

        if (normalizedStatus?.verify?.isBlocked) {
          Alert.sheet('PIN Blocked', 'Your PIN verification is currently blocked. Please try again later.');
          onResult('failed');
          return;
        }

        if (normalizedStatus?.hasPin === false) {
          Alert.sheet(
            'No PIN Set',
            'You do not have a transaction PIN set up.',
            [
              { text: 'Dismiss', style: 'cancel', onPress: () => onResult && onResult('failed') },
              { text: 'Setup', onPress: () => setShowPinSetup(true) },
            ],
            { cancelable: true }
          );
          return;
        }

        Alert.sheet('Unable to verify PIN status', normalizedStatus?.message || 'Please try again later.');
        onResult('failed');
        return;
      }

      if (!normalizedStatus?.hasPin || normalizedStatus?.verify?.isBlocked) {
        setIsChecking(false);
        if (normalizedStatus.verify?.isBlocked) {
          Alert.sheet('PIN Blocked', 'Your PIN verification is currently blocked. Please try again later.');
        } else {
          Alert.sheet(
            'No PIN Set',
            'You do not have a transaction PIN set up.',
            [
              { text: 'Dismiss', style: 'cancel', onPress: () => onResult && onResult('failed') },
              { text: 'Setup', onPress: () => setShowPinSetup(true) },
            ],
            { cancelable: true }
          );
        }
        return;
      }

      setAttempts(normalizedStatus.verify?.failedAttempts ?? 0);
      const biometricAvailable = await resolveBiometricAvailability();
      setIsBioEnabledForUser(biometricAvailable);
      if (isPayment && biometricAvailable) {
        setIsAutoBiometricPending(true);
        setIsChecking(false);
        return;
      }
      showPinPad();
    } catch (error) {
      console.log('[PinVerify] pin status error', error);
      setIsChecking(false);
      Alert.sheet('Error', 'Unable to fetch PIN status. Please try again later.');
      onResult('failed');
    }
  };

  const resolveBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const enabled = await getBiometricPaymentEnabled(user?.phone_number);
      return Boolean(enabled && hasHardware && isEnrolled);
    } catch (e) {
      console.log('Error checking bio preference', e);
      return false;
    }
  };

  const showPinPad = () => {
    setIsAutoBiometricPending(false);
    setIsChecking(false);
    setShowBiometricUI(false);
    Animated.spring(animValue, {
      toValue: 0,
      tension: 40,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const shouldRenderSheet = () => {
    if (!visible) return false;
    if (isPayment && isAutoBiometricPending) return false;
    if (!pinStatus) return false;
    if (pinStatus?.success !== true) return false;

    const hasPin = pinStatus?.hasPin;
    const isBlocked = pinStatus?.verify?.isBlocked;
    return hasPin && !isBlocked;
  };

  const triggerSuccess = () => {
    setIsAutoBiometricPending(false);
    setIsChecking(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onResult('approved');
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm Identity',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: true,
      });

      if (result.success) {
        triggerSuccess();
      } else {
        setIsAutoBiometricPending(false);
        showPinPad();
      }
    } catch (error) {
      console.log('Biometric error', error);
      setIsAutoBiometricPending(false);
      showPinPad();
    }
  };

  useEffect(() => {
    if (!isAutoBiometricPending || !visible) return;

    handleBiometricAuth();
  }, [isAutoBiometricPending, visible]);

  const handleDigitPress = (digit) => {
    const nextEmptyIndex = pin.findIndex((val) => val === '');
    if (nextEmptyIndex !== -1) {
      const newPin = [...pin];
      newPin[nextEmptyIndex] = digit;
      setPin(newPin);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (nextEmptyIndex === 3) {
        setTimeout(() => verifyPin(newPin.join('')), 300);
      }
    }
  };

  const handleDelete = () => {
    const lastFilledIndex = pin.map(val => val !== '').lastIndexOf(true);
    if (lastFilledIndex !== -1) {
      const newPin = [...pin];
      newPin[lastFilledIndex] = '';
      setPin(newPin);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const verifyPin = async (enteredPin) => {
    try {
      const sessionToken = await getSessionToken();
      setLoading(true);
      const response = await fetch(`${api}/v1/auth/verification/pin/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', [config.sessionToken]: sessionToken, pin: enteredPin }),
      });
      const result = await response.json();
      setLoading(false);
      console.log('[PinVerify] pin verify response', result);

      if (response.ok && result.success === true) {
        triggerSuccess();
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPin(['', '', '', '']);

      const statusCode = result?.status ?? response.status;
      const isBlocked = result?.isBlocked === true;
      const isForbidden = statusCode === 403;
      const isNoPin = statusCode === 404;
      const isUnauthorized = statusCode === 401;
      const isIncorrect = isForbidden && !isBlocked;

      if (isUnauthorized) {
        Alert.sheet('Authentication Failed', 'Your session is invalid. Please log in again.');
        onResult('failed');
        return;
      }

      if (isBlocked) {
        Alert.sheet('PIN Blocked', result?.message || 'Your PIN verification is temporarily blocked.');
        onResult('failed');
        return;
      }

      if (isNoPin) {
        Alert.sheet(
          'No PIN Set',
          'You do not have a transaction PIN set up.',
          [
            { text: 'Dismiss', style: 'cancel', onPress: () => onResult && onResult('failed') },
            { text: 'Setup', onPress: () => { onClose && onClose(); setShowPinSetup(true); } },
          ],
          { cancelable: true }
        );
        return;
      }

      if (!isIncorrect && !isForbidden && statusCode >= 400) {
        Alert.sheet('Unable to verify PIN', result?.message || 'Please try again later.');
        onResult('failed');
        return;
      }

      const remainingAttempts = result?.remainingAttempts ?? pinStatus?.verify?.remainingAttempts ?? 0;
      const attemptsLeft = typeof remainingAttempts === 'number'
        ? remainingAttempts
        : Math.max((pinStatus?.verify?.remainingAttempts ?? 5) - (attempts + 1), 0);

      setAttempts((prev) => prev + 1);

      if (attemptsLeft <= 0) {
        Alert.sheet('Blocked', 'Too many failed attempts.');
        onResult('failed');
      } else {
        Alert.sheet('Incorrect PIN', `${attemptsLeft} attempts remaining.`);
      }
    } catch (error) {
      setLoading(false);
      console.log('[PinVerify] verify pin error', error);
      Alert.sheet('Error', 'Connection failed.');
    }
  };

  if (!shouldRenderSheet()) {
    return (
      <PinSetup
        visible={showPinSetup}
        onClose={() => {
          setShowPinSetup(false);
          onClose?.();
        }}
      />
    );
  }

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'delete'];

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      
      {(loading || (visible && isChecking)) && (
        <LoadingScreen 
          visible={true} 
          message={isChecking ? "Securing Session..." : "Verifying..."} 
          backgroundColor='transparent'
        />
      )}

      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: animValue }], backgroundColor: sheetBackgroundColor }]}> 
        <View style={[styles.dragIndicator, { backgroundColor: mutedColor }]} />
        
        {!isChecking && (
          <View style={styles.contentWidth}>
            {showBiometricUI ? (
              <View style={styles.bioContainer}>
                <Text style={[styles.title, { color: textPrimaryColor }]}>Biometric Check</Text>
                <Text style={[styles.subtitle, { color: textSecondaryColor }]}>Confirm your identity to proceed</Text>
                
                <TouchableOpacity 
                  style={[styles.bioPulse, { backgroundColor: surfaceAltColor }]} 
                  onPress={handleBiometricAuth}
                >
                  <Ionicons 
                    name={Platform.OS === 'ios' ? 'faceid' : 'finger-print'} 
                    size={70} 
                    color={accentColor} 
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.fallbackBtn} onPress={() => setShowBiometricUI(false)}>
                  <Text style={[styles.fallbackText, { color: accentColor }]}>Use Transaction PIN</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={[styles.title, { color: textPrimaryColor }]}>Enter PIN</Text>
                  <Text style={[styles.subtitle, { color: textSecondaryColor }]}>Confirm your 4-digit PIN</Text>
                </View>

                <View style={styles.pinWrapper}>
                  {pin.map((digit, index) => (
                    <View
                      key={index}
                      style={[
                        styles.pinDot,
                        {
                          backgroundColor: digit !== '' ? accentColor : keyBackgroundColor,
                        },
                      ]}
                    />
                  ))}
                </View>

                <TouchableOpacity onPress={() => { onClose(); navigation.navigate('ForgotPinScreen'); }} style={styles.forgotBtn}>
                  <Text style={[styles.forgotText, { color: accentColor }]}>Can't Access PIN?</Text>
                </TouchableOpacity>

                <View style={styles.keypadContainer}>
                  {keypad.map((key, index) => {
                    const isBioDisabled = !isPayment || !isBioEnabledForUser;
                    
                    if (key === 'bio' && isBioDisabled) return null;
                    
                    const isZeroKey = key === '0';
                    const shouldExpandZero = isZeroKey && isBioDisabled;
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.key,
                          styles.keyCard,
                          shouldExpandZero && { width: `${zeroKeyWidthPercent}%` },
                          { backgroundColor: keyBackgroundColor },
                        ]}
                        onPress={() => {
                          if (key === 'delete') handleDelete();
                          else if (key === 'bio') handleBiometricAuth(); 
                          else if (key !== '') handleDigitPress(key);
                        }}
                      >
                        {key === 'delete' ? (
                          <Ionicons name="backspace-outline" size={26} color={textPrimaryColor} />
                        ) : key === 'bio' ? (
                          <Ionicons name={Platform.OS === 'ios' ? 'faceid' : 'finger-print'} size={30} color={accentColor} />
                        ) : (
                          <Text style={[styles.keyText, { color: textPrimaryColor }]}>{key}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}
      </Animated.View>
      <PinSetup
        visible={showPinSetup}
        onClose={() => {
          setShowPinSetup(false);
          onClose?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 5000 },
  sheetContainer: {
    position: 'absolute', 
    bottom: 0, 
    width: '100%', 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25, 
    alignItems: 'center', 
    zIndex: 5001,
  },
  contentWidth: {
    width: '100%',
    alignItems: 'center',
  },
  dragIndicator: { width: 40, height: 5, borderRadius: 3, marginTop: 12, marginBottom: 20, opacity: 0.7 },
  header: { alignItems: 'center', marginBottom: 25 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 5 },
  pinWrapper: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20 },
  pinDot: { width: 16, height: 16, borderRadius: 8 },
  forgotBtn: { marginBottom: 25, padding: 10 },
  forgotText: { fontWeight: '700', fontSize: 12 },
  keypadContainer: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'center' },
  key: { width: '28%', height: 56, justifyContent: 'center', alignItems: 'center', marginHorizontal: 3, marginVertical: 3, borderRadius: 10 },
  keyCard: {},
  keyText: { fontSize: 20, fontWeight: '600' },
  bioContainer: { alignItems: 'center', paddingBottom: 10, width: '100%' },
  bioPulse: {
    width: 110, height: 110, borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center', marginVertical: 30,
  },
  fallbackBtn: { padding: 10 },
  fallbackText: { fontWeight: '700', fontSize: 14 },
  successWrapper: { paddingVertical: 40, alignItems: 'center', width: '100%' }
});
