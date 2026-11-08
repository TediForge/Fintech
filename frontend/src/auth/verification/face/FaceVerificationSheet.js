﻿import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Modal, 
  Dimensions, 
  TouchableOpacity, 
  Animated, 
  PanResponder,
  StatusBar,
  Image,
  ScrollView,
  Easing,
  Platform
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

let VisionCameraCamera = null;
let useCameraDevice = null;
let useCameraPermission = null;
let useFrameProcessor = null;
let visionCameraAvailable = false;
let useFaceDetector = null;
let Worklets = null;

try {
  const visionCameraModule = require('react-native-vision-camera');
  VisionCameraCamera = visionCameraModule.Camera;
  useCameraDevice = visionCameraModule.useCameraDevice;
  useCameraPermission = visionCameraModule.useCameraPermission;
  useFrameProcessor = visionCameraModule.useFrameProcessor;
  visionCameraAvailable = Boolean(VisionCameraCamera && useCameraDevice && useCameraPermission);
} catch (error) {
  console.warn('[FACE VERIFY] Vision Camera module unavailable; using safe fallback mode', error);
}
// Mocked Service Connectors (Replaced during system link with production paths)
import { FaceService } from './services/faceService';

// ==========================================
// SCREEN BRIGHTNESS UTILITY (SAFE REQUIRE)
// ==========================================
let ScreenBrightness = null;
try {
  ScreenBrightness = require('react-native-screen-brightness');
  if (ScreenBrightness.default) ScreenBrightness = ScreenBrightness.default;
} catch (e) {
  console.log('[FaceVerification] ScreenBrightness module not available');
}

// ==========================================
// THEME COLOR CONFIGURATION DESIGN SYSTEM
// ==========================================
const BORDER_COLOR_OK = '#10B981';
const BORDER_COLOR_WARN = '#EF4444';
const BORDER_COLOR_NEUTRAL = '#0E3C2E';
const isExpoGoRuntime = Constants?.appOwnership === 'expo' || Constants?.appOwnership === 'guest';
const ENABLE_NATIVE_CAMERA = !isExpoGoRuntime && Platform.OS !== 'web' && visionCameraAvailable && typeof VisionCameraCamera === 'function';
const CAMERA_RUNTIME_DISABLED_REASON = isExpoGoRuntime
  ? 'The native camera runtime is unavailable in this build. Please use a development build to test the camera flow.'
  : 'The native camera runtime is unavailable in this build.';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('screen');
const TOP_OFFSET = (StatusBar.currentHeight || 44) + 12; 
const SHEET_HEIGHT = SCREEN_HEIGHT - TOP_OFFSET;

const ALIGN_YAW_THRESHOLD = 18;     
const ALIGN_ROLL_THRESHOLD = 16;    
const ALIGN_PITCH_THRESHOLD = 16;
const EYE_THRESHOLD = 0.32;        
const SMILE_THRESHOLD = 0.78;
const TURN_THRESHOLD = 22;          
const NOD_PITCH_THRESHOLD = 9; 

const MIN_FACE_WIDTH_PCT = 0.18;
const CRITICAL_MAX_SCALE_LIMIT = 0.82; 
const STABILITY_REQUIRED_FRAMES = 5;
const TRACKING_LOSS_COOLDOWN_MS = 1200; 

const EMA_ALPHA = 0.40;             
const JITTER_WINDOW_MS = 1500;
const JITTER_TOGGLE_LIMIT = 4;      

const CHALLENGE_POOL = [
  { key: 'BLINK', label: 'Blink your eyes' },
  { key: 'SMILE', label: 'Give a quick smile' },
  { key: 'LOOK_LEFT', label: 'Turn your head left' },
  { key: 'LOOK_RIGHT', label: 'Turn your head right' },
  { key: 'NOD', label: 'Nod your head slightly' }
]; 

const useNoopFaceDetectorOutput = () => ({
  detectFaces: () => [],
  stopListeners: () => {},
});
let faceDetectorHook = useNoopFaceDetectorOutput;

try {
  // Import the detector directly so the package's optional Skia wrapper is not loaded.
  const faceDetectorModule = require('react-native-vision-camera-face-detector/lib/commonjs/FaceDetector');
  const workletsModule = require('react-native-worklets-core');
  if (faceDetectorModule && typeof faceDetectorModule.useFaceDetector === 'function') {
    faceDetectorHook = faceDetectorModule.useFaceDetector;
  }
  if (workletsModule && workletsModule.Worklets) {
    Worklets = workletsModule.Worklets;
  }
} catch (error) {
  console.warn('[CAMERA HARDWARE]: Face detector module unavailable; continuing in preview-only mode', error);
}

function useSafeCameraDevice(position, shouldLog = false) {
  if (!ENABLE_NATIVE_CAMERA || typeof useCameraDevice !== 'function') {
    if (shouldLog) {
      console.warn('[CAMERA HARDWARE]: Native camera hooks unavailable; skipping device lookup for position:', position);
    }
    return null;
  }

  try {
    const device = useCameraDevice(position);
    if (!device) {
      if (shouldLog) {
        console.error('[CAMERA HARDWARE ERROR]: useCameraDevice returned null for position:', position, 'visionCameraAvailable:', visionCameraAvailable);
      }
    } else if (shouldLog) {
      console.log('[CAMERA HARDWARE]: Device acquired for position:', position, 'ID:', device.id);
    }
    return device;
  } catch (error) {
    console.error('[CAMERA HARDWARE CRASH]: useCameraDevice hook threw error for position:', position, {
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack
    });
    return null;
  }
}

function useSafeCameraPermission(shouldLog = false) {
  if (!ENABLE_NATIVE_CAMERA || typeof useCameraPermission !== 'function') {
    if (shouldLog) {
      console.warn('[CAMERA HARDWARE]: Native camera permission hook unavailable; using fallback permission state');
    }
    return { hasPermission: false, requestPermission: async () => false };
  }

  try {
    const result = useCameraPermission();
    if (shouldLog) {
      console.log('[CAMERA HARDWARE]: Permission hook loaded successfully', {
        hasPermission: result?.hasPermission,
        hasAPIVersion: !!result?.hasAPIVersion
      });
    }
    return result;
  } catch (error) {
    console.error('[CAMERA HARDWARE CRASH]: useCameraPermission hook threw error', {
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: error?.stack
    });
    return { hasPermission: false, requestPermission: async () => false };
  }
}

function useSafeFaceDetectorOutput(options, onError) {
  try {
    const normalizedOptions = {
      ...options,
      onError: (error) => {
        if (typeof options?.onError === 'function') {
          options.onError(error);
        }
        if (typeof onError === 'function') {
          onError(error);
        }
      },
    };
    return faceDetectorHook(normalizedOptions);
  } catch (error) {
    console.error('[FACE DETECTOR ERROR] Safe wrapper caught error:', error);
    if (typeof onError === 'function') {
      onError(error);
    }
    return null;
  }
}

