import { Alert } from '@components/common/Alert';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  getBiometricLoginData,
  getBiometricLoginEnabled,
  saveBiometricLoginData,
  setBiometricLoginEnabled,
  removeBiometricLoginData,
} from './biometricLoginStorage';

const getProfileIdentity = (userData = {}) => {
  const phone = userData?.phone_number || userData?.phone || userData?.phoneNumber || userData?.userPhone || null;
  return {
    phone,
    hasRequiredProfile: Boolean(phone),
  };
};

const normalizeBiometricPayload = (value, fallbackCredential = null) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value?.userData && typeof value.userData === 'object' ? value.userData : value;
  const password = source?.password ?? source?.password_hash ?? source?.passwordHash ?? source?.pin ?? source?.passcode ?? source?.loginPassword ?? source?.credential ?? fallbackCredential ?? null;
  const phone = source?.phone_number ?? source?.phone ?? source?.phoneNumber ?? source?.userPhone ?? value?.phone_number ?? value?.phone ?? value?.phoneNumber ?? value?.userPhone ?? null;

  if (!phone || !password) {
    return null;
  }

  return {
    phone,
    phone_number: phone,
    password,
    password_hash: password,
    pin: password,
    passcode: password,
  };
};

export const authenticateBiometricLogin = async () => {
  const lastUserPhone = await AsyncStorage.getItem('@last_logged_in_phone');
  if (!lastUserPhone) {
    return { success: false, error: 'Please login first to enable biometrics.' };
  }

  const enabled = await getBiometricLoginEnabled(lastUserPhone);
  if (!enabled) {
    return { success: false, error: 'Biometrics not enabled for this account.' };
  }

  const rawSaved = await getBiometricLoginData(lastUserPhone);
  const saved = normalizeBiometricPayload(rawSaved);
  console.log('[biometricLogin] resolved credential payload', {
    lastUserPhone,
    hasRawSaved: Boolean(rawSaved),
    hasNormalizedSaved: Boolean(saved),
    phone: saved?.phone_number || saved?.phone || saved?.phoneNumber || saved?.userPhone || null,
    passwordPresent: Boolean(saved?.password || saved?.password_hash || saved?.pin || saved?.passcode),
    rawKeys: rawSaved && typeof rawSaved === 'object' ? Object.keys(rawSaved) : [],
  });

  if (!saved) {
    return { success: false, error: 'Biometric sign-in data is missing.' };
  }

  const hardwareAvailable = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hardwareAvailable || !enrolled) {
    return { success: false, error: 'Biometric hardware is unavailable or not enrolled.' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: Platform.OS === 'ios' ? 'Login with Face ID' : 'Login with Fingerprint',
    disableDeviceFallback: true,
  });

  if (!result.success) {
    return { success: false, error: 'Biometric authentication failed.' };
  }

  return { success: true, saved };
};

export const showBiometricLoginError = (error) => {
  if (error) {
    Alert.sheet('Biometric Login', error);
  }
};

export const setBiometricLoginSetting = async ({ phone, enabled, userData }) => {
  if (!phone) {
    console.warn('[biometricLogin] Phone number is required.');
    return { success: false, error: 'Phone number is required.' };
  }

  try {
    if (!enabled) {
      await removeBiometricLoginData(phone);
      await setBiometricLoginEnabled(phone, false);
      console.log('[biometricLogin] Biometrics disabled for', phone);
      return { success: true, enabled: false };
    }

    const hardwareAvailable = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hardwareAvailable || !enrolled) {
      console.warn('[biometricLogin] Biometric hardware unavailable');
      return { success: false, error: 'Biometrics not setup.' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable biometric login',
      disableDeviceFallback: true,
    });

    if (!result.success) {
      console.log('[biometricLogin] Biometric authentication cancelled');
      return { success: false, error: 'Biometric authentication was cancelled.' };
    }

    const profileInfo = getProfileIdentity(userData || {});
    const resolvedPhone = profileInfo.phone || phone || null;
    const explicitPasswordHash = userData?.password_hash ?? userData?.password ?? userData?.pin ?? userData?.passcode ?? null;
    const credential = explicitPasswordHash;
    const canEnable = Boolean(resolvedPhone && credential);

    console.log('[biometricLogin] raw values before save', {
      receivedPhone: phone,
      resolvedPhone,
      receivedPasswordHash: explicitPasswordHash ? '[present]' : null,
      rawUserDataKeys: userData ? Object.keys(userData) : [],
      rawUserData: userData || {},
    });

    console.log('[biometricLogin] biometric enable eligibility', {
      phone: resolvedPhone,
      hasPhone: Boolean(resolvedPhone),
      hasCredential: Boolean(credential),
    });

    if (!canEnable) {
      await removeBiometricLoginData(resolvedPhone || phone);
      await setBiometricLoginEnabled(resolvedPhone || phone, false);
      console.warn('[biometricLogin] refused to enable biometrics; missing phone or login credential');
      return { success: false, enabled: false, error: 'Biometric login is unavailable until a phone number and login credential are available.' };
    }

    const payload = normalizeBiometricPayload({ ...(userData || {}), phone_number: resolvedPhone, password_hash: credential }) || {};
    console.log('[biometricLogin] saving payload for biometric login', {
      phone: resolvedPhone,
      passwordPresent: Boolean(payload.password),
      payloadKeys: Object.keys(payload),
    });
    await saveBiometricLoginData(resolvedPhone, payload);
    await setBiometricLoginEnabled(resolvedPhone, true);
    console.log('[biometricLogin] Biometrics enabled for', resolvedPhone);
    return { success: true, enabled: true };
  } catch (error) {
    console.error('[biometricLogin] Error in setBiometricLoginSetting:', error);
    return { success: false, error: error?.message || 'An unexpected error occurred.' };
  }
};
