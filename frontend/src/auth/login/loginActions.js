// Copyright (c) 2026 Tediwave, all rights reserved, subject to the proprietary license located in the root directory
import { getFullMetadata } from '@lib/utils/metadata';
import config from '@config/app';
import { apiConfig } from '@config/api';

const LOGIN_URL = `${apiConfig.baseUrl}/v1/auth/login/mobile/index.php`;

/**
 * LOGIN STEP 2 PAYLOAD:
 * {
 *   "step": 2,
 *   "phone": "+2348012345678",
 *   "pin": "1234",
 *   "metadata": {
 *     "session": { "id": "uuid", "createdAt": "timestamp", "channel": "mobile" },
 *     "device": {
 *       "id": "uuid",
 *       "name": "iPhone 15",
 *       "os": "iOS 17.4",
 *       "brand": "Apple",
 *       "model": "iPhone 15",
 *       "manufacturer": "Apple",
 *       "deviceType": "phone",
 *       "isEmulator": false
 *     },
 *     "app": { "version": "1.2.0", "build": 45, "environment": "production" },
 *     "network": { "ip": "auto-from-backend", "type": "wifi", "carrier": "MTN", "isVpn": false },
 *     "location": { "country": "NG", "region": "Rivers", "city": "Port Harcourt", "lat": 4.81, "lng": 7.04 },
 *     "security": { "fingerprint": "sha256_hash", "isRooted": false, "biometricEnabled": true },
 *     "notification": { "expoPushToken": "ExponentPushToken[xxx]" }
 *   }
 * }
 */

// ✅ Exported validation function
export const isValidPhone = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '');
  return (
    (cleanPhone.startsWith('0') && cleanPhone.length === 11) ||
    (!cleanPhone.startsWith('0') && cleanPhone.length === 10)
  );
};

export const fetchUserDetails = async (phone) => {
  try {
    const payload = { step: 1, phone };
    console.log('[loginActions] identify request payload', payload);

    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log('[loginActions] identify response', { status: res.status, data });
    return data; // should contain { success, fname, image }
  } catch (err) {
    console.log('[loginActions] identify request error', err);
    return { success: false, message: 'Network error' };
  }
};

export const handlePinAuth = async (phone, pin, device_name, device_os, expo_push_token) => {
  try {
    // 1. Gather Metadata via utility
    const fullMetadata = await getFullMetadata(expo_push_token);

    // 2. Construct Final Payload and Send
    const payload = {
      step: 2,
      phone,
      pin,
      metadata: fullMetadata,
    };
    console.log('[loginActions] authenticate request payload', payload);

    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Debug: show raw response text
    const text = await res.text();
    console.log('Raw response text:', text);

    const data = JSON.parse(text); // parse after logging
    return data;
  } catch (err) {
    console.log('Network error in handlePinAuth:', err);
    return { success: false, message: 'Network error' };
  }
};

export const finalizeMobileLogin = async (sessionToken, faceVerificationId) => {
  try {
    const metadata = await getFullMetadata();
    const response = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 3,
        sessionToken,
        faceVerificationId,
        metadata: { security: { fingerprint: metadata?.security?.fingerprint } },
      }),
    });
    const data = await response.json();
    return response.ok ? data : { success: false, message: data?.message || 'Login finalization failed' };
  } catch (error) {
    console.error('Login finalization error:', error);
    return { success: false, message: 'Network error' };
  }
};