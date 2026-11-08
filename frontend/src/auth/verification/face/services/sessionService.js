// ==========================================
// SERVICES/SESSIONSERVICE.JS
// ==========================================
/**
 * Legacy reference-image retrieval is intentionally unsupported.
 */
export const SessionService = {
  async getFaceReference(sessionId) {
    console.warn('[SESSION SERVICE] Reference images are no longer returned by the face engine', sessionId);
    return null;
  }
};