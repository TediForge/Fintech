// Copyright (c) 2026 Tediwave, all rights reserved, subject to the proprietary license located in the root directory
import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, TextInput, Image, Platform, ImageBackground, StatusBar, Dimensions, TouchableOpacity, Pressable, Modal, Keyboard, AppState, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './loginStyles';
import { isValidPhone, handlePinAuth, fetchUserDetails, finalizeMobileLogin } from './loginActions';
import LoadingScreen from '@components/Loading/LoadingScreen';
import ForgotScreen from '@auth/recovery/ForgotScreen';
import { FaceVerificationSheet, runFaceVerificationPreflight } from '@auth/verification/face/FaceVerificationSheet';
import { emitAuthEvent, authEventNames } from '@hooks/useAuth';
import { getSessionToken, resolveSessionTokenValue, setAuthSessionToken } from '@hooks/useAuth';
import { getBiometricLoginEnabled } from '@auth/login/utilities/biometricLoginStorage';
import { authenticateBiometricLogin } from '@auth/login/utilities/biometricLogin';
import CountryOptionCard from '@dashboard/screens/giftCards/utilities/CountryOptionCard';
import { getSupportedCountries } from '@hooks/useAuth';
import { normalizePhoneNumber } from '@lib/utils/format';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import config from '@config/app';

