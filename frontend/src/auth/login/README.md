# LoginSheet Component

The `LoginSheet` component is a full-screen bottom sheet login interface that handles user authentication with multi-page PIN-based login flow.

## Overview

- **Component**: `LoginSheet` (default export)
- **Internal Ref**: `LoginSheet.Internal` - forwardRef wrapper for imperative control
- **Location**: `src/auth/login/LoginSheet.js`
- **Style**: Uses `loginStyles.js`
- **Actions**: Imports login logic from `loginActions.js`

## Features

- **Page 1**: Phone number verification with country selection
- **Page 2**: 6-digit PIN entry with biometric support (Face ID/Fingerprint)
- **Auto-login**: Session token validation on app startup
- **Compliance Check**: Post-login compliance verification
- **Biometric Support**: Optional Face ID (iOS) or Fingerprint (Android) authentication
- **Account Switching**: Switch between multiple logged-in users
- **Bottom Sheet**: Full-screen animated bottom sheet with drag-to-dismiss

## Usage

### As a Bottom Sheet

Use the `.Internal` property with a ref to open the login sheet from another sheet or component:

```jsx
import { useRef } from 'react';
import LoginSheet from '@auth/login/LoginSheet';

function DashboardScreen() {
  const loginSheetRef = useRef(null);

  const handleOpenLogin = () => {
    loginSheetRef.current?.open?.();
  };

  return (
    <View>
      <TouchableOpacity onPress={handleOpenLogin}>
        <Text>Open Login Sheet</Text>
      </TouchableOpacity>

      {/* Mount the internal component */}
      <View style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <LoginSheet.Internal ref={loginSheetRef} />
      </View>
    </View>
  );
}
```

### Silent Login (For Signup Auto-Login)

Trigger automatic login after signup without user interaction:

```jsx
const loginResult = await loginSheetRef.current?.silentLogin?.(phoneNumber, pin);
if (loginResult.success) {
  // User is logged in
}
```

## Props & Ref Methods

### Default Component Props
```jsx
<LoginSheet />
```
- Standard React Native screen props
- Receives navigation and route from React Navigation

### Internal Ref Methods
```jsx
loginSheetRef.current.open({ onClose: callback })
```
- `open(options)` - Open the login sheet
  - `options.onClose()` - Callback when sheet is dismissed
  
- `silentLogin(phone, pin)` - Perform silent login
  - Returns `{ success: boolean, two_factor?: boolean, message?: string }`

## State Management

The component manages the following internal state:

- `phone` - User's phone number
- `password` - 6-digit PIN
- `currentPage` - Navigation between page1 (phone) and page2 (PIN)
- `isBioEnabled` - Biometric authentication availability
- `loading` - Loading state during API calls
- `selectedCountry` - Selected country code for phone number

## Storage

Uses AsyncStorage for persistence:

- `userData` - Cached user details (phone, fname, image)
- `sessionToken` - Active session token
- `lastLoginTimestamp` - Last login time for auto-login
- `userPhone` - Last logged-in phone number
- `@last_logged_in_phone` - For biometric lookup
- `@biometric_enabled_{phone}` - Biometric flag per phone
- `@paysmart_biometric_data_{phone}` - Encrypted biometric data
- `@cachedDeviceName` - Device name
- `@cachedDeviceOs` - Device OS info
- `@cachedExpoPushToken` - Push notification token

## Navigation Behavior

### Auto-Login on App Start
If a valid session token exists and is < 60 minutes old:
1. Verify token with backend
2. Jump directly to Dashboard
3. Navigate to specified nextScreen if provided in route params

### Post-Login Navigation
After successful login:
1. Run compliance check
2. If failed: Reset to WelcomeAnimation
3. If passed: Navigate to Dashboard or specified nextScreen

### 2FA Flow
If 2FA is required:
- Store session token temporarily
- Navigate to LivenessPage (if liveness check is enabled)
- Otherwise go directly to Dashboard

## Error Handling

- Phone validation (valid 10-11 digit number)
- PIN validation (exactly 6 digits)
- Network errors with user alerts
- Biometric authentication errors
- Session/compliance verification failures

## Styling

All styles are defined in `loginStyles.js`:
- Dark mode compatible color guide in `../theme/darkModeColorGuide.md`
- Responsive design with scale calculations
- Themed using brand colors (BRAND_DARK, TEXT_MUTED, etc.)

## Related Files

- `loginActions.js` - API calls and authentication logic
- `loginStyles.js` - All component styling
- `../theme/darkModeColorGuide.md` - Color scheme documentation
