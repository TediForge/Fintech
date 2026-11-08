import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;
// ==========================================
// SERVICES/FACESERVICE.JS
// ==========================================

const BIOMETRIC_GATEWAY = `${api}/v1/auth/verification/face/index.php`;

/**
 * Internal helper with deep-logging for debugging biometric gateway transactions
 */
const callBiometricGateway = async (payload) => {
  try {
    const response = await fetch(BIOMETRIC_GATEWAY, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json',
        'Connection': 'keep-alive' // Optimize for subsequent parallel requests
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    // Extract only the JSON portion to ignore trailing documentation or PHP warnings
    const jsonMatch = rawText.match(/(\{[\s\S]*\})/);
    const cleanText = jsonMatch ? jsonMatch[1] : rawText.trim().replace(/^\uFEFF/, '');

    if (!response.ok) {
      try {
        const errorBody = JSON.parse(cleanText);
        return { success: false, status: response.status, message: errorBody.message || `Server error ${response.status}` };
      } catch (e) {
        return { success: false, status: response.status, message: `Server error ${response.status}` };
      }
    }

    try {
      return JSON.parse(cleanText);
    } catch (jsonError) {
      console.error('[FaceService] JSON Parse Error. Received content:', cleanText);
      return { success: false, status: response.status, message: 'Malformed server response' };
    }
  } catch (error) {
    console.error('[FaceService] Network connection failure:', error);
    return { success: false, status: 0, message: 'Network communication failure' };
  }
};

export const FaceService = {
  async createChallenge(sessionToken, purpose = 'verification') {
    if (!sessionToken) return { success: false, message: 'Session token is required' };
    return callBiometricGateway({ step: 1, sessionToken, purpose });
  },

  async getChallengeStatus(faceVerificationId, sessionToken) {
    if (!faceVerificationId) return { success: false, message: 'Face verification challenge is required' };
    const payload = { step: 3, faceVerificationId };
    if (sessionToken) payload.sessionToken = sessionToken;
    return callBiometricGateway(payload);
  },

  async submitLiveImage({ faceVerificationId, sessionToken, liveImage }) {
    if (!faceVerificationId || !sessionToken || !liveImage) {
      return { success: false, message: 'Face verification parameters are required' };
    }
    return callBiometricGateway({ step: 2, faceVerificationId, sessionToken, liveImage });
  }
};