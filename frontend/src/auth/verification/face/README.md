# FaceVerificationSheet

A production-grade, liveness-aware biometric face verification component for React Native. Presents a bottom-sheet camera UI that guides a user through a randomised challenge sequence (blink, smile, head turns, nod), captures a reference photo, and verifies identity against a stored biometric anchor via your backend API.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [FaceVerificationSheet](#faceverificationsheet-component)
  - [useFaceVerificationEngine](#usefaceverificationengine-hook)
  - [FaceVerificationEngine](#faceverificationengine-class)
  - [FaceService](#faceservice)
  - [SessionService](#sessionservice)
- [Challenge Sequence](#challenge-sequence)
- [Risk Levels](#risk-levels)
- [Verification Result Object](#verification-result-object)
- [Hardening Constants](#hardening-constants)
- [Anti-Spoofing & Risk Matrix](#anti-spoofing--risk-matrix)
- [Backend Integration](#backend-integration)
- [Customisation](#customisation)
- [Troubleshooting](#troubleshooting)

---

## Overview

`FaceVerificationSheet` is a self-contained biometric verification module. When invoked, it:

1. Slides up as an animated bottom sheet over the current screen.
2. Activates the front camera (falls back to rear if unavailable).
3. Validates that the user's face is centred, correctly scaled, and angularly aligned.
4. Randomises a liveness challenge sequence based on the configured `riskLevel`.
5. Captures a silent photo at centre-lock to use as the verification frame.
6. Submits the capture to three parallel service checks — quality, liveness, and biometric match.
7. Returns a structured result object to the calling component and dismisses itself.

---

## Architecture

```
FaceVerificationSheet          ← Modal UI, animation, pan-dismiss gesture
│
├── FaceCamera (forwardRef)    ← Wraps react-native-vision-camera-face-detector
│
├── useFaceVerificationEngine  ← React hook: lifecycle, timers, state bridging
│   │
│   └── FaceVerificationEngine ← Core class: frame processing, challenge FSM,
│                                 EMA signal filtering, jitter guard, risk matrix
│
├── FaceService                ← Quality / liveness / biometric-match calls
│
└── SessionService             ← Reference image resolution
```

---

## Prerequisites

| Dependency | Minimum Version | Notes |
|---|---|---|
| React Native | 0.72+ | New Architecture compatible |
| react-native-vision-camera | 4.x | Core camera engine |
| react-native-vision-camera-face-detector | 1.x | Face landmarks plugin |

Camera permissions must be declared and requested before mounting the sheet:

- **iOS** — `NSCameraUsageDescription` in `Info.plist`
- **Android** — `CAMERA` permission in `AndroidManifest.xml`

---

## Installation

```bash
npm install react-native-vision-camera \
            react-native-vision-camera-face-detector \
            @react-native-async-storage/async-storage
```

For iOS, run pod install after installing native dependencies:

```bash
cd ios && pod install
```

Copy the following files into your project:

```
src/
├── FaceVerificationSheet.jsx   ← Main component (this file)
├── services/
│   ├── faceService.js          ← Replace with your production implementation
│   └── sessionService.js       ← Replace with your production implementation
```

> **Note:** `FaceService` and `SessionService` are shipped as mocks. Wire them to your real API before going to production — see [Backend Integration](#backend-integration).

---

## Quick Start

```jsx
import React, { useState } from 'react';
import { Button, View } from 'react-native';
import { FaceVerificationSheet } from './src/FaceVerificationSheet';

export default function App() {
  const [showVerification, setShowVerification] = useState(false);

  const handleResult = (result) => {
    console.log('Verification result:', result);

    if (result.status === 'SUCCESS') {
      // Proceed — user is verified
    } else {
      // Handle failure or cancellation via result.reason
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Button title="Verify Identity" onPress={() => setShowVerification(true)} />

      <FaceVerificationSheet
        isVisible={showVerification}
        sessionId="user-session-abc123"
        riskLevel="MEDIUM"
        onVerificationComplete={(result) => {
          setShowVerification(false);
          handleResult(result);
        }}
      />
    </View>
  );
}
```

---

## API Reference

### `FaceVerificationSheet` Component

The top-level component. Renders as a `Modal` with an animated bottom sheet.

```jsx
<FaceVerificationSheet
  isVisible={boolean}
  sessionId={string | undefined}
  faceVerificationId={string | undefined}
  riskLevel="LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  livenessOnly={boolean}
  onVerificationComplete={(result) => void}
/>
```

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `isVisible` | `boolean` | ✅ | `false` | Controls sheet visibility. Mount/unmount via this prop, not conditional rendering. |
| `sessionId` | `string` | ⬜ | `undefined` | Session token used to create a challenge when `faceVerificationId` is not supplied. |
| `faceVerificationId` | `string` | ⬜ | `undefined` | Existing server-side challenge ID. The reference image is never sent to the client. |
| `riskLevel` | `string` | ⬜ | `"MEDIUM"` | Controls the number of liveness challenges. See [Risk Levels](#risk-levels). |
| `livenessOnly` | `boolean` | ⬜ | `false` | Runs the liveness challenges and captures a selfie without reference-image lookup or backend face matching. The successful result returns the captured selfie in `liveSelfie`. |
| `onVerificationComplete` | `function` | ✅ | — | Callback fired with a [VerificationResult](#verification-result-object) on success, failure, or user cancellation. The sheet dismisses itself before calling this. |

---

### `useFaceVerificationEngine` Hook

Manages engine lifecycle, countdown timer, frame ingestion, and React state bridging. Consumed internally by `FaceVerificationSheet` but exported for headless or custom UI implementations.

```js
const {
  engineStatus,       // 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  currentChallenge,   // { key: string, label: string } | null
  visualState,        // 'OK' | 'WARN'
  countdown,          // number — seconds remaining for current challenge
  startEngine,        // () => void
  stopEngine,         // () => void
  ingestFaceFrame,    // (faces: Face[]) => Promise<void>
  injectCapturedImageUri // (uri: string) => void
} = useFaceVerificationEngine(config, onVerificationComplete, onExecuteHardwareCapture);
```

| Parameter | Type | Description |
|---|---|---|
| `config` | `object` | Engine configuration: `{ faceVerificationId, sessionId, riskLevel, cameraPosition }` |
| `onVerificationComplete` | `function` | Receives the final `VerificationResult` |
| `onExecuteHardwareCapture` | `() => Promise<void>` | Async callback triggered at centre-lock. Must call `takePhoto` and pipe the URI to `injectCapturedImageUri`. |

---

### `FaceVerificationEngine` Class

The core state machine. Can be instantiated independently of React for testing or non-UI pipelines.

```js
const engine = new FaceVerificationEngine(config, callbacks);
```

**Config object:**

| Key | Type | Description |
|---|---|---|
| `cameraPosition` | `'front' \| 'back'` | Used to normalise yaw angle sign convention |
| `riskLevel` | `string` | Determines challenge count |
| `faceVerificationId` | `string` | Server-side face verification challenge ID |
| `sessionId` | `string` | Session token used for live-image submission |

**Callbacks object:**

| Key | Signature | Description |
|---|---|---|
| `onStepChanged` | `(challenge) => void` | Fired when the active challenge advances |
| `onStatusChanged` | `(status: 'OK' \| 'WARN') => void` | Fired on border state transitions |
| `onTickRefresh` | `() => void` | Fired on challenge advance to reset countdown timer |
| `onCenterAlignedLock` | `() => Promise<void>` | Awaited when centre lock is confirmed — use to capture photo |
| `onResolved` | `(result) => void` | Fired with final `VerificationResult` |

**Key methods:**

| Method | Description |
|---|---|
| `processFrame(face, frameWidth)` | Feed a single detected face object and the frame width in pixels |
| `handleTrackingLoss()` | Call when no face is detected for several consecutive frames |
| `advancePipeline()` | Internally called on challenge success; exposed for testing |

---

### `FaceService`

Uses the server-held reference through the face verification challenge engine.

```js
// Create a challenge when one was not supplied
await FaceService.createChallenge(sessionToken, 'verification');

// Check challenge status before and after local liveness
await FaceService.getChallengeStatus(faceVerificationId);

// Submit the captured live image for server-side comparison
await FaceService.submitLiveImage({ faceVerificationId, sessionToken, liveImage });
```

The server retains the reference image and returns only challenge status and verification results.

---

### `SessionService`

Legacy reference-image retrieval is no longer used. Face challenges are managed by `FaceService`.

```js
```

Face verification engine endpoint:

| Operation | Endpoint |
|---|---|
| Create, compare, or query | `POST ${api}/v1/auth/face/index.php` with `step: 1`, `step: 2`, or `step: 3` |

---

## Challenge Sequence

The engine always begins with a mandatory **CENTER** step. After the face is stably centred, a randomised subset from the pool below is appended based on `riskLevel`.

| Challenge Key | Instruction Shown | Detection Logic |
|---|---|---|
| `CENTER` | Look at the camera | Yaw, roll, pitch all within alignment thresholds for 5 stable frames |
| `BLINK` | Blink your eyes | Both eye-open probabilities drop below `0.32` simultaneously for 2 frames |
| `SMILE` | Give a quick smile | Smile probability exceeds `0.78` for 4 consecutive frames |
| `LOOK_LEFT` | Turn your head left | Smoothed yaw angle drops below `-22°` for 4 frames |
| `LOOK_RIGHT` | Turn your head right | Smoothed yaw angle exceeds `+22°` for 4 frames |
| `NOD` | Nod your head slightly | Pitch delta from baseline exceeds `±9°` for 2 frames |

Each challenge has a **20-second timeout**. The timer resets on every challenge advance. Expiry triggers an immediate `FAILED` result.

---

## Risk Levels

| Level | Extra Challenges | Total Steps |
|---|---|---|
| `LOW` | 2 | 3 (CENTER + 2) |
| `MEDIUM` | 3 | 4 (CENTER + 3) — default |
| `HIGH` | 3 | 4 (CENTER + 3) |
| `CRITICAL` | 4 | 5 (CENTER + 4) |

---

## Verification Result Object

`onVerificationComplete` always receives an object of this shape:

```js
{
  status: 'SUCCESS' | 'FAILED',

  // Human-readable failure reason. null on SUCCESS.
  reason: string | null,

  // Computed risk score 0–100. Values above 75 trigger automatic failure.
  riskScore: number,

  // Smoothed face metric snapshots captured at each challenge completion.
  capturedData: {
    CENTER:     { yaw, pitch, roll, faceWidth, xPos, yPos, frameWidth } | null,
    BLINK:      { ... } | null,
    SMILE:      { ... } | null,
    LOOK_LEFT:  { ... } | null,
    LOOK_RIGHT: { ... } | null,
    NOD:        { ... } | null
  },

  // Absolute local file path of the captured centre-lock photo.
  centerImageUri: string | null,

  timestamps: {
    startedAt: number,    // Unix ms — engine start
    completedAt: number   // Unix ms — resolution time
  },

  // Present on service-layer failures only:
  qualityPassed:  boolean | undefined,
  livenessPassed: boolean | undefined,
  verifiedMatch:  boolean | undefined
}
```

---

## Hardening Constants

These are calibrated at **Level 5.05** and can be adjusted at the top of the file:

| Constant | Default | Purpose |
|---|---|---|
| `ALIGN_YAW_THRESHOLD` | `18°` | Maximum yaw deviation for centre alignment |
| `ALIGN_ROLL_THRESHOLD` | `16°` | Maximum roll deviation for centre alignment |
| `ALIGN_PITCH_THRESHOLD` | `16°` | Maximum pitch deviation for centre alignment |
| `EYE_THRESHOLD` | `0.32` | Eye-open probability floor for blink detection |
| `SMILE_THRESHOLD` | `0.78` | Smile probability ceiling for smile detection |
| `TURN_THRESHOLD` | `22°` | Yaw angle magnitude required for left/right turns |
| `NOD_PITCH_THRESHOLD` | `9°` | Pitch delta from baseline required for nod |
| `MIN_FACE_WIDTH_PCT` | `0.18` | Minimum face width as a fraction of frame width (too far away) |
| `CRITICAL_MAX_SCALE_LIMIT` | `0.82` | Maximum face width fraction (too close) |
| `STABILITY_REQUIRED_FRAMES` | `5` | Consecutive aligned frames to confirm centre lock |
| `EMA_ALPHA` | `0.40` | Exponential moving average smoothing factor |
| `JITTER_WINDOW_MS` | `1500 ms` | Window over which scale-state toggles are counted |
| `JITTER_TOGGLE_LIMIT` | `4` | Toggle count within the window that triggers jitter lockout |
| `TRACKING_LOSS_COOLDOWN_MS` | `1200 ms` | Minimum interval between increments to `trackingLossCount` |

---

## Anti-Spoofing & Risk Matrix

The engine accumulates a `riskScore` throughout the session using two signals:

| Event | Score Increment |
|---|---|
| Tracking loss (face disappears) | `+15` per event (rate-limited to one per 1200 ms) |
| Sudden large positional shift | `+25` per frame (delta > 25% of frame width on either axis) |

Additional guards:

- **Multi-face rejection** — Any frame with more than one detected face immediately sets `visualState` to `WARN` and is discarded.
- **Jitter lockout** — If the scale-validity flag toggles 4 or more times within 1500 ms, the engine enters a 2-second lockout during which frames are silently dropped.
- **Hard risk cap** — A `riskScore` above `75` at submission time bypasses all service calls and immediately resolves with `FAILED`.

---

## Backend Integration

### Replace `FaceService`

Implement the three async methods in `services/faceService.js` to call your ML pipeline:

```js
// services/faceService.js
export const FaceService = {
  async assessQuality({ raw, imageUri, riskTelemetry }) {
    const response = await fetch('https://your-api.com/face/quality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUri, riskTelemetry })
    });
    return response.json(); // { passed: boolean }
  },

  async getChallengeStatus(faceVerificationId) {
    return callEngine({ step: 3, faceVerificationId });
  },

  async submitLiveImage({ faceVerificationId, sessionToken, liveImage }) {
    return callEngine({ step: 2, faceVerificationId, sessionToken, liveImage });
  }
};
```

The server-held reference is never returned to the client. Use `face/index.php` for challenge creation, live-image submission, and status checks.

---

## Customisation

### Colours

Three semantic colours drive the animated border:

```js
const BORDER_COLOR_OK      = '#10B981'; // Aligned / challenge in progress
const BORDER_COLOR_WARN    = '#EF4444'; // Misaligned / face lost / anomaly
const BORDER_COLOR_NEUTRAL = '#0E3C2E'; // Default / uninitialised
```

### Circle overlay size

The viewfinder circle size is derived from `SCREEN_WIDTH`:

```js
// In StyleSheet:
width:  SCREEN_WIDTH * 0.62,
height: SCREEN_WIDTH * 0.62,
```

Adjust the multiplier to suit your design.

### Challenge pool

Add, remove, or reorder entries in `CHALLENGE_POOL` to change what gestures are available for randomisation. The `CENTER` challenge is always injected as the first step and is not part of the pool.

```js
const CHALLENGE_POOL = [
  { key: 'BLINK',      label: 'Blink your eyes'         },
  { key: 'SMILE',      label: 'Give a quick smile'       },
  { key: 'LOOK_LEFT',  label: 'Turn your head left'      },
  { key: 'LOOK_RIGHT', label: 'Turn your head right'     },
  { key: 'NOD',        label: 'Nod your head slightly'   }
];
```

---

## Troubleshooting

**Camera shows a black screen**
Verify camera permissions are granted at runtime and that `react-native-vision-camera` is correctly linked. On Android, confirm `CAMERA` is in `AndroidManifest.xml`.

**Face is never detected**
Ensure `runClassifications={true}` is set on the `Camera` component and that `react-native-vision-camera-face-detector` is installed and linked. The component requires a physical device; face detection does not work in the iOS or Android simulator.

**Yaw direction is inverted on head turns**
The engine automatically negates the raw yaw value when `cameraPosition === 'front'` to correct for mirror-mode rendering. If you are using a rear camera, set `cameraPosition: 'back'` in the config.

**Engine immediately times out**
Check that `onExecuteHardwareCapture` resolves its returned `Promise`. A hanging promise blocks the engine indefinitely until the 20-second countdown expires.

**`assessQuality` always returns `{ passed: false }`**
The mock implementation fails if `imageUri` is `null`. This means `takePhoto` did not complete before `executeServerVerification` was called. Confirm `cameraHardwareRef` is correctly attached to `FaceCamera` via the `ref` prop.

**High `riskScore` on normal sessions**
Reduce `EMA_ALPHA` for stronger smoothing, or increase `TRACKING_LOSS_COOLDOWN_MS` to debounce loss events more aggressively in low-light environments.