export const runFaceVerificationPreflight = async ({ timeoutMs = 2500, onCheck } = {}) => {
  const executeCheck = async () => {
    if (typeof onCheck === 'function') {
      const customResult = await onCheck();
      if (customResult && customResult.ok === false) {
        return { ok: false, error: customResult.error || 'Face verification preflight failed.' };
      }
      return { ok: true };
    }

    if (!visionCameraAvailable || typeof VisionCameraCamera !== 'function') {
      return { ok: false, error: 'The native camera stack is unavailable in this build.' };
    }

    if (typeof useCameraDevice !== 'function' || typeof useCameraPermission !== 'function') {
      return { ok: false, error: 'The camera runtime is missing required hooks.' };
    }

    return { ok: true };
  };

  try {
    return await Promise.race([
      executeCheck(),
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({ ok: false, error: `Face verification preflight timed out after ${timeoutMs}ms.` });
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    return { ok: false, error: error?.message || 'Face verification preflight failed.' };
  }
};

export class FaceVerificationEngine {
  constructor(config, callbacks) {
    this.config = config ||
{};
    this.cameraPosition = config.cameraPosition || 'front'; 
    this.challengeQueue = [];
    this.currentStepIndex = 0;
    this.engineLifecycleState = 'SPATIAL_ALIGNMENT';
    this.capturedData = {
      CENTER: null, BLINK: null, SMILE: null, LOOK_LEFT: null, LOOK_RIGHT: null, NOD: null
    };
    this.capturedCenterImageUri = null;

    this.initialPitch = null;
    this.initialYaw = null;
    this.temporalFrameCount = 0;
    this.startedAt = 0;
    this.lastTrackingLossLoggedAt = 0;
    this.smoothedMetrics = {
      yaw: 0, pitch: 0, roll: 0, faceWidth: 0, xPos: 0, yPos: 0, frameWidth: 0, isInitialized: false
    };
    this.jitterTracker = {
      lastScaleState: null,
      toggleCount: 0,
      timestamps: [],
      isLockedOut: false,
      lockoutliftedAt: 0
    };
    this.riskMatrix = {
      trackingLossCount: 0,
      suddenPositionShifts: 0,
      calculatedRiskScore: 0,
      lastFrameFaceBounds: null
    };
    this.lastEmittedStatus = 'OK'; 
    this.lastEmittedChallengeKey = null;

    this.onStepChanged = callbacks.onStepChanged;
    this.onStatusChanged = callbacks.onStatusChanged; 
    this.onResolved = callbacks.onResolved;
    this.onTickRefresh = callbacks.onTickRefresh;
    this.onCenterAlignedLock = callbacks.onCenterAlignedLock; 
    this.onComputeStarted = callbacks.onComputeStarted;
    this.onProgressUpdate = callbacks.onProgressUpdate;
     
    this.init();
  }

  init() {
    this.startedAt = Date.now();
    const count = this.getChallengeCount(this.config.riskLevel || 'MEDIUM');
    const shuffled = [...CHALLENGE_POOL].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    this.challengeQueue = [
      { key: 'CENTER', label: 'Look at the camera' }, 
      ...selected
    ];
    this.currentStepIndex = 0;
    console.log(`[ENGINE INIT] Sequence Generated on [${this.cameraPosition.toUpperCase()}] camera:`, this.challengeQueue.map(c => c.key));
    this.emitChallenge(this.challengeQueue[0]);
  }

  getChallengeCount(level) {
    switch (level) {
      case 'LOW': return 2;
      case 'HIGH': return 3;
      case 'CRITICAL': return 4;
      default: return 3;
    }
  }

  emitStatus(statusState) {
    if (this.lastEmittedStatus !== statusState) {
      this.lastEmittedStatus = statusState;
      console.log(`[ENGINE SYSTEM STATE SHIFT]: Border color context updated to -> [${statusState}]`);
      this.onStatusChanged(statusState);
    }
  }

  emitChallenge(challenge) {
    if (challenge && this.lastEmittedChallengeKey !== challenge.key) {
      this.lastEmittedChallengeKey = challenge.key;
      console.log(`[ENGINE STEP ADVANCE]: Now Processing Challenge -> [${challenge.key}]`);
      this.onStepChanged(challenge);
      if (this.onTickRefresh) {
        this.onTickRefresh();
      }
    }
  }

  handleTrackingLoss() {
    const now = Date.now();
    console.warn('[ENGINE TRACKING LOSS]: No face structures visible in current frame context');
    if (this.currentStepIndex > 0) {
      if (now - this.lastTrackingLossLoggedAt > TRACKING_LOSS_COOLDOWN_MS) {
        this.riskMatrix.trackingLossCount += 1;
        this.lastTrackingLossLoggedAt = now;
      }
    }
    this.emitStatus('WARN');
    this.temporalFrameCount = 0;
  }

  applySignalFiltering(raw) {
    if (!this.smoothedMetrics.isInitialized) {
      this.smoothedMetrics = {
        yaw: raw.yaw, pitch: raw.pitch, roll: raw.roll,
        faceWidth: raw.faceWidth, xPos: raw.xPos, yPos: raw.yPos,
        frameWidth: raw.frameWidth,
        isInitialized: true
      };
      return;
    }

    this.smoothedMetrics.yaw = (EMA_ALPHA * raw.yaw) + ((1 - EMA_ALPHA) * this.smoothedMetrics.yaw);
    this.smoothedMetrics.pitch = (EMA_ALPHA * raw.pitch) + ((1 - EMA_ALPHA) * this.smoothedMetrics.pitch);
    this.smoothedMetrics.roll = (EMA_ALPHA * raw.roll) + ((1 - EMA_ALPHA) * this.smoothedMetrics.roll);
    this.smoothedMetrics.faceWidth = (EMA_ALPHA * raw.faceWidth) + ((1 - EMA_ALPHA) * this.smoothedMetrics.faceWidth);
    this.smoothedMetrics.xPos = (EMA_ALPHA * raw.xPos) + ((1 - EMA_ALPHA) * this.smoothedMetrics.xPos);
    this.smoothedMetrics.yPos = (EMA_ALPHA * raw.yPos) + ((1 - EMA_ALPHA) * this.smoothedMetrics.yPos);
    this.smoothedMetrics.frameWidth = raw.frameWidth;
  }

  evaluateJitterTelemetry(isScaleValid) {
    const now = Date.now();
    if (this.jitterTracker.isLockedOut) {
      if (now - this.jitterTracker.lockoutliftedAt > 2000) {
        this.jitterTracker.isLockedOut = false;
        this.jitterTracker.toggleCount = 0;
        this.jitterTracker.timestamps = [];
        console.log('[EMA JITTER]: Lockout lifted, resuming normal classification');
      } else {
        return true;
      }
    }

    if (this.jitterTracker.lastScaleState !== null && this.jitterTracker.lastScaleState !== isScaleValid) {
      this.jitterTracker.timestamps.push(now);
      this.jitterTracker.timestamps = this.jitterTracker.timestamps.filter(ts => now - ts < JITTER_WINDOW_MS);
      
      if (this.jitterTracker.timestamps.length >= JITTER_TOGGLE_LIMIT) {
        this.jitterTracker.isLockedOut = true;
        this.jitterTracker.lockoutliftedAt = now;
        console.warn(`[EMA JITTER LOG]: High rate instability discovered. Toggle actions count: ${this.jitterTracker.timestamps.length}`);
        this.emitStatus('WARN');
        return true;
      }
    }

    this.jitterTracker.lastScaleState = isScaleValid;
    return false;
  }

  async processFrame(face, frameWidth) {
    const rawData = this.extractFaceData(face, frameWidth);
    
    this.applySignalFiltering(rawData);
    this.evaluateRiskMetrics(this.smoothedMetrics);
    const currentScaleRatio = this.smoothedMetrics.faceWidth / this.smoothedMetrics.frameWidth;

    console.log(`[FRAME METRICS]: Scale: ${currentScaleRatio.toFixed(3)} | Yaw: ${this.smoothedMetrics.yaw.toFixed(1)} | Smile Prob: ${rawData.smile.toFixed(3)}`);
    if (currentScaleRatio > CRITICAL_MAX_SCALE_LIMIT) {
      this.temporalFrameCount = 0;
      this.emitStatus('WARN');
      return;
    }

    if (currentScaleRatio < MIN_FACE_WIDTH_PCT) {
      this.temporalFrameCount = 0;
      this.emitStatus('WARN');
      return;
    }

    const isScaleValid = true; 

    const isAngularlyAligned = 
      Math.abs(this.smoothedMetrics.yaw) < ALIGN_YAW_THRESHOLD && 
      Math.abs(this.smoothedMetrics.roll) < ALIGN_ROLL_THRESHOLD &&
      Math.abs(this.smoothedMetrics.pitch) < ALIGN_PITCH_THRESHOLD;
    const isJitterThrottled = this.evaluateJitterTelemetry(isScaleValid);
    if (isJitterThrottled) {
      this.temporalFrameCount = 0;
      return;
    }

    const currentChallenge = this.challengeQueue[this.currentStepIndex];
    if (!currentChallenge) return;
    if (this.engineLifecycleState === 'SPATIAL_ALIGNMENT') {
      if (!isAngularlyAligned) {
        this.temporalFrameCount = 0;
        this.emitStatus('WARN');
        return;
      }
    }

    await this.evaluateChallengeState(currentChallenge.key, this.smoothedMetrics, isAngularlyAligned, isScaleValid, rawData);
  }

  extractFaceData(face, frameWidth) {
    const bounds = face.bounds ||
{ x: 0, y: 0, width: 0, height: 0 };
    let nativeYaw = face.yawAngle || 0;
    if (this.cameraPosition === 'front') {
      nativeYaw = -nativeYaw;
    }

    return {
      yaw: nativeYaw,
      roll: face.rollAngle ||
0,
      pitch: face.pitchAngle || 0,
      leftEye: face.leftEyeOpenProbability ??
1,
      rightEye: face.rightEyeOpenProbability ?? 1,
      smile: face.smilingProbability ??
0,
      xPos: bounds.x,
      yPos: bounds.y,
      faceWidth: bounds.width,
      faceHeight: bounds.height,
      frameWidth
    };
  }

  evaluateRiskMetrics(data) {
    if (this.riskMatrix.lastFrameFaceBounds) {
      const deltaX = Math.abs(data.xPos - this.riskMatrix.lastFrameFaceBounds.x);
      const deltaY = Math.abs(data.yPos - this.riskMatrix.lastFrameFaceBounds.y);
      if (deltaX > data.frameWidth * 0.25 || deltaY > data.frameWidth * 0.25) {
        this.riskMatrix.suddenPositionShifts += 1;
        console.warn(`[ANTI-SPOOF TELEMETRY]: High positional displacement delta step. Total: ${this.riskMatrix.suddenPositionShifts}`);
      }
    }
    this.riskMatrix.lastFrameFaceBounds = { x: data.xPos, y: data.yPos };
  }

  async evaluateChallengeState(key, data, isAligned, isScaleValid, rawData) {
    switch (key) {
      case 'CENTER':
        if (isAligned && isScaleValid) {
          this.temporalFrameCount += 1;
          this.emitStatus('OK');
          
          if (this.temporalFrameCount >= STABILITY_REQUIRED_FRAMES) {
            console.log('[CHALLENGE SUCCESS]: Center alignment locked stable, preparing snapshot capture execution loop');
            this.capturedData['CENTER'] = { ...data };
            this.engineLifecycleState = 'CHALLENGE_SEQUENCE';
            
            if (this.onCenterAlignedLock) {
              await this.onCenterAlignedLock();
            }
            this.advancePipeline();
          }
        } else {
          this.temporalFrameCount = 0;
          this.emitStatus('WARN');
        }
        break;
      case 'BLINK':
        console.log(`[EVALUATING BLINK]: Left Eye Open Prob: ${rawData.leftEye.toFixed(3)} | Target: < ${EYE_THRESHOLD}`);
        if (rawData.leftEye < EYE_THRESHOLD && rawData.rightEye < EYE_THRESHOLD) {
          this.temporalFrameCount += 1;
          this.emitStatus('OK');
          if (this.temporalFrameCount >= 2) { 
            console.log('[CHALLENGE SUCCESS]: Blink criteria validated');
            this.capturedData['BLINK'] = { ...data };
            this.advancePipeline();
          }
        } else {
          this.temporalFrameCount = 0;
          this.emitStatus('OK'); 
        }
        break;
      case 'SMILE':
        console.log(`[EVALUATING SMILE]: Smile Prob: ${rawData.smile.toFixed(3)} | Target: > ${SMILE_THRESHOLD}`);
        if (rawData.smile > SMILE_THRESHOLD) {
          this.temporalFrameCount += 1;
          this.emitStatus('OK');
          if (this.temporalFrameCount >= 4) { 
            console.log('[CHALLENGE SUCCESS]: Smile criteria validated');
            this.capturedData['SMILE'] = { ...data };
            this.advancePipeline();
          }
        } else {
          this.temporalFrameCount = 0;
          this.emitStatus('OK');
        }
        break;
      case 'LOOK_LEFT':
        console.log(`[EVALUATING LOOK_LEFT]: Yaw Angle: ${data.yaw.toFixed(2)} | Target: < -${TURN_THRESHOLD}`);
        if (data.yaw < -TURN_THRESHOLD) {
          this.temporalFrameCount += 1;
          this.emitStatus('OK');
          if (this.temporalFrameCount >= 4) {
            console.log('[CHALLENGE SUCCESS]: Left head turn validated');
            this.capturedData['LOOK_LEFT'] = { ...data };
            this.advancePipeline();
          }
        } else {
          this.temporalFrameCount = 0;
          this.emitStatus('OK');
        }
        break;
      case 'LOOK_RIGHT':
        console.log(`[EVALUATING LOOK_RIGHT]: Yaw Angle: ${data.yaw.toFixed(2)} | Target: > ${TURN_THRESHOLD}`);
        if (data.yaw > TURN_THRESHOLD) {
          this.temporalFrameCount += 1;
          this.emitStatus('OK');
          if (this.temporalFrameCount >= 4) {
            console.log('[CHALLENGE SUCCESS]: Right head turn validated');
            this.capturedData['LOOK_RIGHT'] = { ...data };
            this.advancePipeline();
          }
        } else {
          this.temporalFrameCount = 0;
          this.emitStatus('OK');
        }
        break;
      case 'NOD':
        if (this.initialPitch === null) {
          this.initialPitch = data.pitch;
          this.initialYaw = data.yaw;
          this.temporalFrameCount = 0;
        }
        
        const absolutePitchVariance = data.pitch - this.initialPitch;
        console.log(`[EVALUATING NOD]: Rel Pitch: ${absolutePitchVariance.toFixed(2)}, Target Distance: >= ${NOD_PITCH_THRESHOLD}`);
        
        if (Math.abs(absolutePitchVariance) >= NOD_PITCH_THRESHOLD) {
          this.temporalFrameCount += 1;
          this.emitStatus('OK');
          if (this.temporalFrameCount >= 2) {
            console.log(`[CHALLENGE SUCCESS]: Direct single directional nod trajectory approved, Delta Pitch: ${absolutePitchVariance.toFixed(2)}`);
            this.capturedData['NOD'] = { ...data };
            this.advancePipeline();
          }
        } else {
          this.temporalFrameCount = 0;
          this.emitStatus('OK');
        }
        break;
    }
  }

  advancePipeline() {
    this.currentStepIndex += 1;
    this.temporalFrameCount = 0;
    this.emitStatus('OK');
    if (this.currentStepIndex >= this.challengeQueue.length) {
      console.log('[ENGINE SEQUENCE COMPLETE]: Dispatching combined raw telemetry mapping parameters to verification endpoints');
      this.engineLifecycleState = 'COMPUTING_RESULTS';
      if (typeof this.onComputeStarted === 'function') {
        try { this.onComputeStarted(); } catch (e) { console.warn('[ENGINE] onComputeStarted callback threw', e); }
      }
      this.executeServerVerification();
    } else {
      this.initialPitch = null;
      this.initialYaw = null;
      this.emitChallenge(this.challengeQueue[this.currentStepIndex]);
    }
  }

  async executeServerVerification() {
    let score = 0;
    score += this.riskMatrix.trackingLossCount * 15;
    score += this.riskMatrix.suddenPositionShifts * 25;
    this.riskMatrix.calculatedRiskScore = Math.min(score, 100);

    const payloadFaceMetrics = this.capturedData['CENTER'] || this.capturedData['SMILE'];
    const createResult = (status, reason = null, additional = {}) => ({
      status,
      reason,
      riskScore: this.riskMatrix.calculatedRiskScore,
      capturedData: { ...this.capturedData },
      centerImageUri: this.capturedCenterImageUri, 
      timestamps: { startedAt: this.startedAt, completedAt: Date.now() },
      ...additional
    });
    if (this.riskMatrix.calculatedRiskScore > 75) { 
      console.error('[SECURITY TERMINATION]: Risk threshold exceeded:', this.riskMatrix.calculatedRiskScore);
      this.onResolved(createResult('FAILED', 'Anomalous movement signatures detected'));
      return;
    }

    if (this.config.livenessOnly) {
      console.log('[SERVER INTERFACE]: Liveness-only mode enabled; skipping reference lookup and face matching');
      this.onResolved(createResult('SUCCESS', null, {
        livenessPassed: true,
        verifiedMatch: undefined,
        liveSelfie: this.capturedCenterImageUri
      }));
      return;
    }

    try {
      // PHASE 1: Confirm that the server-side challenge is still valid.
      if (this.onProgressUpdate) this.onProgressUpdate(45); 
      const challengeId = this.config.faceVerificationId;
      if (!challengeId) throw new Error('Face verification challenge is required');
      const initialStatus = await FaceService.getChallengeStatus(challengeId, this.config.sessionId);
      if (initialStatus?.success !== true || initialStatus?.data?.status !== 'pending') {
        throw new Error(initialStatus?.message || 'Face verification challenge is unavailable');
      }

      const processingPayload = {
        raw: payloadFaceMetrics,                 
        imageUri: this.capturedCenterImageUri   
      };

      // PHASE 2: Submit the live capture against the server-held reference.
      console.log('[SERVER INTERFACE]: Submitting live capture to face verification engine...');
      if (this.onProgressUpdate) this.onProgressUpdate(92); 

      const match = await FaceService.submitLiveImage({
        faceVerificationId: challengeId,
        sessionToken: this.config.sessionId,
        liveImage: processingPayload.imageUri,
      });
      
      const finalStatus = await FaceService.getChallengeStatus(challengeId, this.config.sessionId);
      const verified = match?.success === true && finalStatus?.success === true && finalStatus?.data?.status === 'verified';
      console.log('[SERVER RESPONSE RECEIVED]:', { verified });
      
      // PHASE 3: Rush to finish
      if (this.onProgressUpdate) this.onProgressUpdate(100);

      // Small delay to let the animation hit 100% for user satisfaction
      await new Promise(r => setTimeout(r, 400));

      if (!verified) {
        return this.onResolved(createResult('FAILED', 'Biometric identification match mismatch', { verifiedMatch: false }));
      }

      // Return liveSelfie to the caller only on success if explicitly requested via config
      this.onResolved(createResult('SUCCESS', null, { 
        verifiedMatch: true, 
        liveSelfie: this.config.getSelfie ? this.capturedCenterImageUri : null 
      }));
    } catch (err) {
      console.error('[SERVER RUNTIME EXCEPTION]:', err);
      this.onResolved(createResult('FAILED', err?.message || 'Processing execution unexpected error'));
    }
  }
}

export const useFaceVerificationEngine = (config, onVerificationComplete, onExecuteHardwareCapture) => {
  const [engineStatus, setEngineStatus] = useState('IDLE');
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [visualState, setVisualState] = useState('OK'); 
  const [countdown, setCountdown] = useState(20);
  const [waitingForServer, setWaitingForServer] = useState(false);
  
  // NEW: Animated progress handling
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [displayPct, setDisplayPct] = useState(0);

  const isClassifyingRef = useRef(true);
  const visualStateRef = useRef('OK');
  const challengeRef = useRef(null);
  const engineRef = useRef(null);
  
  // Listener to sync numeric text with animation
  useEffect(() => {
    const listener = progressAnim.addListener(({ value }) => {
      setDisplayPct(Math.floor(value));
    });
    return () => progressAnim.removeListener(listener);
  }, [progressAnim]);

  const runProgressAnimation = (target, duration) => {
    Animated.timing(progressAnim, {
      toValue: target,
      duration: duration,
      easing: target === 100 ? Easing.out(Easing.quad) : Easing.linear,
      useNativeDriver: false,
    }).start();
  };

  const countdownIntervalRef = useRef(null);
  const batchFlushIntervalRef = useRef(null);
  const isTerminatedRef = useRef(false);
  const frameProcessingLockRef = useRef(false);
  const emptyFramesCounterRef = useRef(0);
  const clearTimers = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (batchFlushIntervalRef.current) {
      clearInterval(batchFlushIntervalRef.current);
      batchFlushIntervalRef.current = null;
    }
  };

  const injectCapturedImageUri = useCallback((uri) => {
    if (engineRef.current) {
      console.log('[HOOK INTERACTION LINK]: Mapping captured file path directly to runtime engine core instance:', uri);
      engineRef.current.capturedCenterImageUri = uri;
    }
  }, []);
  const restartCommandTimeout = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    setCountdown(20);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (isTerminatedRef.current) return 0;
          console.warn('[HOOK TIMEOUT]: Native session command runclock has run out of time');
          
          clearTimers();
          isTerminatedRef.current = true;
          setEngineStatus('FAILED');
          onVerificationComplete({
            status: 'FAILED',
            reason: 'Session command sequence timeout',
            riskScore: 100,
            capturedData: {
              CENTER: null, BLINK: null, SMILE: null, LOOK_LEFT: null, LOOK_RIGHT: null, NOD: null
            },
            centerImageUri: null,
            timestamps: { startedAt: Date.now(), completedAt: Date.now() }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onVerificationComplete]);
  const stopEngine = useCallback(() => {
    console.log('[HOOK LIFECYCLE]: Engine execution ordered to stop, purging run buffers');
    clearTimers();
    isTerminatedRef.current = true;
    frameProcessingLockRef.current = false;
    emptyFramesCounterRef.current = 0;
    engineRef.current = null;
    setEngineStatus('IDLE');
    setCurrentChallenge(null);
    setVisualState('OK');
    setCountdown(20);
    setWaitingForServer(false);
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setDisplayPct(0);
    visualStateRef.current = 'OK';
    challengeRef.current = null;
    isClassifyingRef.current = true;
  }, []);
  const startEngine = useCallback(() => {
    if (engineRef.current && engineRef.current.engineLifecycleState !== 'COMPUTING_RESULTS' && isTerminatedRef.current === false) {
      console.log('[HOOK LIFECYCLE]: Engine already active, ignoring redundant initialization signal');
      return;
    }

    console.log('[HOOK LIFECYCLE]: Engine execution ordered to start, spinning tracking loops');
    clearTimers();
    setWaitingForServer(false);
    isTerminatedRef.current = false;
    progressAnim.setValue(0);
    setDisplayPct(0);
    frameProcessingLockRef.current = false;
    emptyFramesCounterRef.current = 0;
    
    visualStateRef.current = 'OK';
    challengeRef.current = null;
    
    setEngineStatus('PROCESSING');
    setVisualState('OK');
    isClassifyingRef.current = true;

    engineRef.current = new FaceVerificationEngine(config, {
      onStepChanged: (challenge) => {
        challengeRef.current = challenge;
      },
      onStatusChanged: (statusState) => {
        visualStateRef.current = statusState;
      },
      onTickRefresh: () => {
        restartCommandTimeout();
      },
      onCenterAlignedLock: async () => {
        if (onExecuteHardwareCapture) {
          console.log('[THREAD CONTROL]: Dropping classification hooks synchronously...');
          isClassifyingRef.current = false;
          await onExecuteHardwareCapture();
          console.log('[THREAD CONTROL]: Snapshot lock clear, restoring frame engine lanes...');
          isClassifyingRef.current = true;
        }
      },
      onResolved: (result) => {
        if (isTerminatedRef.current) return;
        console.log(`[HOOK RESOLVED]: Pipeline exited tracking loops with final status -> [${result.status}]`);
        clearTimers();
        setWaitingForServer(false);
        isTerminatedRef.current = true;
        setEngineStatus(result.status === 'SUCCESS' ? 'COMPLETED' : 'FAILED');
        onVerificationComplete(result);
      }
      ,onComputeStarted: () => {
        // Pause client-side timers and show a waiting overlay while server verification runs
        console.log('[HOOK] Server verification starting - pausing countdown and showing overlay');
        setWaitingForServer(true);
        clearTimers();
        setEngineStatus('WAITING');
      },
      onProgressUpdate: (target) => {
        setDisplayPct(target);
        // Dynamic durations based on phase
        if (target === 45) runProgressAnimation(45, 1200);   // Smooth start
        else if (target === 92) runProgressAnimation(92, 12000); // Slow crawl (waiting for network)
        else if (target === 100) {
          runProgressAnimation(100, 300); // Snap finish
        }
      }
    });

    const primeStep = engineRef.current.challengeQueue[0];
    challengeRef.current = primeStep;
    setCurrentChallenge(primeStep);
    restartCommandTimeout();

    batchFlushIntervalRef.current = setInterval(() => {
      if (isTerminatedRef.current) return;
      
      setVisualState((prev) => (prev !== visualStateRef.current ? visualStateRef.current : prev));
      setCurrentChallenge((prev) => (prev?.key !== challengeRef.current?.key ? challengeRef.current : prev));
    }, 120);
  }, [config, onVerificationComplete, restartCommandTimeout, onExecuteHardwareCapture]);

  // Fallback: poll engine lifecycle state to ensure overlay shows when computing
  useEffect(() => {
    const poll = setInterval(() => {
      try {
        const isComputing = engineRef.current && engineRef.current.engineLifecycleState === 'COMPUTING_RESULTS';
        setWaitingForServer(Boolean(isComputing));
      } catch (e) {}
    }, 300);
    return () => clearInterval(poll);
  }, []);

  const ingestFaceFrame = useCallback(async (faces, frameWidth) => {
    if (isTerminatedRef.current || !engineRef.current || !isClassifyingRef.current) return;
    if (frameProcessingLockRef.current) return;
    frameProcessingLockRef.current = true;
 
    try {
      if (faces && faces.length > 1) {
        console.warn(`[SECURITY REJECTION]: Multi-face validation threat detected, count: ${faces.length}`);
        visualStateRef.current = 'WARN';
        emptyFramesCounterRef.current = 0;
        return;
      }

      if (!faces || faces.length === 0) {
        emptyFramesCounterRef.current += 1;
        if (emptyFramesCounterRef.current >= 6) {
          engineRef.current.handleTrackingLoss();
        }
        return;
      }
      
      emptyFramesCounterRef.current = 0;
      const workingFace = faces[0];
      
      const resolvedFrameContextWidth = Number(frameWidth) > 0 ? frameWidth : SCREEN_WIDTH;

      await engineRef.current.processFrame(workingFace, resolvedFrameContextWidth);
    } finally {
      frameProcessingLockRef.current = false;
    }
  }, []);
  return {
    engineStatus,
    currentChallenge,
    visualState,
    countdown,
    startEngine,
    stopEngine,
    ingestFaceFrame,
    injectCapturedImageUri,
    waitingForServer,
    verifyProgress: progressAnim, // Return the animated object
    displayPct // Return the listener state
  };
};

const FaceCamera = forwardRef(({ device, isActive, onFacesDetected, onCameraReady, onCameraError }, ref) => {
  const internalCameraRef = useRef(null);
  const isCameraReadyRef = useRef(false);
  const hasReportedFaceDetectorErrorRef = useRef(false);
  const hasReportedCameraErrorRef = useRef(false);

  console.log('[CAMERA HARDWARE]: Mounting FaceCamera', {
    hasDevice: !!device,
    hasFaceHandler: typeof onFacesDetected === 'function',
    platform: Platform.OS,
  });

  const faceDetectionOptions = useMemo(() => ({
    performanceMode: 'fast',
    landmarkMode: 'none',
    contourMode: 'none',
    classificationMode: 'all',
    trackingEnabled: false,
    minFaceSize: 0.15,
    cameraFacing: device?.position || 'front',
  }), [device?.position]);

  const faceDetector = useSafeFaceDetectorOutput(faceDetectionOptions, (error) => {
    if (hasReportedFaceDetectorErrorRef.current) return;
    hasReportedFaceDetectorErrorRef.current = true;
    console.warn('[CAMERA HARDWARE]: Face detector initialization failed', error);
  });
  const canUseFrameProcessor = Boolean(
    typeof useFrameProcessor === 'function' &&
    faceDetector &&
    typeof faceDetector.detectFaces === 'function' &&
    Worklets &&
    typeof Worklets.createRunOnJS === 'function'
  );

  const faceDetectionCallback = useMemo(() => {
    if (!canUseFrameProcessor) return null;
    return Worklets.createRunOnJS(onFacesDetected);
  }, [canUseFrameProcessor, onFacesDetected]);

  const safeFrameProcessorHook = useFrameProcessor || (() => undefined);
  const frameProcessor = safeFrameProcessorHook(
    (frame) => {
      'worklet';
      if (!faceDetector || typeof faceDetector.detectFaces !== 'function') return;
      const faces = faceDetector.detectFaces(frame);
      if (faceDetectionCallback && typeof faceDetectionCallback === 'function') {
        faceDetectionCallback(faces, frame.width);
      }
    },
    [faceDetector, faceDetectionCallback]
  );

  const handleCameraReady = useCallback(() => {
    if (isCameraReadyRef.current) return;
    isCameraReadyRef.current = true;
    console.log('[CAMERA HARDWARE]: Camera context fully initialized and ready for capture operations');
    onCameraReady?.();
  }, [onCameraReady]);

  // Force timeout if native component doesn't initialize within 1.5 seconds
  useEffect(() => {
    const initTimeout = setTimeout(() => {
      if (!isCameraReadyRef.current && !hasReportedCameraErrorRef.current) {
        hasReportedCameraErrorRef.current = true;
        const error = new Error('[NATIVE BRIDGE TIMEOUT] VisionCamera.Camera component did not call onStarted within 1500ms - likely native camera session startup failure');
        console.error('[CAMERA HARDWARE CRITICAL]:', error.message);
        onCameraError?.(error);
      }
    }, 1500);

    return () => clearTimeout(initTimeout);
  }, [onCameraError]);

  useEffect(() => {
    if (!device) {
      const message = 'No camera device available for face verification';
      if (!hasReportedCameraErrorRef.current) {
        hasReportedCameraErrorRef.current = true;
        console.error('[CAMERA HARDWARE]:', message);
        onCameraError?.(new Error(message));
      }
    }
  }, [device, onCameraError]);

  useImperativeHandle(ref, () => ({
    takePhoto: async (options) => {
      if (!internalCameraRef.current) {
        throw new Error('Camera context not initialized');
      }

      if (typeof internalCameraRef.current.takePhoto !== 'function') {
        console.warn('[CAMERA HARDWARE]: Camera photo capture unavailable; skipping capture');
        return null;
      }

      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const photoFile = await internalCameraRef.current.takePhoto(options || { flash: 'off' });
          return photoFile;
        } catch (error) {
          lastError = error;
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
          }
        }
      }
      throw lastError || new Error('Photo capture failed after multiple attempts');
    },
    getCamera: () => internalCameraRef.current
  }));

  useEffect(() => {
    return () => faceDetector.stopListeners();
  }, [faceDetector]);

  if (!ENABLE_NATIVE_CAMERA || !visionCameraAvailable || typeof VisionCameraCamera !== 'function') {
    return (
      <View style={styles.permissionState}>
        <Ionicons name="warning-outline" size={44} color="#D97706" />
        <Text style={styles.permissionTitle}>Camera unavailable</Text>
        <Text style={styles.permissionText}>{CAMERA_RUNTIME_DISABLED_REASON}</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.permissionState}>
        <Ionicons name="warning-outline" size={44} color="#D97706" />
        <Text style={styles.permissionTitle}>Camera setup failed</Text>
        <Text style={styles.permissionText}>No camera device is available for this verification flow.</Text>
      </View>
    );
  }

  console.log('[CAMERA HARDWARE]: About to render VisionCameraCamera native component', {
    hasDevice: !!device,
    deviceId: device?.id,
    isActive,
    platformOS: Platform.OS
  });

  return (
    <VisionCameraCamera
      ref={internalCameraRef}
      device={device}
      isActive={isActive}
      photo={true}
      style={styles.hardwareStream}
      frameProcessor={frameProcessor}
      onError={(e) => {
        console.error('[CAMERA HARDWARE CRITICAL ERROR]', {
          errorName: e?.name,
          errorMessage: e?.message,
          errorCode: e?.code,
          errorStack: e?.stack,
          fullError: e
        });
        if (!hasReportedCameraErrorRef.current) {
          hasReportedCameraErrorRef.current = true;
          onCameraError?.(e);
        }
      }}
      onStarted={handleCameraReady}
    />
  );
});

