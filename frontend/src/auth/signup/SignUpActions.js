import { getFullMetadata } from '@lib/utils/metadata';
import config from '@config/app';
import { apiConfig } from '@config/api';

// ✅ Updated validation function to handle 0-prefixed (11 digits) or non-prefixed (10 digits)
export const isValidPhone = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '');
  return (
    (cleanPhone.startsWith('0') && cleanPhone.length === 11) ||
    (!cleanPhone.startsWith('0') && cleanPhone.length === 10)
  );
};

/**
 * Checks uniqueness of Email, Phone, and validity of Referral code.
 * Endpoint: /v1/auth/onboarding/mobile/index.php
 */
export const checkEmailReferral = async (email = null, referral = null, phone = null, countryCode = 'NG') => {
  // 1. Basic email format validation (Only if email is provided)
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
  }

  try {
    const response = await fetch(`${apiConfig.baseUrl}/v1/auth/onboarding/mobile/index.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 1, email, referral, countryCode, phone }),
    });

    const result = await response.json();
    
    // The API returns success: true for 200 OK
    return {
      success: !!result.success,
      message: result.message || 'Unknown response from server.',
      status: result.status,
      onboardingId: result.data?.onboardingId,
    };
  } catch (error) {
    console.error('Verification error:', error);
    return { success: false, message: 'Unable to connect to verification server.' };
  }
};

/**
 * Finalizes the mobile account registration.
 * Endpoint: /v1/auth/onboarding/mobile/index.php
 */
export const submitSignUp = async (formData) => {
  try {
    if (!formData?.onboardingId) {
      console.warn('[SignUpActions] step 2 blocked: onboardingId is missing');
      return { success: false, message: 'Registration session is missing' };
    }

    const API_URL = `${apiConfig.baseUrl}/v1/auth/onboarding/mobile/index.php`;

    // 1. Gather deep metadata via utility
    const fullMetadata = await getFullMetadata(formData.expo_push_token);

    // 2. Construct the final payload based on the new API documentation
    const payload = {
      step: 2,
      onboardingId: formData.onboardingId,
      password: formData.password,
      metadata: fullMetadata,
    };

    // --- LOGGING DATA BEFORE SENDING ---
    console.log('--- Outgoing Signup Payload ---');
    console.log(JSON.stringify(payload, null, 2)); 
    // ------------------------------------

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    // Log the response too, to see what the server said back
    console.log('--- Server Response ---', data);
    console.log('[SignUpActions] step 2 response summary', {
      httpStatus: response.status,
      ok: response.ok,
      success: data?.success === true,
      sessionTokenPresent: Boolean(data?.data?.sessionToken || data?.sessionToken),
    });

    if (response.ok && data.success) {
      const sessionToken = data.data?.sessionToken || data.sessionToken || null;
      console.log('[SignUpActions] returning successful signup result', {
        sessionTokenPresent: Boolean(sessionToken),
        userId: data.data?.userId || data.user_id || null,
      });
      return {
        success: true, 
        message: data.message || 'Account created successfully!',
        sessionToken,
        [config.sessionToken]: sessionToken,
        user_id: data.data?.userId || data.user_id
      };
    } else {
      return { 
        success: false, 
        message: data.message || 'Something went wrong during signup.' 
      };
    }

  } catch (error) {
    console.error('Signup Error:', error);
    return { 
      success: false, 
      message: 'Network error. Please check your internet connection.' 
    };
  }
};