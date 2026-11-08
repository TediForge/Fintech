import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  Image,
  StatusBar,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  Platform,
  SafeAreaView,
  FlatList,
  Animated,
  Dimensions,
  StyleSheet,
  Modal,
  PanResponder,
  TextInput,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkEmailReferral, submitSignUp } from './SignUpActions';
import { normalizePhoneNumber } from '@lib/utils/format';
import LoadingScreen from '@components/Loading/LoadingScreen';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from 'expo-notifications';
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';
import CountryOptionCard from '@dashboard/screens/giftCards/utilities/CountryOptionCard';
import { getSupportedCountries } from '@hooks/useAuth';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');
const scale = SCREEN_WIDTH / 410;
const BRAND_DARK = "#0E3C2E";
const TEXT_MUTED = "#666666";
const BORDER_COLOR = "#E0E0E0";
const PageOneForm = ({
  formData,
  focusedInput,
  setFocusedInput,
  errors,
  handleChange,
  showReferralInput,
  setShowReferralInput,
  setShowCountryModal,
}) => {
  const renderInput = (
    fieldKey,
    placeholder,
    value,
    keyboardType = 'default',
    iconUrl = null,
    secureTextEntry = false,
    maxLength = null,
    editable = true
  ) => {
    const isFocused = focusedInput === fieldKey;
    const hasError = !!errors[fieldKey];
   
    return (
      <View style={styles.inputContainer}>
        <View style={styles.labelArea}>
          <Text style={[
            styles.inputLabel,
            isFocused && { color: '#2FB86D' },
            hasError && { color: '#E74C3C' }
          ]}>
         
          {placeholder}
          </Text>
        </View>
        <View style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          !editable && styles.inputDisabled
        ]}>
          {iconUrl && (

          <View style={styles.iconWrapper}>
              <Image source={{ uri: iconUrl }} style={styles.inputIcon} />
            </View>
          )}
          <TextInput
            style={styles.textInput}
            placeholder={placeholder}
            value={value
 ? String(value) : ''}
            onChangeText={text => handleChange(fieldKey, text)}
            onFocus={() => setFocusedInput(fieldKey)}
            onBlur={() => setFocusedInput(null)}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            maxLength={maxLength}
            placeholderTextColor="#999999"
     
       editable={editable}
          />
        </View>
        {hasError && <Text style={styles.errorMessage}>{errors[fieldKey]}</Text>}
      </View>
    );
};
  const renderGenderRow = () => {
    const genders = ['Male', 'Female'];
    const hasError = !!errors.gender;
    return (
      <View style={styles.inputContainer}>
        <View style={styles.labelArea}>
          <Text style={[styles.inputLabel, hasError && { color: '#E74C3C' }]}>Gender</Text>
        </View>
        <View style={styles.genderRow}>
          {genders.map((item) => {
            const isActive = formData.gender === item;
            return (
      
        <TouchableOpacity
                key={item}
                style={[
                  styles.genderButton,
                  isActive && styles.genderButtonActive,
                  hasError && styles.inputError
  
              ]}
                onPress={() => handleChange('gender', item)}
                activeOpacity={0.7}
              >
                <View style={[styles.genderCircle, isActive && styles.genderCircleActive]}>
                 
 {isActive && <View style={styles.genderCircleInner} />}
                </View>
                <Text style={[styles.genderText, isActive && styles.genderTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
 })}
        </View>
        {hasError && <Text style={styles.errorMessage}>{errors.gender}</Text>}
      </View>
    );
};
  const renderCountryPicker = () => {
    const hasError = !!errors.country;
    return (
      <View style={styles.inputContainer}>
        <View style={styles.labelArea}>
          <Text style={[styles.inputLabel, hasError && { color: '#E74C3C' }]}>Country</Text>
        </View>
        <TouchableOpacity
          style={[styles.inputWrapper, hasError && styles.inputError]}
          onPress={() => setShowCountryModal(true)}
          activeOpacity={0.7}
        >
     
     <View style={styles.iconWrapper}>
            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/2991/2991165.png' }} style={styles.inputIcon} />
          </View>
          <Text style={styles.textInput}>{formData.country || "Select Country"}</Text>
          <Ionicons name="chevron-down" size={18} color="#999999" style={styles.trailingIcon} />
        </TouchableOpacity>
        {hasError && <Text style={styles.errorMessage}>{errors.country}</Text>}
      </View>
    );
};
  return (
    <View style={styles.formContainer}>
      {renderInput("email", "Email Address", formData.email, 'email-address', 'https://cdn-icons-png.flaticon.com/128/5068/5068681.png')}
      {renderInput("phone", "Phone Number", formData.phone, 'number-pad', 'https://cdn-icons-png.flaticon.com/128/5070/5070407.png', false, 11)}
      {renderGenderRow()}
      {renderCountryPicker()}
     
      {!showReferralInput ? (
        <TouchableOpacity
          style={styles.referralToggle}
          onPress={() => setShowReferralInput(true)}
          activeOpacity={0.7}
 
       >
          <Text style={styles.referralToggleText}>Have an invitation code?</Text>
        </TouchableOpacity>
      ) : (
        renderInput("referral", "Invitation Code", formData.referral, 'default', 'https://cdn-icons-png.flaticon.com/128/7653/7653193.png')
      )}
    </View>
  );
};
const PageTwoForm = ({ formData, activePasscodeField, errors }) => {
  const renderDots = (fieldKey, label) => {
    const value = formData[fieldKey] ||
'';
    const isActive = activePasscodeField === fieldKey;
    const hasError = !!errors[fieldKey];
    return (
      <View style={styles.dotSection}>
        <Text style={[
          styles.dotLabel,
          isActive && styles.dotLabelActive,
          hasError && { color: '#E74C3C' }
        ]}>
          {label}
        </Text>
        <View style={styles.dotContainer}>
        
  {[...Array(6)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < value.length && styles.dotFilled,
               
 hasError && styles.dotError
              ]}
            />
          ))}
        </View>
        {hasError && <Text style={styles.errorMessage}>{errors[fieldKey]}</Text>}
      </View>
    );
};
  return (
    <View style={styles.formContainerPasscode}>
      {renderDots('password', 'Set your 6-digit Login PIN')}
      {activePasscodeField === 'confirmPassword' && renderDots('confirmPassword', 'Confirm your Login PIN')}
    </View>
  );
};
const SignupSheet = forwardRef(({ onComplete, isModal = false, onSwitchToLogin }, ref) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState('page1');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    referral: '',
    password: '',
    confirmPassword: '',
    device_name: '',
    device_os: '',
    expo_push_token: '',
    gender: '',
    country: 'Nigeria',
    countryCode: 'NG',
    onboardingId: '',
  });
  const [focusedInput, setFocusedInput] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading]
 = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activePasscodeField, setActivePasscodeField] = useState('password');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [visible, setVisible] = useState(false);
  const [onCloseCallback, setOnCloseCallback] = useState(null);
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState({
    isoCode: 'NG',
    name: 'Nigeria',
    dialCode: '+234',
    flagUrl: 'https://flagcdn.com/w80/ng.png',
  });
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
 
  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      const fetchedCountries = await getSupportedCountries();
      if (!active) return;
      setCountries(fetchedCountries);
      const fallbackCountry = fetchedCountries.find((country) => country.isoCode === 'NG') || fetchedCountries[0];
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
  const handleChange = (field, value) => {
    if (field === 'password' || field === 'confirmPassword' || field === 'phone') {
      const numericValue = value.replace(/[^0-9]/g, '');
 setFormData(prev => ({ ...prev, [field]: numericValue }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
 }
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
 }
  };
  const requiredFields = {
    page1: ['phone', 'email', 'gender', 'country'],
    page2: ['password', 'confirmPassword'],
  };
  const getDeviceMetadata = async () => {
    try {
       let cachedDeviceName = await AsyncStorage.getItem('@cachedDeviceName');
     let cachedDeviceOs = await AsyncStorage.getItem('@cachedDeviceOs');
       let cachedPushToken = await AsyncStorage.getItem('@cachedExpoPushToken');
 if (!cachedDeviceName) {
        cachedDeviceName = Device.deviceName || Device.modelName || "Unknown Device";
 await AsyncStorage.setItem('@cachedDeviceName', cachedDeviceName);
      }
      if (!cachedDeviceOs) {
        cachedDeviceOs = `${Platform.OS} ${Platform.Version}`;
 await AsyncStorage.setItem('@cachedDeviceOs', cachedDeviceOs);
      }
      if (!cachedPushToken) {
        if (Device.isDevice) {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
 let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
 finalStatus = status;
          }
          if (finalStatus === 'granted') {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            cachedPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            if (cachedPushToken) {
              await AsyncStorage.setItem('@cachedExpoPushToken', cachedPushToken);
            }
          }
        }
      }
      setFormData(prev => ({
        ...prev,
        device_name: cachedDeviceName || '',
        device_os: cachedDeviceOs || '',
        expo_push_token: cachedPushToken || '',
      }));
 } catch (error) {
      console.error("Error extracting device metadata:", error);
    }
  };
  useEffect(() => {
    getDeviceMetadata();
  }, []);
  const isPageValid = useCallback(() => {
    const fields = requiredFields[currentPage];
    if (!fields) return true;
    return fields.every(field => {
      if (field === 'phone') {
        const p = formData.phone || '';
        return p.startsWith('0') ? p.length === 11 : p.length === 10;
      }
      if (field === 'password') return formData.password.length === 6 && /^\d+$/.test(formData.password);
      if (field === 'confirmPassword') return formData.confirmPassword.length ===
 6 && formData.password === formData.confirmPassword;
      const value = formData[field];
      return value !== undefined && value !== null && String(value).trim() !== '';
    });
  }, [currentPage, formData]);
  const validateAndSetErrors = (page) => {
    const fields = requiredFields[page];
    let newErrors = {};
 let isValid = true;
    if (!fields) return true;
    fields.forEach(field => {
      let error = null;
      if (!formData[field] || String(formData[field]).trim() === '') {
        error = `${field.charAt(0).toUpperCase() + field.slice(1)} is required.`;
      }
      else if (field === 'phone') {
        const p = formData.phone || '';
        const validPhoneLength = (p.startsWith('0') && p.length === 11) || (!p.startsWith('0') && p.length === 10);
   
     if (!validPhoneLength) {
          error = 'Enter a valid 10 or 11-digit phone number.';
        }
      } else if (field === 'password') {
        if (formData.password.length !== 6) {
          error = 'Password must be 6 digits.';
        } else if (!/^\d+$/.test(formData.password)) {
          error = 'Password must contain only numbers.';
        }
      }
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });
 setErrors(newErrors);
    return isValid;
  };
  const handleContinue = async () => {
    Keyboard.dismiss();
    if (loading) return;
 if (currentPage === 'page2' && activePasscodeField === 'password') {
      if (formData.password.length === 6) {
        setActivePasscodeField('confirmPassword');
 } else {
        setErrors({ password: 'Password must be 6 digits.' });
 }
      return;
    }
    if (!validateAndSetErrors(currentPage)) {
      Alert.sheet('Notice', 'Please fill in the required fields correctly.');
 return;
    }
    setErrors({});
    try {
      switch (currentPage) {
        case 'page1':
          setLoadingMessage('Please Wait..');
          setLoading(true);

          let normalizedPhone1;
          try {
            normalizedPhone1 = await normalizePhoneNumber(formData.phone, selectedCountry, countries);
          } catch (error) {
            setLoading(false);
            setErrors({ phone: error.message || 'Enter a valid phone number.' });
            return Alert.sheet('Notice', error.message || 'Enter a valid phone number.');
          }

          const contactCheck = await checkEmailReferral(
            formData.email,
            formData.referral,
            normalizedPhone1,
            formData.countryCode || selectedCountry.isoCode
          );
          setLoading(false);
          if (!contactCheck.success) {
            const lowerMsg = contactCheck.message.toLowerCase();
 if (lowerMsg.includes('email')) {
              setErrors({ email: contactCheck.message });
 } else if (lowerMsg.includes('phone')) {
              setErrors({ phone: contactCheck.message });
 } else if (lowerMsg.includes('referral') || lowerMsg.includes('invitation')) {
              setErrors({ referral: contactCheck.message });
 }
            return Alert.sheet('Notice', contactCheck.message);
 }
          if (!contactCheck.onboardingId) {
            setLoading(false);
            return Alert.sheet('Notice', 'Unable to start registration. Please try again.');
          }
          setFormData((prev) => ({ ...prev, onboardingId: contactCheck.onboardingId }));
          setCurrentPage('page2');
          setActivePasscodeField('password');
          break;
 case 'page2':
          if (formData.password !== formData.confirmPassword) {
            return Alert.sheet('Notice', 'Passwords do not match');
          }
          setLoadingMessage('Please Wait..');
          setLoading(true);

          let normalizedPhone2;
          try {
            normalizedPhone2 = await normalizePhoneNumber(formData.phone, selectedCountry, countries);
          } catch (error) {
            setLoading(false);
            setErrors({ phone: error.message || 'Enter a valid phone number.' });
            return Alert.sheet('Notice', error.message || 'Enter a valid phone number.');
          }
          const submitPayload = {
            ...formData,
            phone: normalizedPhone2,
            countryCode: formData.countryCode || selectedCountry.isoCode,
          };
          console.log('[SignupSheet] submitting onboarding step 2', {
            onboardingIdPresent: Boolean(submitPayload.onboardingId),
            passwordPresent: Boolean(submitPayload.password),
            confirmPasswordMatches: submitPayload.password === submitPayload.confirmPassword,
          });
          const submitResult = await submitSignUp(submitPayload);
          const signupSucceeded = submitResult?.success === true;
          console.log('[SignupSheet] onboarding step 2 result', {
            success: signupSucceeded,
            message: submitResult?.message,
            sessionTokenPresent: Boolean(submitResult?.sessionToken || submitResult?.[config.sessionToken]),
          });

          if (signupSucceeded) {
            console.log('[SignupSheet] signup succeeded, storing session and navigating');
            setLoading(false);
            setLoadingMessage('');
            const createdToken = submitResult.sessionToken || submitResult[config.sessionToken];
            try {
              if (createdToken) {
                console.log('[SignupSheet] storing authenticated signup session');
                await AsyncStorage.multiSet([
                  ['sessionToken', createdToken],
                  ['lastLoginTimestamp', Date.now().toString()],
                  ['userPhone', normalizedPhone2],
                  ['userData', JSON.stringify({ phone: normalizedPhone2 })],
                ]);
              }
            } catch (storageError) {
              console.error('[SignupSheet] session storage failed after successful signup', {
                name: storageError?.name,
                message: storageError?.message,
              });
            }
            try {
              console.log('[SignupSheet] dispatching Dashboard reset');
              navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Dashboard' }] }));
              console.log('[SignupSheet] Dashboard reset dispatched');
            } catch (navigationError) {
              console.error('[SignupSheet] navigation failed after successful signup', {
                name: navigationError?.name,
                message: navigationError?.message,
              });
              handleDismiss();
              onComplete?.(submitResult);
            }
            return;
          } else {
            setLoading(false);
            const returnToLogin = () => {
              handleDismiss();
              if (onSwitchToLogin) {
                setTimeout(() => onSwitchToLogin({ autoLoginPhone: normalizedPhone2 }), 250);
              } else {
                Alert.sheet('Notice', 'Login sheet is unavailable.');
              }
            };
            Alert.sheet(
              'Notice',
              submitResult.message || 'Auto-login failed. Please sign in manually.',
              [{ text: 'Sign in', onPress: returnToLogin }],
              { cancelable: false }
            );
          }
          break;
 default:
          break;
 }
    } catch (err) {
      setLoading(false);
      setLoadingMessage('');
      console.error('[SignupSheet] signup flow failed', {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      });
      Alert.sheet('Notice', err?.message || 'Something went wrong. Please try again.');
    }
  };
  const handleBack = () => {
    if (currentPage === 'page2' && activePasscodeField === 'confirmPassword') {
      setActivePasscodeField('password');
 setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } else if (currentPage === 'page2' && activePasscodeField === 'password') {
      setCurrentPage('page1');
 setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } else {
      handleDismiss();
 }
  };
  const handleKeyPress = useCallback((val) => {
    if (val === 'delete') {
      setFormData(prev => {
        const currentVal = prev[activePasscodeField] || '';
        if (currentVal.length > 0) {
          return { ...prev, [activePasscodeField]: currentVal.slice(0, -1) };
        }
        return prev;
      });
      if (errors[activePasscodeField]) {
   
     setErrors(prev => ({ ...prev, [activePasscodeField]: null }));
      }
    } else if (val === 'submit') {
      handleContinue();
    } else {
      setFormData(prev => {
        const currentVal = prev[activePasscodeField] || '';
        if (currentVal.length < 6) {
          const newVal = currentVal + val;
          return { ...prev, [activePasscodeField]:
 newVal };
        }
        return prev;
      });
      if (errors[activePasscodeField]) {
        setErrors(prev => ({ ...prev, [activePasscodeField]: null }));
      }
    }
  }, [activePasscodeField, handleContinue, errors]);
  const renderKeypad = () => {
    const isReady = activePasscodeField === 'password'
      ?
 formData.password.length === 6
      : formData.confirmPassword.length === 6;
 const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['delete', '0', 'submit']
    ];
 return (
      <View style={styles.keypadContainer}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map(key => (
              <TouchableOpacity
                key={key}
                style={[
        
          styles.keypadButton,
                  key === 'submit' && styles.keypadSubmitButton,
                  key === 'submit' && (!isReady || loading) && styles.loginButtonDisabled
                ]}
                onPress={() => handleKeyPress(key)}
        
        disabled={loading || (key === 'submit' && !isReady)}
              >
                {key === 'delete' ? (
                  <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/9919/9919403.png' }} style={styles.keypadIcon} />
                ) : key === 'submit' ? (
      
            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/128/14090/14090371.png' }} style={styles.keypadIconWhite} />
                ) : (
                  <Text style={styles.keypadButtonText}>{key}</Text>
                )}
              </TouchableOpacity>
            ))}
   
       </View>
        ))}
      </View>
    );
 };
  const animateOpen = () => {
    slideAnim.setValue(SCREEN_HEIGHT);
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 20,
      mass: 0.8,
      stiffness: 140,
      restSpeedThreshold: 0.01,
      restDisplacementThreshold: 0.01,
      useNativeDriver: true,
    }).start();
  };

  useImperativeHandle(ref, () => ({
    open: async (options = {}) => {
      const closeAction = options.onClose || null;
      setOnCloseCallback(() => closeAction);
      setCurrentPage('page1');
      setActivePasscodeField('password');
      setFormData({
        email: '',
        phone: '',
        referral: '',
        password: '',
        confirmPassword: '',
        device_name: '',
        device_os: '',
        expo_push_token: '',
        gender: '',
        country: 'Nigeria',
        countryCode: 'NG',
        onboardingId: '',
      });
      setErrors({});
      setShowReferralInput(false);
      setShowCountryModal(false);
      animateOpen();
    },
    close: () => {
      handleDismiss();
  
  }
  }));
  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      if (onCloseCallback) {
        onCloseCallback();
      }

      if (!isModal && navigation?.canGoBack()) {
        navigation.goBack();
      }
    });
 };
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) slideAnim.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 140 || gestureState.vy > 0.6) {
          handleDismiss();
      
  } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 20,
            mass: 0.8,
            stiffness: 140,
            useNativeDriver: true,
          }).start();
        }
  
    },
    })
  ).current;
  if (!visible) return null;
 return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.dismissOverlayTouch} activeOpacity={1} onPress={handleDismiss} />
       
        <Animated.View style={[
          styles.sheetContainer,
          {
            transform: [{ translateY: slideAnim }],
            height: SCREEN_HEIGHT,
            maxHeight: SCREEN_HEIGHT,
            borderRadius: 0,
          }
        ]}>
          <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={[styles.gradientBackground, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <SafeAreaView style={styles.safeArea}>
              <View {...panResponder.panHandlers} style={styles.dragResponderZone}>
     
           <View style={styles.dragIndicatorContainer}>
                  <View style={styles.dragIndicatorLine} />
                </View>

                <View style={styles.header}>
                  <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Ionicons name="close" size={18} color={BRAND_DARK} />
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>Create Account</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent2}
 
                 keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.heroSection}>
                    <Text style={styles.heroDesc}>
                      Create your account to enjoy seamless payments, instant transfers, and secure financial services
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 16 }}>
                    {currentPage === 'page1' && (
           
           <PageOneForm
                        formData={formData}
                        focusedInput={focusedInput}
                        setFocusedInput={setFocusedInput}
                 
       errors={errors}
                        handleChange={handleChange}
                        showReferralInput={showReferralInput}
                        setShowReferralInput={setShowReferralInput}
                     
   setShowCountryModal={setShowCountryModal}
                      />
                    )}
                    {currentPage === 'page2' && (
                      <PageTwoForm
         
               formData={formData}
                        activePasscodeField={activePasscodeField}
                        errors={errors}
                      />
               
     )}
                  </View>
                </ScrollView>
                {/* Sticky Bottom Area */}
                <View style={styles.loginButtonWrapper}>
                  {currentPage === 'page2' && renderKeypad()}
  
                {currentPage !== 'page2' && (
                    <TouchableOpacity
                      style={[styles.loginButton, (!isPageValid() ||
 loading) && styles.loginButtonDisabled]}
                      onPress={handleContinue}
                      disabled={!isPageValid() ||
 loading}
                    >
                      <Text style={styles.loginButtonText}>{loading ?
 'Processing' : 'Next'}</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.supportContainer}>
                    <Text style={styles.supportText}>Having troubles?
 </Text>
                    <TouchableOpacity onPress={() => Alert.sheet('Support', 'Opening email client')} activeOpacity={0.7}>
                      <Text style={styles.supportEmail}>Contact Support</Text>
                    </TouchableOpacity>
                  </View>
          
      </View>
              </View>
              {/* Country Modal - Now consistent with bottom sheet pattern */}
              <Modal transparent visible={showCountryModal} animationType="none" onRequestClose={() => setShowCountryModal(false)}>
                <View style={styles.modalOverlay}>
                  <TouchableOpacity
                    style={styles.dismissOverlayTouch}
                    activeOpacity={1}
                    onPress={() => setShowCountryModal(false)}
                  />
                  <Animated.View
                    style={[
                      styles.countrySheetContainer,
                      {
                        transform: [{ translateY: slideAnim }],
                        paddingTop: insets.top,
                        paddingBottom: insets.bottom,
                      },
                    ]}
                  >
                    <View style={styles.modalHeader}>
                      <View style={styles.modalKnob} />
                      <View style={styles.modalHeaderTitleRow}>
                        <Text style={styles.modalTitle}>Select Country</Text>
                        <TouchableOpacity onPress={() => setShowCountryModal(false)} activeOpacity={0.7}>
                          <Ionicons name="close-circle" size={24} color="#CCCCCC" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <FlatList
                      data={countries}
                      keyExtractor={(item) => item.isoCode}
                      contentContainerStyle={styles.countryListContent}
                      renderItem={({ item }) => (
                        <CountryOptionCard
                          item={item}
                          titleKey="name"
                          subtitleKey="dialCode"
                          imageKey="flagUrl"
                          onPress={() => {
                            setSelectedCountry(item);
                            setFormData(prev => ({ ...prev, country: item.name, countryCode: item.isoCode }));
                            setShowCountryModal(false);
                          }}

                          showRadio={false}
                          containerStyle={styles.countryOptionCard}
                        />
                      )}
                    />
                  </Animated.View>
                </View>
              </Modal>
            </SafeAreaView>
          </LinearGradient>
          <LoadingScreen visible={loading} message={loadingMessage} />
        </Animated.View>
      </View>
    </Modal>
  );
});
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.22)",
    justifyContent: "flex-end",
  },
  dismissOverlayTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#fff",
    height: SCREEN_HEIGHT,
    maxHeight: SCREEN_HEIGHT,
    minHeight: SCREEN_HEIGHT,
    borderRadius: 0,
  },
  dragResponderZone: {
    width: "100%",
  },
  dragIndicatorContainer: {
    width: "100%",
    height: 22,
   
 alignItems: "center",
    justifyContent: "center",
  },
  dragIndicatorLine: {
    width: 42,
    height: 5,
    backgroundColor: "rgba(14, 60, 46, 0.15)",
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 44,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5, 
    borderColor: BORDER_COLOR,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_DARK,
  },
  heroSection: {
    marginBottom: 20,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 16,
  },
  heroDesc: {
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 17,
    textAlign: 'center',
  },
  formContainer: {
    gap: 20,
    marginTop: 10,
  },
  formContainerPasscode: {
    gap: 28,
    marginTop: 24,
  },
  inputContainer: {
    width: '100%',
  },
  labelArea: {
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '400',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  inputFocused: {
    borderColor: '#2FB86D',
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    opacity: 0.6,
  },
  iconWrapper: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#666666',
  },
  trailingIcon: {
    marginLeft: 'auto',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '400',
    padding: 0,
  },
  errorMessage: {
    fontSize: 12,
    color: '#E74C3C',
    marginTop: 4,
    fontWeight: '400',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  genderButtonActive: {
    borderColor: '#2FB86D',
    backgroundColor: '#F4FBF7',
  },
  genderCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  genderCircleActive: {
    borderColor: '#2FB86D',
  },
  genderCircleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2FB86D',
  },
  genderText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '400',
  },
  genderTextActive: {
    color: '#2FB86D',
  },
  referralToggle: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  referralToggleText: {
    color: '#2FB86D',
    fontWeight: '500',
    fontSize: 14,
  },
  dotSection: {
    alignItems: 'center',
    width: '100%',
  },
  dotLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '400',
  },
  dotLabelActive: {
    color: '#1A1A1A',
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#2FB86D',
    borderColor: '#2FB86D',
  },
  dotError: {
    borderColor: '#E74C3C',
  },
  gradientBackground: {
    flex: 1,
    backgroundColor: '#eff7f4',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent2: {
    paddingHorizontal: 0,
    paddingTop: 20,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 12,
    width: '100%',
    gap: 8,
  },
  stepLine: {
    flex: 1,
    height: 4 * scale,
    borderRadius: 2 * scale,
  },
  loginButtonWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F5F8F7',
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderColor: '#E0E0E0',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 + 16 : 24,
  },

  loginButton: {
    backgroundColor: '#0E3C2E',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  loginButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  supportContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  supportText: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '400',
  },
  supportEmail: {
    fontSize: 13,
    color: '#2FB86D',
    fontWeight: '500',
  },
  keypadContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 12,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  keypadButton: {
    width: SCREEN_WIDTH * 0.28,
    height: 54,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  keypadSubmitButton: {
    backgroundColor: '#2FB86D',
    borderColor: '#2FB86D',
  },
  keypadButtonText: {
    fontSize: 22,
    fontWeight: '500',
    color: BRAND_DARK,
  },
  keypadIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: BRAND_DARK,
  },
  keypadIconWhite: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    tintColor: '#ffffff',
  },
  countrySheetContainer: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.45,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  modalKnob: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 16,
  
    fontWeight: '600',
    color: BRAND_DARK,
  },
  countryListContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
    gap: 12,
  },
  countryFlag: {
    width: 24 * scale,
    height: 24 * scale,
    borderRadius: 12 * scale,
  },
  countryName: {
    fontSize: 15,
    color: BRAND_DARK,
    fontWeight: '400',
    flex: 1,
  },
});
export default SignupSheet;