export const FaceVerificationSheet = ({ 
  isVisible = false,
  sessionId, 
  faceVerificationId: suppliedFaceVerificationId,
  riskLevel = 'MEDIUM', 
  onVerificationComplete,
  getSelfie = false,
  livenessOnly = false
}) => {
  const shouldLogCameraDebug = Boolean(isVisible);
  const frontDevice = ENABLE_NATIVE_CAMERA ? useSafeCameraDevice('front', shouldLogCameraDebug) : null;
  const backDevice = ENABLE_NATIVE_CAMERA ? useSafeCameraDevice('back', shouldLogCameraDebug) : null;
  const { hasPermission, requestPermission } = ENABLE_NATIVE_CAMERA
    ? useSafeCameraPermission(shouldLogCameraDebug)
    : { hasPermission: true, requestPermission: async () => true };
  
  const [showLanding, setShowLanding] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraInitError, setCameraInitError] = useState(null);
  const [cameraFailureMessage, setCameraFailureMessage] = useState(null);
  const [faceVerificationId, setFaceVerificationId] = useState(suppliedFaceVerificationId || null);
  const [challengeReady, setChallengeReady] = useState(false);
  const activeDevice = frontDevice || backDevice;
  const currentCameraPosition = frontDevice ? 'front' : 'back';
  const cameraHardwareRef = useRef(null); 
  const isCameraReadyRef = useRef(false);

  const brightnessBoostedRef = useRef(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const greenArcProgress = useRef(new Animated.Value(0)).current;
  const redArcProgress = useRef(new Animated.Value(0)).current;
  const nativeCameraFrameListenerRef = useRef(null);
  const stopEngineRef = useRef(() => {});
  const injectCapturedImageUriRef = useRef(() => {});
  const completionTimeoutRef = useRef(null);
  const memoizedConfig = useMemo(() => ({
    sessionId,
    faceVerificationId,
    riskLevel,
    cameraPosition: currentCameraPosition,
    getSelfie,
    livenessOnly,
    rc: 9097268
  }), [sessionId, faceVerificationId, riskLevel, currentCameraPosition, getSelfie, livenessOnly]);

  useEffect(() => {
    let cancelled = false;

    const prepareChallenge = async () => {
      if (!isVisible) {
        setChallengeReady(false);
        return;
      }
      let challengeId = suppliedFaceVerificationId;

      if (!challengeId) {
        setFaceVerificationId(null);
        setChallengeReady(false);
        const result = await FaceService.createChallenge(sessionId, 'verification');
        challengeId = result?.data?.faceVerificationId;
        if (!result?.success || !challengeId) {
          if (!cancelled) {
            setChallengeReady(false);
            console.error('[FACE VERIFY]: Challenge creation failed', result);
            onVerificationComplete({
              status: 'FAILED',
              reason: result?.message || 'Face verification challenge could not be created',
              noBiometricReference: result?.status === 404,
            });
          }
          return;
        }
      }

      const statusResult = await FaceService.getChallengeStatus(challengeId, sessionId);
      if (!cancelled && statusResult?.success === true && statusResult?.data?.status === 'pending') {
        setFaceVerificationId(challengeId);
        setChallengeReady(true);
      } else if (!cancelled) {
        setChallengeReady(false);
        console.error('[FACE VERIFY]: Challenge status check failed', statusResult);
        onVerificationComplete({
          status: 'FAILED',
          reason: statusResult?.message || 'Face verification challenge is unavailable',
          noBiometricReference: statusResult?.status === 404,
        });
      }
    };

    prepareChallenge();
    return () => { cancelled = true; };
  }, [isVisible, onVerificationComplete, sessionId, suppliedFaceVerificationId]);

  // Log device detection status
  useEffect(() => {
    if (!isVisible) return;

    console.log('[CAMERA HARDWARE]: Device detection status', {
      frontDevice: frontDevice ? { id: frontDevice.id, position: frontDevice.position } : null,
      backDevice: backDevice ? { id: backDevice.id, position: backDevice.position } : null,
      activeDevice: activeDevice ? { id: activeDevice.id, position: activeDevice.position } : null,
      hasPermission,
      isVisible
    });
  }, [frontDevice, backDevice, activeDevice, hasPermission, isVisible]);

  const dismissSheetVisuals = useCallback((callback) => {
    StatusBar.setBarStyle('dark-content', true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => 
{
      if (callback) callback();
    });
  }, [slideAnim, backdropOpacity]);
  const memoizedCompletionHandler = useCallback((result) => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    if (result.status === 'SUCCESS') {
      setShowSuccess(true);
      // Hold the success screen for 2 seconds before dismissing
      completionTimeoutRef.current = setTimeout(() => {
        completionTimeoutRef.current = null;
        stopEngineRef.current();
        dismissSheetVisuals(() => {
          onVerificationComplete(result);
        });
      }, 2000);
    } else {
      stopEngineRef.current();
      dismissSheetVisuals(() => {
        onVerificationComplete(result);
      });
    }
  }, [onVerificationComplete, dismissSheetVisuals]);
  const reportCameraFailure = useCallback((reason) => {
    const message = typeof reason === 'string' ? reason : reason?.message || 'Unknown camera failure';
    console.error('[FACE VERIFY]: Camera fallback triggered:', message);
    setCameraFailureMessage(message);
    setCameraInitError(message);
    Alert.sheet('Verification camera failed', message, [{ text: 'Close', style: 'cancel' }]);
  }, []);

  const handleCameraReady = useCallback(() => {
    if (isCameraReadyRef.current) return;
    isCameraReadyRef.current = true;
    setCameraReady(true);
    setCameraInitError(null);
    setCameraFailureMessage(null);
    console.log('[CAMERA HARDWARE]: Camera context fully initialized and ready for capture operations');
  }, []);

  const handleCameraError = useCallback((error) => {
    console.error('[FACE VERIFY]: Camera error callback fired', {
      errorName: error?.name,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack
    });
    setCameraReady(false);
    const message = error?.message || 'The camera failed to initialize. Please close and try again.';
    reportCameraFailure(message);
  }, [reportCameraFailure]);

  const handleExecuteHardwareCapture = useCallback(() => {
    return new Promise((resolve) => {
      const attemptCapture = (retryCount = 0) => {
        if (!cameraHardwareRef.current || typeof cameraHardwareRef.current.takePhoto !== 'function') {
          if (retryCount < 2) {
            console.warn(`[HARDWARE COUPLING ALERT]: Camera reference tunnel uninitialized, retrying... (attempt ${retryCount + 1}/2)`);
            setTimeout(() => attemptCapture(retryCount + 1), 400);
            return;
          }
          console.warn('[HARDWARE COUPLING ALERT]: Camera reference tunnel uninitialized during frame extraction trigger');
          resolve(); 
          return;
        }
        
        console.log('[CAMERA CAPTURE ENGINE]: Dispatching internal capturePhotoToFile sequence...');
        cameraHardwareRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false
        })
        .then(async (photoFileToken) => {
          const rawPath = photoFileToken.path || photoFileToken.filePath;
          const normalizedPath = rawPath ? (rawPath.startsWith('file://') ? rawPath : `file://${rawPath}`) : null;
          console.log('[CAMERA CAPTURE SUCCESS]: File stored securely at location:', rawPath);
          
          if (!normalizedPath) {
            console.error('[CAMERA CAPTURE]: No native file path returned from camera capture');
            resolve();
            return; 
          }

          try {
            const base64 = await FileSystem.readAsStringAsync(normalizedPath, { encoding: 'base64' });
            console.log('[CAMERA CAPTURE]: Live photo base64 payload length:', base64.length);
            const imageDataUri = `data:image/jpeg;base64,${base64}`;
            injectCapturedImageUriRef.current(imageDataUri);
          } catch (err) {
            console.error('[CAMERA CAPTURE]: Failed to read file as base64', err);
          }
          setTimeout(resolve, 200);
        })
        .catch((captureError) => {
          if (retryCount < 2) {
            console.warn(`[CAMERA CAPTURE RETRY]: Snapshot failed, retrying... (attempt ${retryCount + 1}/2):`, captureError?.message);
            setTimeout(() => attemptCapture(retryCount + 1), 500);
            return;
          }
          console.error('[CAMERA CAPTURE CRITICAL FAILURE]: Native camera snapshot crashed:', captureError);
          resolve();
        });
      };
      
      setTimeout(() => {
        attemptCapture(0);
      }, 350);
    });
  }, []);

  const { 
    engineStatus, 
    currentChallenge, 
    visualState, 
    countdown, 
    startEngine, 
    stopEngine, 
    ingestFaceFrame, 
    injectCapturedImageUri, 
    waitingForServer,
    verifyProgress,
    displayPct
  } = useFaceVerificationEngine(memoizedConfig, memoizedCompletionHandler, handleExecuteHardwareCapture);
  injectCapturedImageUriRef.current = injectCapturedImageUri;
  stopEngineRef.current = stopEngine;

  useEffect(() => {
    if (visualState === 'OK') {
      Animated.parallel([
        Animated.timing(greenArcProgress, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(redArcProgress, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
      ]).start();
    }

    if (visualState === 'WARN') {
      Animated.parallel([
        Animated.timing(redArcProgress, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(greenArcProgress, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [greenArcProgress, redArcProgress, visualState]);
  const greenArcFill = greenArcProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const redArcFill = redArcProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  if (!nativeCameraFrameListenerRef.current) {
    nativeCameraFrameListenerRef.current = (faces, frameWidth) => ingestFaceFrame(faces, frameWidth);
  }

  useEffect(() => {
    if (!isVisible) {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
      stopEngine();
      setShowLanding(true);
      setShowSuccess(false);
      isCameraReadyRef.current = false;
      setCameraReady(false);
      setCameraInitError(null);
      setCameraFailureMessage(null);
      greenArcProgress.stopAnimation();
      redArcProgress.stopAnimation();
      greenArcProgress.setValue(0);
      redArcProgress.setValue(0);
      return;
    }

    StatusBar.setBarStyle('light-content', true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: TOP_OFFSET,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(async () => {
      if (!showLanding) {
        startEngine();
      }
    });
  }, [greenArcProgress, isVisible, redArcProgress, showLanding, slideAnim, backdropOpacity, startEngine, stopEngine]);

  useEffect(() => {
    const shouldBoostBrightness = Boolean(
      isVisible &&
      !showLanding &&
      cameraReady &&
      !waitingForServer &&
      !cameraInitError &&
      activeDevice
    );

    const restoreBrightness = () => {
      if (!brightnessBoostedRef.current) return;
      brightnessBoostedRef.current = false;
      ScreenBrightness.setAppBrightness(-1).catch(() => {});
    };

    if (!ScreenBrightness || typeof ScreenBrightness.setAppBrightness !== 'function') {
      return undefined;
    }

    if (!shouldBoostBrightness) {
      restoreBrightness();
      return undefined;
    }

    let cancelled = false;
    const boostBrightness = async () => {
      try {
        if (cancelled || brightnessBoostedRef.current) return;
        brightnessBoostedRef.current = true;
        await ScreenBrightness.setAppBrightness(1.0);
        if (cancelled) restoreBrightness();
      } catch (err) {
        if (!cancelled) {
          console.warn('[FaceVerification] Failed to boost brightness:', err);
        }
      }
    };

    boostBrightness();
    return () => {
      cancelled = true;
      restoreBrightness();
    };
  }, [activeDevice, cameraInitError, cameraReady, isVisible, showLanding, waitingForServer]);

  useEffect(() => {
    if (!showLanding && isVisible && !cameraReady && !cameraInitError) {
      const timer = setTimeout(() => {
        const errorContext = {
          frontDevice: !!frontDevice,
          backDevice: !!backDevice,
          activeDevice: !!activeDevice,
          hasPermission,
          cameraReady,
          cameraInitError,
          visionCameraAvailable,
          isVisible,
          showLanding
        };
        console.error('[FACE VERIFY]: Camera initialization timed out after 2.5s', errorContext);
        const errorMsg = 'The camera did not initialize within the timeout period. This usually indicates a native Vision Camera library issue. Check device permissions and try again.';
        setCameraInitError(errorMsg);
      }, 2500); 

      return () => clearTimeout(timer);
    }
  }, [showLanding, isVisible, cameraReady, cameraInitError, frontDevice, backDevice, activeDevice, hasPermission]);

  useEffect(() => {
    return () => {
      if (ScreenBrightness && typeof ScreenBrightness.setAppBrightness === 'function' && brightnessBoostedRef.current) {
        ScreenBrightness.setAppBrightness(-1).catch(() => {});
      }
    };
  }, []);

  const handleUserCancellation = useCallback(() => {
    stopEngine();
    dismissSheetVisuals(() => {
      onVerificationComplete({
        status: 'FAILED',
        reason: 'User cancelled session',
        riskScore: 100,
        capturedData: {
          CENTER: null, BLINK: null, SMILE: null, LOOK_LEFT: null, LOOK_RIGHT: null, NOD: null
        },
        centerImageUri: null,
        timestamps: { startedAt: Date.now(), completedAt: Date.now() }
      });
    });
  }, [stopEngine, dismissSheetVisuals, onVerificationComplete]);

  const handleStartVerification = useCallback(async () => {
    console.log('[FACE VERIFY]: Continue pressed', {
      isVisible,
      hasPermission,
      activeDevice: !!activeDevice,
      platform: Platform.OS,
    });

    if (!faceVerificationId) {
      Alert.sheet('Verification Unavailable', 'Unable to create a face verification challenge. Please try again.');
      return;
    }

    setCameraReady(false);
    setCameraInitError(null);

    if (hasPermission !== true) {
      try {
        const granted = await requestPermission();
        console.log('[FACE VERIFY]: Camera permission request result', granted);
        if (!granted) {
          return; 
        }
      } catch (error) {
        console.error('[FACE VERIFY]: Camera permission request failed', error);
        return;
      }
    }

    setShowLanding(false);
  }, [activeDevice, faceVerificationId, hasPermission, isVisible, requestPermission]);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(TOP_OFFSET + gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SHEET_HEIGHT * 0.25) {
          handleUserCancellation();
        } else {
          Animated.timing(slideAnim, {
            toValue: TOP_OFFSET,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!isVisible || !challengeReady) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" onRequestClose={handleUserCancellation}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}> 
          <View style={styles.dragHeader} {...panResponder.panHandlers}>
            <View style={styles.dragIndicator} />
            <TouchableOpacity style={styles.closeButtonAction} onPress={handleUserCancellation} activeOpacity={0.7}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          {showLanding ? (
            <View style={styles.landingContainer}>
              <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.landingScrollContent}>
                <View style={styles.landingHero}>
                  <Image source={{ uri: 'https://i.pinimg.com/736x/78/6d/ef/786defff7c96eb8c4e487ab5e303499f.jpg' }} style={styles.landingHeroImage} />
                  <LinearGradient colors={['transparent', 'rgba(239, 247, 244, 0.4)', '#eff7f4']} style={styles.landingHeroOverlay} />
                </View>
                <View style={styles.landingTextContent}>
                  <Text style={styles.landingTitle}>Let's verify it's you</Text>
                  <Text style={styles.landingSubtitle}>
                    We need a quick liveness check to ensure your account remains secure.
                    Please follow the on-screen prompts.
                  </Text>
                  <View style={styles.infoList}>
                    <View style={styles.infoItemRow}>
                      <View style={styles.realDot} />
                      <Text style={styles.infoItemText}>Ensure your face is well lit</Text>
                    </View>
                    <View style={styles.infoItemRow}>
                      <View style={styles.realDot} />
                      <Text style={styles.infoItemText}>Remove glasses or face coverings</Text>
                    </View>
                    <View style={styles.infoItemRow}>
                      <View style={styles.realDot} />
                      <Text style={styles.infoItemText}>Keep your head inside the circle</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
              <View style={styles.landingFooter}>
                <TouchableOpacity style={styles.continueBtn} onPress={handleStartVerification} activeOpacity={0.8}>
                  <Text style={styles.continueBtnText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.innerContent}>
              <Text style={styles.clock}>{countdown}s Remaining</Text>
              <View style={styles.circleFrame}>
                {hasPermission === false ? (
                  <View style={styles.permissionState}>
                    <Ionicons name="camera-outline" size={44} color="#0E3C2E" />
                    <Text style={styles.permissionTitle}>Camera access is required</Text>
                    <Text style={styles.permissionText}>Allow camera permission to continue this verification flow.</Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={() => { void requestPermission(); }}>
                      <Text style={styles.permissionButtonText}>Allow camera</Text>
                    </TouchableOpacity>
                  </View>
                ) : cameraInitError ? (
                  <View style={styles.permissionState}>
                    <Ionicons name="warning-outline" size={44} color="#D97706" />
                    <Text style={styles.permissionTitle}>Camera could not start</Text>
                    <Text style={styles.permissionText}>{cameraFailureMessage || cameraInitError}</Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={() => {
                      handleUserCancellation();
                    }}>
                      <Text style={styles.permissionButtonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ) : !ENABLE_NATIVE_CAMERA || !visionCameraAvailable ? (
                  <View style={styles.permissionState}>
                    <Ionicons name="warning-outline" size={44} color="#D97706" />
                    <Text style={styles.permissionTitle}>Camera unavailable</Text>
                    <Text style={styles.permissionText}>{CAMERA_RUNTIME_DISABLED_REASON}</Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={handleUserCancellation}>
                      <Text style={styles.permissionButtonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ) : !activeDevice ? (
                  <>
                    {console.log('[FACE VERIFY]: Showing ActivityIndicator because activeDevice is falsy', { activeDevice })}
                    <ActivityIndicator size="large" color={BORDER_COLOR_NEUTRAL} />
                  </>
                ) : (
                  <>
                    {console.log('[FACE VERIFY]: About to render FaceCamera with props', {
                      hasDevice: !!activeDevice,
                      hasFaceDetectorCallback: typeof nativeCameraFrameListenerRef.current === 'function',
                      showLanding,
                      isVisible,
                      cameraReady
                    })}
                    <FaceCamera
                      ref={cameraHardwareRef}
                      device={activeDevice}
                      isActive={!waitingForServer}
                      onFacesDetected={nativeCameraFrameListenerRef.current}
                      onCameraReady={handleCameraReady}
                      onCameraError={handleCameraError}
                    />
                  </>
                )}
                <View style={styles.arcTrack} pointerEvents="none" />
                <Animated.View
                  pointerEvents="none"
                  style={[styles.arcClip, { height: greenArcFill }]}
                >
                  <View style={[styles.arcStroke, { borderColor: BORDER_COLOR_OK }]} />
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.arcClipBottom, { height: redArcFill }]}
                >
                  <View style={[styles.arcStroke, { borderColor: BORDER_COLOR_WARN }]} />
                </Animated.View>
              </View>
              <Text style={styles.prompt}>
                {currentChallenge?.label || 'Initializing'}
              </Text>
            </View>
          )}
          {waitingForServer && (
            <View style={styles.serverOverlay} pointerEvents="auto">
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.serverOverlayText}>Performing Biometric Audit</Text>
              <View style={styles.progressBarContainer}>
                <Animated.View style={[styles.progressBarFill, { width: verifyProgress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
              </View>
              <Text style={styles.serverOverlayStrong}>{displayPct}% Completed</Text>
            </View>
          )}
          {showSuccess && (
            <View style={styles.successOverlay} pointerEvents="auto">
              <Ionicons name="checkmark-circle" size={84} color="#10B981" />
              <Text style={styles.successOverlayText}>Identity Verified</Text>
              <Text style={styles.successOverlaySub}>Biometric audit completed successfully</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.65)' },
  sheet: { position: 'absolute', left: 0, right: 0, height: SHEET_HEIGHT, backgroundColor: '#eff7f4', borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 24, overflow: 'hidden' },
  dragHeader: { width: '100%', height: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(14, 60, 46, 0.08)', position: 'relative', backgroundColor: '#eff7f4' },
  dragIndicator: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(14, 60, 46, 0.25)' },
  closeButtonAction: { position: 'absolute', right: 20, height: '100%', justifyContent: 'center' },
  closeButtonText: { color: '#D97706', fontSize: 15, fontWeight: '700' },
  innerContent: { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 },
  clock: { fontSize: 16, fontWeight: '700', color: '#0E3C2E', marginBottom: 28, letterSpacing: 0.5 },
  circleFrame: { width: SCREEN_WIDTH * 0.62, height: SCREEN_WIDTH * 0.62, borderRadius: (SCREEN_WIDTH * 0.62) / 2, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  arcTrack: { ...StyleSheet.absoluteFillObject, zIndex: 5, borderTopWidth: 3, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 0, borderColor: BORDER_COLOR_NEUTRAL, borderTopLeftRadius: 999, borderTopRightRadius: 999, borderBottomLeftRadius: 999, borderBottomRightRadius: 999 },
  arcClip: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, overflow: 'hidden' },
  arcClipBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 6, overflow: 'hidden' },
  arcStroke: { ...StyleSheet.absoluteFillObject, borderTopWidth: 3, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 0, borderTopLeftRadius: 999, borderTopRightRadius: 999, borderBottomLeftRadius: 999, borderBottomRightRadius: 999 },
  hardwareStream: { flex: 1, width: '100%' },
  landingContainer: { flex: 1, paddingBottom: 70, paddingTop: 20, },
  landingScrollContent: { paddingHorizontal: 24 },
  landingHero: { height: 200, width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 24, backgroundColor: '#cbd5e1', position: 'relative' },
  landingHeroImage: { width: '100%', height: '100%' },
  landingHeroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  landingTitle: { fontSize: 24, fontWeight: '800', color: '#0E3C2E', marginBottom: 12 },
  landingSubtitle: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 24 },
  infoList: { gap: 16 },
  infoItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  realDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  infoItemText: { fontSize: 15, color: '#1e293b' },
  landingFooter: { paddingHorizontal: 20, marginTop: 'auto' },
  continueBtn: { backgroundColor: '#0E3C2E', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  continueBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  prompt: { marginTop: 32, fontSize: 18, fontWeight: '600', color: '#0E3C2E' },
  serverOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(239, 247, 244, 0.98)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  serverOverlayText: { color: '#0E3C2E', marginTop: 16, fontSize: 16, fontWeight: '700' },
  serverOverlayStrong: { color: '#10B981', marginTop: 8, fontSize: 13, fontWeight: '800' },
  permissionState: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: '#f8fafc' },
  permissionTitle: { marginTop: 16, fontSize: 18, fontWeight: '700', color: '#0E3C2E', textAlign: 'center' },
  permissionText: { marginTop: 8, fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20 },
  permissionButton: { marginTop: 18, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: '#0E3C2E' },
  permissionButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progressBarContainer: { width: SCREEN_WIDTH * 0.7, height: 6, backgroundColor: 'rgba(14, 60, 46, 0.1)', borderRadius: 3, marginTop: 20, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  successOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#eff7f4', justifyContent: 'center', alignItems: 'center', zIndex: 110 },
  successOverlayText: { color: '#0E3C2E', marginTop: 16, fontSize: 22, fontWeight: '800' },
  successOverlaySub: { color: '#64748B', marginTop: 8, fontSize: 15, fontWeight: '500' }
});