const JoinInContent = forwardRef(({ isModal = false, onLoginSuccess, onSwitchToSignup }, ref) => {
  const autoLoginCheckInitiated = React.useRef(false);
  const forgotSheetRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showError, setShowError] = useState(false);
  
  // Custom Sheet State for Page 1
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fname, setfname] = useState('SmartFam');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState('page1');
  const [picture, setpicture] = useState({ uri: 'https://paysmart.com.ng/assets/brand-logos/bitmap.png' });
  const [isBioEnabled, setIsBioEnabled] = useState(false);
  
  // NEW: Loading state while determining if we should auto-login
  const [isCheckingAutoLogin, setIsCheckingAutoLogin] = useState(!isModal);
  const [isOpen, setIsOpen] = useState(!isModal);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [faceVerificationId, setFaceVerificationId] = useState(null);
  const onCloseCallback = useRef(null);

  useEffect(() => {
    if (isModal) {
      setIsCheckingAutoLogin(false);
      setIsOpen(false);
    }
  }, [isModal]);

  const navigation = useNavigation();
  const route = useRoute();

  const options = [
    {
      title: 'Change phone number',
      description: 'Update your registered number',
      icon: 'phone-portrait-outline',
      onPress: () => console.log('Change phone pressed'),
    },
    {
      title: 'Lock your account',
      description: 'Temporarily lock your account',
      icon: 'lock-closed-outline',
      onPress: () => console.log('Lock account pressed'),
    },
  ];

  // Country selector states and data
  const [supportedCountries, setSupportedCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState({
    isoCode: 'NG',
    name: 'Nigeria',
    dialCode: '+234',
    flagUrl: 'https://flagcdn.com/w80/ng.png',
  });
  const [countrySheetVisible, setCountrySheetVisible] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      const countries = await getSupportedCountries();
      if (!active) return;
      setSupportedCountries(countries);
      const fallbackCountry = countries.find((country) => country.isoCode === 'NG') || countries[0];
      if (fallbackCountry) {
        setSelectedCountry({
          ...fallbackCountry,
          flagUrl: fallbackCountry.flagUrl || `https://flagcdn.com/w80/${fallbackCountry.isoCode.toLowerCase()}.png`,
        });
      }
    };

    loadCountries();

    return () => {
      active = false;
    };
  }, []);

  const countries = supportedCountries;

  const open = useCallback((options = {}) => {
    if (options.onClose) {
      onCloseCallback.current = options.onClose;
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    if (typeof onCloseCallback.current === 'function') {
      onCloseCallback.current();
      onCloseCallback.current = null;
    }
  }, []);

  const navigateAfterLogin = useCallback(({ nextScreen, nextParams }) => {
    if (isModal) {
      close();
      if (nextScreen) {
        navigation.navigate(nextScreen, nextParams);
      }
      return;
    }

    if (nextScreen) {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'Dashboard' },
            { name: nextScreen, params: nextParams }
          ],
        })
      );
      return;
    }

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      })
    );
  }, [close, isModal, navigation]);

  const handleFaceVerificationComplete = useCallback(async (result) => {
    setShowFaceVerification(false);

    if (result.status === 'SUCCESS') {
      const finalized = await finalizeMobileLogin(sessionToken, faceVerificationId);
      if (!finalized?.success) {
        Alert.sheet('Login verification failed', finalized?.message || 'Please try again.');
        return;
      }

      const finalizedToken = resolveSessionTokenValue(finalized) || sessionToken;
      await AsyncStorage.setItem('lastLoginTimestamp', Date.now().toString());
      await AsyncStorage.setItem('lastLoginTimestamp', Date.now().toString());
      if (finalizedToken) {
        await AsyncStorage.setItem('sessionToken', finalizedToken);
        await setAuthSessionToken(finalizedToken);
      }
      const { nextScreen, nextParams } = route.params || {};
      navigateAfterLogin({ nextScreen, nextParams });
      return;
    }

    Alert.sheet('Face verification failed', result.reason || 'Please try again.');
  }, [faceVerificationId, navigateAfterLogin, route.params, sessionToken]);

  const handleSwitchToSignup = useCallback(() => {
    if (typeof onSwitchToSignup === 'function') {
      onSwitchToSignup();
      return;
    }

    Alert.sheet('Notice', 'Signup sheet is unavailable.');
  }, [onSwitchToSignup]);

  useImperativeHandle(ref, () => ({
    silentLogin: async (loginPhone, pinToUse) => {
      return await handlePinLogin(pinToUse, loginPhone, true);
    },
    open,
    close,
  }));

  const switchUser = async () => {
    try {
      await AsyncStorage.multiRemove(['userData', 'sessionToken', 'userPhone', 'lastLoginTimestamp']);
      setfname('SmartFam');
      setpicture({ uri: 'https://paysmart.com.ng/assets/brand-logos/bitmap.png' });
      setPassword('');
      setPhone('');
      setCurrentPage('page1');
      setIsBioEnabled(false);
    } catch (err) {
      console.log('Error during switch user:', err);
    }
  };

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // 1. Check for signup auto-login first (priority)
        const { autoLoginPhone, autoLoginPin, isNewUser } = route.params || {};
        if (autoLoginPhone && autoLoginPin) {
          // Show loading immediately for signup auto-login
          setLoadingMessage(isNewUser ? `Welcome! Automatically logging you in...` : 'Logging in...');
          setLoading(true);

          // Clear old data to ensure the new user is the only one
          await AsyncStorage.multiRemove(['userData', 'sessionToken', 'userPhone', 'lastLoginTimestamp']);
          setPhone(autoLoginPhone);
          handlePinLogin(autoLoginPin, autoLoginPhone);
          return; // Exit early as we are handling the fresh login
        }

        // 2. Check for existing saved user
        const saved = await AsyncStorage.getItem('userData');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.phone) {
            // IMMEDIATELY switch to page 2 with existing data
            setPhone(parsed.phone);
            setfname(parsed.fname || 'SmartFam');
            if (parsed.image) setpicture({ uri: parsed.image });
            setCurrentPage('page2');

            // Check biometric status for this phone
            const enabled = await getBiometricLoginEnabled(parsed.phone);
            setIsBioEnabled(enabled);

            // 3. Update fresh details in the background WITHOUT delaying the UI
            fetchUserDetails(parsed.phone).then(async (response) => {
              if (response.success && response.data) {
                const freshData = {
                  phone: parsed.phone,
                  fname: response.data.fname,
                  image: response.data.image
                };
                await AsyncStorage.setItem('userData', JSON.stringify(freshData));
                setfname(response.data.fname || 'SmartFam');
                if (response.data.image) setpicture({ uri: response.data.image });
              }
            }).catch(err => console.log('Background update error:', err));
          }
        }
      } catch (err) {
        console.log('Initialization error:', err);
      }
    };
    initializeUser();
  }, [route.params]);

  useEffect(() => {
    if (password.length === 6) {
      handlePinLogin(); 
    }
  }, [password]);

