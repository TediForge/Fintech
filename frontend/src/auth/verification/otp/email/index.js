import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import LoadingScreen from '@components/Loading/LoadingScreen';
import config from '@config/app';
import { apiConfig } from '@config/api';

const { height: screenHeight } = Dimensions.get('window');
const BRAND_COLOR = '#0E3C2E';

const EmailOtp = ({
  visible,
  onClose,
  purpose,
  requestId: initialRequestId = null,
  onVerified,
  onRequestIdChange,
}) => {
  const [otp, setOtp] = useState([]);
  const [otpLength, setOtpLength] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [timer, setTimer] = useState(60);
  const [userEmail, setUserEmail] = useState('');
  const [requestId, setRequestId] = useState(initialRequestId || '');
  const [currentPurpose, setCurrentPurpose] = useState(purpose || '');

  const syncRequestId = (nextRequestId) => {
    const normalized = nextRequestId || '';
    setRequestId(normalized);
    onRequestIdChange?.(normalized || null);
  };

  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const maskEmail = (email) => {
    if (!email) return 'your email address';
    const [name, domain] = email.split('@');
    const maskedName = name.length > 3 ? name.substring(0, 3) + '***' : name + '***';
    return `${maskedName}@${domain}`;
  };

  const resetFlow = () => {
    setOtp([]);
    setOtpLength(null);
    setIsSuccess(false);
    setLoading(false);
    setTimer(60);
    setRequestId(initialRequestId || '');
    setCurrentPurpose(purpose || '');
  };

  const parseResponse = async (response) => {
    const rawText = await response.text();
    if (!rawText) {
      return {};
    }

    try {
      return JSON.parse(rawText);
    } catch (error) {
      return { parseError: error.message, rawText };
    }
  };

  const openSheet = () => {
    Animated.parallel([
      Animated.spring(animValue, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(animValue, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
    resetFlow();
  };

  useEffect(() => {
    let interval;
    if (visible) {
      resetFlow();
      setLoading(true);

      interval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      const activeRequestId = initialRequestId || requestId;
      if (activeRequestId) {
        checkOtpStatus(activeRequestId);
      } else {
        requestOtp();
      }
    } else {
      closeSheet();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible]);

  const requestOtp = async () => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const response = await fetch(`${apiConfig.baseUrl}/v1/auth/verification/otp/email/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', [config.sessionToken]: token, purpose: currentPurpose }),
      });
      const result = await parseResponse(response);
      const payload = result?.data || result;
      const success = result?.success === true || Boolean(payload?.requestId && payload?.channel === 'email');
      console.log('[EmailVerify] requestOtp response:', success ? payload : { success: false, message: result?.message || payload?.message || 'Email OTP request failed' });

      if (success) {
        const nextRequestId = payload?.requestId || payload?.id || null;
        if (nextRequestId) {
          syncRequestId(nextRequestId);
        }

        const destination = payload?.destination || payload?.email || null;
        if (destination) {
          setUserEmail(destination);
          await AsyncStorage.setItem('last_email_otp_address', destination);
        }

        const length = Number(payload?.otp?.length || payload?.otpLength || payload?.length || 6);
        setOtpLength(length);

        await AsyncStorage.setItem('last_email_otp_send_time', Date.now().toString());
        setTimer(60);
        if (nextRequestId && length > 0) {
          openSheet();
        }
      } else {
        console.log('[EmailVerify] requestOtp backend failure:', result?.message || payload?.message || 'Failed to send email OTP');
        Alert.sheet('Request Error', result?.message || payload?.message || 'The email OTP service is currently unavailable. Please try again later.');
      }
    } catch (error) {
      console.log('[EmailVerify] requestOtp client error:', error);
      Alert.sheet('Connection issue', 'We could not reach the email verification service. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const checkOtpStatus = async (activeRequestId) => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const response = await fetch(`${apiConfig.baseUrl}/v1/auth/verification/otp/status.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: activeRequestId, [config.sessionToken]: token }),
      });
      const result = await parseResponse(response);
      const payload = result?.data || result;
      const success = result?.success === true || Boolean(payload?.requestId && payload?.status);
      console.log('[EmailVerify] checkOtpStatus response:', success ? payload : { success: false, message: result?.message || payload?.message || 'Email OTP status check failed' });

      setRequestId(activeRequestId);

      const incomingOtpLength = Number(payload?.otp?.length || payload?.otpLength || payload?.length || otpLength || 6);
      if (incomingOtpLength > 0) {
        setOtpLength(incomingOtpLength);
      }

      if (success && payload?.status === 'verified') {
        setOtp([]);
        setIsSuccess(true);
        onVerified?.({ requestId: activeRequestId, purpose: currentPurpose });
        syncRequestId(null);
        setTimeout(() => onClose?.(), 900);
        return;
      }

      if (success && payload?.status === 'pending') {
        const destination = payload?.destination || null;
        if (destination) {
          setUserEmail(destination);
          await AsyncStorage.setItem('last_email_otp_address', destination);
        }

        setOtp([]);
        setTimer(60);
        if (activeRequestId && incomingOtpLength > 0) {
          openSheet();
        }
        return;
      }

      if (success && payload?.status === 'expired') {
        syncRequestId(null);
        setOtp([]);
        setTimer(60);
        requestOtp();
        return;
      }

      if (!success) {
        setOtp([]);
        return;
      }
    } catch (error) {
      Alert.sheet('Status Error', 'Unable to check verification status.');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!requestId) {
      requestOtp();
      return;
    }

    try {
      setLoading(true);
      const token = await getSessionToken();
      const response = await fetch(`${apiConfig.baseUrl}/v1/auth/verification/otp/email/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend', requestId, [config.sessionToken]: token }),
      });
      const result = await parseResponse(response);
      const payload = result?.data || result;
      console.log('[EmailVerify] resendOtp response:', result?.success === true ? payload : { success: false, message: result?.message || 'Email OTP resend failed' });

      if (result?.success === true) {
        const nextRequestId = payload?.requestId || requestId;
        syncRequestId(nextRequestId);
        const length = Number(payload?.otp?.length || payload?.otpLength || payload?.length || otpLength || 6);
        setOtpLength(length);
        setOtp([]);
        setTimer(60);
      } else {
        Alert.sheet('Notice', result?.message || 'Unable to resend the code.');
      }
    } catch (error) {
      Alert.sheet('Error', 'Unable to resend the code.');
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (num) => {
    const targetLength = otpLength || 6;
    if (otp.length < targetLength && !isSuccess && !loading) {
      const newOtp = [...otp, num];
      setOtp(newOtp);
      if (newOtp.length === targetLength) verifyCode(newOtp.join(''));
    }
  };

  const handleBackspace = () => {
    if (!isSuccess && !loading) setOtp(otp.slice(0, -1));
  };

  const verifyCode = async (code) => {
    if (!requestId) {
      Alert.sheet('Notice', 'No email verification request is available yet.');
      return;
    }

    setLoading(true);
    try {
      const token = await getSessionToken();
      const response = await fetch(`${apiConfig.baseUrl}/v1/auth/verification/otp/email/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', requestId, otp: code, [config.sessionToken]: token }),
      });
      const result = await parseResponse(response);
      const payload = result?.data || result;
      console.log('[EmailVerify] verifyCode response:', result?.success === true ? payload : { success: false, message: result?.message || 'Email OTP verification failed' });

      if (result?.success === true) {
        setIsSuccess(true);
        onVerified?.({ requestId, purpose: currentPurpose });
        syncRequestId(null);
        setTimeout(() => onClose?.(), 900);
      } else {
        Alert.sheet('Error', result?.message || 'Unable to verify the code.');
        setOtp([]);
      }
    } catch (error) {
      Alert.sheet('Error', 'Server error.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible && animValue._value === screenHeight) return null;

  return (
    <View style={styles.container} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: animValue }] }]}>
        <View style={styles.dragIndicator} />

        <View style={styles.content}>
          {isSuccess ? (
            <View style={styles.successContent}>
              <Ionicons name="checkmark-circle" size={70} color="#10b981" />
              <Text style={styles.successTitle}>Verified</Text>
              <Text style={styles.successMessage}>Your email has been verified</Text>
            </View>
          ) : (
            <>
              <View style={styles.topSection}>
                <View style={styles.iconContainer}>
                  <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/726/726623.png' }} style={styles.nimcLogo} />
                </View>
                <Text style={styles.title}>Email Verification</Text>
                <Text style={styles.message}>Enter the code sent to {maskEmail(userEmail || 'your email address')}</Text>
              </View>

              {otpLength && requestId && (
                <>
                  <View style={styles.dotsRow}>
                    {[...Array(otpLength)].map((_, index) => (
                      <View key={index} style={[styles.dot, otp.length > index && styles.activeDot]} />
                    ))}
                  </View>

                  <View style={styles.resendArea}>
                    {timer > 0 ? (
                      <Text style={styles.timerText}>Resend code in {timer} seconds</Text>
                    ) : (
                      <TouchableOpacity onPress={resendOtp}>
                        <Text style={styles.resendLink}>Click to resend</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.numpad}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'empty', 0, 'back'].map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.key}
                        disabled={item === 'empty' || loading}
                        onPress={() => {
                          if (item === 'back') handleBackspace();
                          else if (item !== 'empty') handlePress(item);
                        }}
                      >
                        {item === 'back' ? (
                          <Ionicons name="backspace-outline" size={24} color="#333" />
                        ) : item === 'empty' ? (
                          null
                        ) : (
                          <Text style={styles.keyText}>{item}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </Animated.View>
      <LoadingScreen visible={loading} message="Verifying" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetContainer: {
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    width: '100%',
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: 'center',
  },
  topSection: { alignItems: 'center', marginBottom: 5, marginTop: 15 },
  iconContainer: { backgroundColor: '#fff', borderRadius: 30, height: 60, width: 60, marginBottom: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  nimcLogo: { width: 30, height: 30, resizeMode: 'contain' },
  title: { fontSize: 16, fontWeight: '700', color: BRAND_COLOR, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  dotsRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#E2E8F0' },
  activeDot: { backgroundColor: BRAND_COLOR, borderColor: BRAND_COLOR },
  resendArea: { marginBottom: 10 },
  resendLink: { color: '#10b981', fontWeight: '700', fontSize: 13 },
  timerText: { color: '#94A3B8', fontSize: 12 },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginTop: 5 },
  key: { width: '33.33%', height: 60, justifyContent: 'center', alignItems: 'center' },
  keyText: { color: '#333', fontSize: 22, fontWeight: '600' },
  successContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    width: '100%',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginTop: 10,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 30,
  },
});

export default EmailOtp;