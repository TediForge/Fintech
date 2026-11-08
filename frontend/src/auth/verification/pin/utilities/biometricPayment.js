import {
  getBiometricPaymentEnabled,
  setBiometricPaymentEnabled,
} from './biometricPaymentStorage';

export const isBiometricPaymentEnabled = async (phone) => {
  return await getBiometricPaymentEnabled(phone);
};

export const enableBiometricPayment = async (phone, enabled) => {
  await setBiometricPaymentEnabled(phone, enabled);
};

export const setBiometricPaymentSetting = async ({ phone, enabled, promptMessage = 'Enable biometric payments' }) => {
  try {
    if (!phone) {
      console.warn('[biometricPayment] Phone number is required.');
      return { success: false, message: 'Phone number is required.' };
    }

    if (enabled === false) {
      await setBiometricPaymentEnabled(phone, false);
      console.log('[biometricPayment] Payment biometrics disabled for', phone);
      return { success: true, message: 'Biometric payments disabled.' };
    }

    const { LocalAuthentication } = require('expo-local-authentication');
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      console.warn('[biometricPayment] Biometric hardware unavailable');
      return { success: false, message: 'Biometric authentication is not available on this device.' };
    }

    await setBiometricPaymentEnabled(phone, true);
    console.log('[biometricPayment] Payment biometrics enabled for', phone);
    return { success: true, message: 'Biometric payments enabled.' };
  } catch (error) {
    console.error('[biometricPayment] Error in setBiometricPaymentSetting:', error);
    return { success: false, message: 'Unable to update biometric payment setting.' };
  }
};