const checkAutoLogin = useCallback(async () => {
    console.log('[LoginSheet] checkAutoLogin started', { isModal, routeName: route.name });

    // Show loading screen while checking session
    setIsCheckingAutoLogin(true);

    try {
      const storedToken = await getSessionToken();
      const lastLogin = await AsyncStorage.getItem('lastLoginTimestamp');
      
      if (storedToken && lastLogin) {
        const currentTime = Date.now();
        const sessionAgeInMinutes = (currentTime - parseInt(lastLogin)) / (1000 * 60);
        
        // 1. Check local timing first
        if (sessionAgeInMinutes < 60) {
          // 2. STRICT CHECK: Verify token with backend before jumping to Dashboard
          try {
            const res = await fetch('https://api.paysmart.com.ng/v1/auth/session/orchestrator', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [config.sessionToken]: storedToken }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
              await AsyncStorage.setItem('lastLoginTimestamp', currentTime.toString());
              const { nextScreen, nextParams } = route.params || {};
              navigateAfterLogin({ nextScreen, nextParams });
              return; // Exit — success
            } else {
              // Server says session is invalid or returned an error status code, clear everything
              console.log("Auto-login failed: Session invalid on server", data.message || "");
              await AsyncStorage.multiRemove(['sessionToken', 'lastLoginTimestamp']);
            }
          } catch (apiError) {
            console.log("Auto-login network check failed, skipping auto-entry", apiError);
          }
        } else {
          // Local session expired
          await AsyncStorage.multiRemove(['sessionToken', 'lastLoginTimestamp']);
        }
      }
    } catch (error) {
      console.error("Auto-login error:", error);
    } finally {
      console.log('[LoginSheet] checkAutoLogin finished', { isModal, isCheckingAutoLogin: false });
      // Always hide loading when done checking
      setIsCheckingAutoLogin(false);
    }
  }, [navigation, route.params]);

  useEffect(() => {
    if (!isModal && !autoLoginCheckInitiated.current) {
      console.log('[LoginSheet] running auto-login check for non-modal sheet');
      autoLoginCheckInitiated.current = true;
      checkAutoLogin();
    } else if (isModal) {
      console.log('[LoginSheet] skipped auto-login check for modal sheet');
    }
  }, [isModal, checkAutoLogin]);

  async function registerForPushNotificationsAsync() {
    let token;
    try {
      const cachedToken = await AsyncStorage.getItem('@cachedExpoPushToken');
      if (cachedToken) {
        return cachedToken;
      }

      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return '';
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (token) {
          await AsyncStorage.setItem('@cachedExpoPushToken', token);
        }
      }
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    } catch (error) {
      console.log('Error: Fetching the token failed:', error);
      token = '';
    }
    return token;
  }

  const handlePinLogin = async (inputPassword, overridePhone, isSilent = false, isBiometricHash = false) => {
    let loginPhone = overridePhone || phone;
    const pinToUse = inputPassword || password;
    const isHashCredential = typeof pinToUse === 'string' && pinToUse.startsWith('$2y$');

    if (!pinToUse || (!isHashCredential && pinToUse.length < 6)) {
      return { success: false, message: 'Invalid PIN or biometric credential' };
    }

    if (!loginPhone) {
      return { success: false, message: 'Phone number is required.' };
    }

    if (!loginPhone.startsWith('+')) {
      try {
        loginPhone = await normalizePhoneNumber(loginPhone, selectedCountry, countries);
      } catch (error) {
        if (!isSilent) Alert.sheet('Error', error.message || 'Enter a valid phone number');
        return { success: false, message: error.message || 'Invalid phone number' };
      }
    }

    if (!isSilent) setLoading(true);
    try {
      let device_name = await AsyncStorage.getItem('@cachedDeviceName');
      let device_os = await AsyncStorage.getItem('@cachedDeviceOs');

      if (!device_name) {
        device_name = Device.deviceName || 'Unknown Device';
        await AsyncStorage.setItem('@cachedDeviceName', device_name);
      }
      if (!device_os) {
        device_os = Platform.OS + ' ' + Platform.Version;
        await AsyncStorage.setItem('@cachedDeviceOs', device_os);
      }

      const expo_push_token = await registerForPushNotificationsAsync();
      const response = await handlePinAuth(loginPhone, pinToUse, device_name, device_os, expo_push_token);

      if (response.success) {
        const resolvedToken = resolveSessionTokenValue(response);
        if (!isBiometricHash) {
          await AsyncStorage.setItem('@last_logged_in_pin', pinToUse);
        }
        const freshUserData = {
          phone: loginPhone,
          fname: response.fname,
          image: response.image,
        };

        const requiresFaceVerification = response.twoFactorRequired === true || response.two_factor_required === true;
        if (requiresFaceVerification) {
          if (resolvedToken) {
            await AsyncStorage.multiSet([
              ['sessionToken', resolvedToken],
              ['userPhone', loginPhone],
              ['userData', JSON.stringify(freshUserData)]
            ]);
          } else {
            await AsyncStorage.multiRemove(['sessionToken', 'userPhone', 'userData']);
          }
          setSessionToken(resolvedToken || null);
          await setAuthSessionToken(resolvedToken || null);
          setFaceVerificationId(response.faceVerificationId || response.data?.faceVerificationId || null);

          if (!isSilent) {
            const preflightResult = await runFaceVerificationPreflight();
            if (preflightResult.ok) {
              setShowFaceVerification(true);
            } else {
              const { nextScreen, nextParams } = route.params || {};
              navigateAfterLogin({ nextScreen, nextParams });
            }
          }
          return { success: true, two_factor: true };
        }

        if (resolvedToken) {
          await AsyncStorage.multiSet([
            ['sessionToken', resolvedToken],
            ['lastLoginTimestamp', Date.now().toString()],
            ['userPhone', loginPhone],
            ['userData', JSON.stringify(freshUserData)]
          ]);
        } else {
          await AsyncStorage.multiRemove(['sessionToken', 'lastLoginTimestamp', 'userPhone', 'userData']);
        }
        setSessionToken(resolvedToken || null);
        await setAuthSessionToken(resolvedToken || null);
        setFaceVerificationId(null);

        await AsyncStorage.setItem('@last_logged_in_phone', loginPhone);

        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(response);
        }

        if (!isSilent) {
          const { nextScreen, nextParams } = route.params || {};
          navigateAfterLogin({ nextScreen, nextParams });
        }
        return { success: true };
      }
      if (!isSilent) Alert.sheet('Error', response.message || 'An unexpected error occurred.');
      return { success: false, message: response.message };
    } catch (error) {
      console.error("Login Error:", error);
      if (!isSilent) Alert.sheet('Error', 'Something went wrong. Please try again.');
      return { success: false, message: 'Network error' };
    } finally {
      if (!isSilent) {
        setLoading(false);
        setLoadingMessage('');
        setPassword('');
      }
    }
  };

  const handleBiometricLogin = async () => {
    setLoadingMessage('Signing in with biometrics...');
    setLoading(true);
    try {
      const { success, saved, error } = await authenticateBiometricLogin();
      if (!success) {
        return Alert.sheet('Biometric Login', error || 'Biometric authentication failed.');
      }

      const fallbackPhone = await AsyncStorage.getItem('@last_logged_in_phone');
      const loginPassword = saved?.password_hash || saved?.password || saved?.pin || saved?.passcode || null;
      const loginPhone = saved?.phone_number || saved?.phone || saved?.phoneNumber || saved?.userPhone || fallbackPhone || null;
      const isBiometricHash = Boolean(saved?.password_hash);

      console.log('[LoginSheet] biometric login resolution', {
        fallbackPhone,
        loginPhone,
        loginPasswordType: isBiometricHash ? 'password_hash' : 'pin',
        passwordPresent: Boolean(loginPassword),
        savedKeys: saved && typeof saved === 'object' ? Object.keys(saved) : [],
      });

      if (!loginPassword || !loginPhone) {
        return Alert.sheet('Biometric Login', 'Stored biometric credentials are invalid.');
      }

      const loginResult = await handlePinLogin(loginPassword, loginPhone, false, isBiometricHash);
      if (!loginResult.success) {
        Alert.sheet('Biometric Login', loginResult.message || 'Biometric login failed.');
        return;
      }

      close();
    } catch (err) {
      console.error(err);
      Alert.sheet('Error', 'An error occurred during biometric login.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleContinue = async () => {
    setLoadingMessage('Checking user...');
    setLoading(true);
    let loginPhone;

    try {
      loginPhone = await normalizePhoneNumber(phone, selectedCountry, countries);
    } catch (error) {
      setLoading(false);
      setLoadingMessage('');
      setShowError(true);
      return Alert.sheet('Error', error.message || 'Enter a valid phone number');
    }

    try {
      const response = await fetchUserDetails(loginPhone);
      if (response.success && response.data) {
        const { fname, image } = response.data;
        await AsyncStorage.setItem('userData', JSON.stringify({ phone: loginPhone, fname, image }));
        setfname(fname || 'SmartFam');
        if (image) setpicture({ uri: image });
        
        const enabled = await getBiometricLoginEnabled(loginPhone);
        setIsBioEnabled(enabled);
        setCurrentPage('page2');
      } else {
        Alert.sheet('Error', response.message || 'Could not fetch user data');
      }
    } catch (err) { 
      setLoading(false);
      Alert.sheet('Error', 'Something went wrong');
    }
    finally { setLoading(false); setLoadingMessage(''); }
  };

  const handleKeyPress = (value) => {
    if (password.length < 6) setPassword((prev) => prev + value);
  };

  const handleBackspace = () => {
    setPassword((prev) => prev.slice(0, -1));
  };

  useEffect(() => {
    const resetLastTab = async () => {
      try {
        await AsyncStorage.setItem('lastTabWithTime', JSON.stringify({ tab: 'Home', timestamp: 0 }));
      } catch (err) { console.log('Failed to reset last tab:', err); }
    };
    resetLastTab();
  }, []);

  // Show loading screen while checking auto-login / session validity
  if (isCheckingAutoLogin) {
    return <LoadingScreen visible={true} message="Checking session.." />;
  }

  const sheetContent = (
    <>
      <FaceVerificationSheet
        isVisible={showFaceVerification}
        sessionId={sessionToken}
        faceVerificationId={faceVerificationId}
        riskLevel="MEDIUM"
        onVerificationComplete={handleFaceVerificationComplete}
      />
      <StatusBar barStyle="light-content" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ImageBackground source={{ uri: 'https://paysmart.com.ng//assets/brand-logos/adaptive-background.png' }} style={styles.container}>
          
          <View style={styles.container2}>
            <View style={styles.container2a}>
              <View style={styles.container2a2}>
                <View style={styles.container2a3}>
                  <Text style={styles.greetingText}>Hello There</Text>
                  <Text style={styles.greetingText2}>{fname}</Text>
                </View>
                <View style={styles.pictureWrapper}>
                  {picture ? (
                    <Image
                      source={typeof picture === 'string' ? { uri: picture } : picture}
                      style={styles.imageStyle}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              </View>

              <View style={styles.container2a1}>
                <TouchableOpacity style={styles.container2a12}>
                  <Text style={styles.buttonText1}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.container2a13} onPress={handleSwitchToSignup}>
                  <Text style={styles.buttonText2}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.container3}>
            {currentPage === 'page1' && (
              <>
                <View style={styles.phoneSection}>
                  <View style={styles.phoneHeader}>
                   <Text style={styles.phoneHeadingText}>Log in to your account</Text>
                   <Text style={styles.phoneSubHeadingText}>Enter your phone number to continue</Text>
                  </View>

                  <View style={styles.countryPhoneRow}>
                    <TouchableOpacity 
                      style={styles.countrySelector}
                      onPress={() => setCountrySheetVisible(true)}
                    >
                      <Image source={{ uri: selectedCountry.flagUrl }} style={styles.flag} />
                      <Text style={styles.prefix}>{selectedCountry.dialCode}</Text>
                      <Ionicons name="chevron-down" size={16} color="#64748B" style={styles.chevron} />
                    </TouchableOpacity>

                    <View style={styles.phoneInputWrapper}>
                      <TextInput
                        style={styles.phoneInput}
                        placeholder="Phone number"
                        keyboardType="number-pad"
                        value={phone}
                        onChangeText={(text) => setPhone(text)}
                        maxLength={11}
                        onFocus={() => { setIsFocused(true); setShowError(false); }}
                        onBlur={() => { setIsFocused(false); if (!isValidPhone(phone)) setShowError(true); }}
                      />
                    </View>
                  </View>

                  {showError && <Text style={[styles.errorText, { marginLeft: 10, marginTop: 4 }]}>Please enter a valid phone number</Text>}
                </View>

                <View style={styles.loginButtonWrapper}>
                  <TouchableOpacity
                    style={[styles.loginButton, { opacity: isValidPhone(phone) ? 1 : 0.4 }]}
                    disabled={!isValidPhone(phone)}
                    onPress={handleContinue}
                  >
                    <Text style={styles.loginButtonText}>Verify Number</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {currentPage === 'page2' && (
              <View style={styles.page2Wrapper}>
                <View style={styles.pinArea}>
                  <Text style={styles.pinInstruction}>Enter your 6-digit passcode</Text>
                  <View style={styles.pinDotsWrapper}>
                    {[...Array(6)].map((_, index) => (
                      <View key={index} style={[styles.pinDot, index < password.length && styles.pinDotActive]} />
                    ))}
                  </View>
                </View>

                <View style={styles.keypadArea}>
                  <View style={styles.keypad}>
                    {[
                      ['1', '2', '3'],
                      ['4', '5', '6'],
                      ['7', '8', '9'],
                      ['biometric', '0', 'backspace'],
                    ].map((row, rowIndex) => (
                      <View key={rowIndex} style={styles.keypadRow}>
                        {row.map((item, i) => (
                          <TouchableOpacity 
                            key={i} 
                            style={[
                                styles.key, 
                                (item === 'biometric' || item === 'backspace') && styles.keySpecial,
                                (item === 'biometric' && !isBioEnabled) && { opacity: 0 }
                            ]} 
                            disabled={item === 'biometric' && !isBioEnabled}
                            onPress={() => {
                                if (item === 'biometric') handleBiometricLogin();
                                else if (item === 'backspace') handleBackspace();
                                else handleKeyPress(item);
                            }}>
                            {item === 'biometric' ? (
                                isBioEnabled ? (
                                  <Ionicons 
                                    name={Platform.OS === 'ios' ? "ios-faceid" : "finger-print-outline"} 
                                    size={30} 
                                    color="#091747" 
                                  />
                                ) : null
                            ) : item === 'backspace' ? (
                                <Ionicons name="backspace-outline" size={26} color="#091747" />
                            ) : (
                                <Text style={styles.keyText}>{item}</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </View>
                  
                  <View style={styles.footerLinksRow}>
                    <TouchableOpacity onPress={() => forgotSheetRef.current?.open?.()}>
                      <Text style={styles.footerLinkText}>Forgot passcode</Text>
                    </TouchableOpacity>
                    <View style={styles.footerSeparator} />
                    <TouchableOpacity onPress={switchUser}>
                      <Text style={styles.footerLinkText}>Switch account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>

          {moreOptionsVisible && (
            <Pressable 
              style={styles.sheetOverlay} 
              onPress={() => setMoreOptionsVisible(false)}
            >
              <TouchableWithoutFeedback>
                <View style={styles.sheetContainer}>
                  <View style={styles.dragLine} />
                  <View style={styles.content}>
                    <Text style={styles.sheetHeader}>Account Options</Text>
                    <View style={styles.buttonsContainer}>
                      {options.map((opt, idx) => (
                        <TouchableOpacity key={idx} style={styles.sheetOptionWrapper} onPress={() => { setMoreOptionsVisible(false); opt.onPress?.(); }}>
                          <View style={styles.iconsContainer}>
                             <Ionicons name={opt.icon} size={20} color="#0E3C2E" />
                          </View>
                          <View style={styles.optionTextWrapper}>
                            <Text style={styles.optionTitle}>{opt.title}</Text>
                            <Text style={styles.optionDescription}>{opt.description}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#DDD" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Pressable>
          )}

          {countrySheetVisible && (
            <Pressable 
              style={styles.sheetOverlay} 
              onPress={() => setCountrySheetVisible(false)}
            >
              <TouchableWithoutFeedback>
                <View style={styles.sheetContainer}>
                  <View style={styles.dragLine} />
                  <View style={styles.content}>
                    <Text style={styles.sheetHeader}>Select Country</Text>
                    <View style={styles.buttonsContainer}>
                      {countries.map((country) => (
                        <CountryOptionCard
                          key={country.isoCode}
                          item={country}
                          titleKey="name"
                          subtitleKey="dialCode"
                          imageKey="flagUrl"
                          onPress={() => {
                            setSelectedCountry(country);
                            setCountrySheetVisible(false);
                          }}
                          showRadio={false}
                          containerStyle={styles.countryOptionCard}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Pressable>
          )}
        </ImageBackground>
      </TouchableWithoutFeedback>

      <LoadingScreen visible={loading} message={loadingMessage} />
      <ForgotScreen.Internal ref={forgotSheetRef} isModal={true} />
    </>
  );

  if (isModal) {
    return (
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        {sheetContent}
      </Modal>
    );
  }

  return sheetContent;
});

const LoginSheet = (props) => <JoinInContent {...props} />;
LoginSheet.Internal = JoinInContent;

export default LoginSheet;