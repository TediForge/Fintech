import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, StatusBar, Text, FlatList, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@providers/ThemeProvider';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '@components/headers/ScreenHeader';
import SearchBar from '@components/common/SearchBar';
import SettingsFeatures from './utilities/SettingsFeatures';
import { FeatureSkeleton } from '@components/extra/FeatureSection';
import { useVisualDelay } from '@hooks/useVisualDelay';
import PinVerify from '@auth/verification/pin/pinVerify';
import { FaceVerificationSheet, runFaceVerificationPreflight } from '@auth/verification/face/FaceVerificationSheet';
import { getSessionToken } from '@hooks/useAuth';
import { getSettingAuthPolicy, shouldConfirmBeforeApply, shouldPromptForAuth } from './utilities/settingAuthConfig';
import useApiClient from '@hooks/apiClient';
import { getBiometricStorageKeys, getBiometricLoginEnabled } from '@auth/login/utilities/biometricLoginStorage';
import { getBiometricPaymentEnabled } from '@auth/verification/pin/utilities/biometricPaymentStorage';
import { setBiometricLoginSetting } from '@auth/login/utilities/biometricLogin';
import { setBiometricPaymentSetting } from '@auth/verification/pin/utilities/biometricPayment';
import { getUpdatePreferencesSnapshot, setUpdatePreferenceByTitle } from '@lib/update';
import LogOut from './utilities/logout';

const AccountSettingsPage = (() => {
const AccountSettings = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { isDark, colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState(route.params?.search || '');
  const [showPin, setShowPin] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);

  useEffect(() => {
    if (route.params?.search !== undefined && route.params.search !== searchQuery) {
      setSearchQuery(route.params.search || '');
    }
  }, [route.params?.search, searchQuery]);

  useEffect(() => {
    if (route.params?.search !== undefined && route.params.search !== searchQuery) {
      setSearchQuery(route.params.search || '');
    }
  }, [route.params?.search]);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [pendingActionType, setPendingActionType] = useState('navigate');
  const [pendingFeature, setPendingFeature] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoTriggerAttempted, setAutoTriggerAttempted] = useState(false);
  const loadRequestIdRef = useRef(0);
  const lastAutoOpenRouteRef = useRef(null);
  const autoOpenRoute = route?.params?.autoOpenRoute || route?.params?.autoOpenSetting || null;

  useEffect(() => {
    let mounted = true;
    getSessionToken().then((value) => {
      if (mounted) setSessionToken(value);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const loadAccountSettings = useCallback(() => {
    const currentLoadId = ++loadRequestIdRef.current;
    setLoading(true);
    setTimeout(() => {
      if (currentLoadId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }, 220);
  }, []);

  useEffect(() => {
    loadAccountSettings();
  }, [loadAccountSettings]);

  const filteredFeatures = useMemo(() => {
    return SettingsFeatures.getRegistry('account')
      .map((section) => ({
        ...section,
        data: section.data.filter((item) => {
          const haystack = `${item.title} ${item.description || ''}`.toLowerCase();
          return haystack.includes(searchQuery.toLowerCase());
        }),
      }))
      .filter((section) => section.data.length > 0);
  }, [searchQuery]);

  const handleFaceVerificationFallback = useCallback(() => {
    setShowFaceVerification(false);
    setShowPin(true);
  }, []);

  const beginFacialVerification = useCallback(async () => {
    const currentSessionToken = await getSessionToken();
    if (!currentSessionToken) {
      Alert.sheet('Session unavailable', 'Please log in again and try this setting.');
      resetStates();
      return false;
    }

    const preflight = await runFaceVerificationPreflight({
      timeoutMs: 2500,
    });

    if (!preflight.ok) {
      handleFaceVerificationFallback();
      return false;
    }

    setShowFaceVerification(true);
    return true;
  }, [handleFaceVerificationFallback]);

  const resetStates = () => {
    setPendingRoute(null);
    setPendingActionType('navigate');
    setPendingFeature(null);
  };

  const showPlaceholder = useVisualDelay(!loading, 80);

  const handleProtectedAction = (item) => {
    const authPolicy = getSettingAuthPolicy(item);

    if (!authPolicy.authRequired) {
      navigation.navigate(item.route);
      return;
    }

    setPendingRoute(item.route);
    setPendingActionType('navigate');
    setPendingFeature(item);

    const confirmAction = async () => {
      if (authPolicy.authMethod === 'facial') {
        setShowPin(false);
        await beginFacialVerification();
        return;
      }

      setShowFaceVerification(false);
      setShowPin(true);
    };

    if (!shouldConfirmBeforeApply(item)) {
      confirmAction();
      return;
    }

    Alert.sheet(
      'Confirm Action',
      `Are you sure you want to continue with ${item.title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: confirmAction },
      ]
    );
  };

  const handleForgotPinRequest = useCallback(() => {
    const resetFeature = SettingsFeatures.getRegistry('account')
      .flatMap((section) => section.data || [])
      .find((item) => item.route === 'reset-pin' || item.title?.toLowerCase() === 'reset user pin');

    if (resetFeature) {
      setShowPin(false);
      handleProtectedAction(resetFeature);
      return;
    }

    navigation.navigate('reset-pin');
  }, [navigation]);

  useEffect(() => {
    if (!autoOpenRoute) {
      lastAutoOpenRouteRef.current = null;
      setAutoTriggerAttempted(false);
      return;
    }

    if (lastAutoOpenRouteRef.current === autoOpenRoute && autoTriggerAttempted) {
      return;
    }

    lastAutoOpenRouteRef.current = autoOpenRoute;
    setAutoTriggerAttempted(false);
  }, [autoOpenRoute, autoTriggerAttempted]);

  useEffect(() => {
    if (!autoOpenRoute || autoTriggerAttempted || loading || showPlaceholder) {
      return;
    }

    const targetFeature = SettingsFeatures.getRegistry('account')
      .flatMap((section) => section.data || [])
      .find((item) => item.route === autoOpenRoute || item.title?.toLowerCase() === autoOpenRoute?.toLowerCase());

    if (!targetFeature) {
      setAutoTriggerAttempted(true);
      return;
    }

    setAutoTriggerAttempted(true);
    handleProtectedAction(targetFeature);
  }, [autoOpenRoute, autoTriggerAttempted, loading, showPlaceholder]);

  const handlePinApproval = async (status) => {
    setShowPin(false);
    if (status !== 'approved') {
      resetStates();
      return;
    }

    if (pendingActionType === 'navigate' && pendingRoute) {
      const targetRoute = pendingRoute;
      resetStates();
      navigation.navigate(targetRoute);
      return;
    }
  };

  const handleFaceVerificationComplete = async (result) => {
    setShowFaceVerification(false);
    if (result?.status !== 'SUCCESS') {
      const reason = result?.reason || 'Face verification was cancelled or failed.';
      Alert.sheet('Verification not completed', `The setting was not changed. ${reason}`);
      resetStates();
      return;
    }

    if (pendingActionType === 'navigate' && pendingRoute) {
      const targetRoute = pendingRoute;
      resetStates();
      navigation.navigate(targetRoute);
      return;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader
        title="Account Settings"
        backgroundColor={colors.surface}
        textColor={colors.textPrimary}
        iconColor={colors.textPrimary}
      />

      <View style={styles.mainWrapper}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Search account settings"
          containerStyle={{ marginBottom: 10 }}
        />

        <FlatList
          data={[{ id: 'account_settings_content' }]}
          keyExtractor={(item) => item.id}
          renderItem={() => {
            if (showPlaceholder) {
              return <FeatureSkeleton isDark={isDark} colors={colors} />;
            }

            if (filteredFeatures.length > 0) {
              return (
                <SettingsFeatures
                  page="account"
                  features={filteredFeatures}
                  onProtectedAction={handleProtectedAction}
                  disabledSettingTitles={[]}
                  busySettingTitles={[]}
                />
              );
            }

            return (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No account settings found matching "{searchQuery}"</Text>
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          overScrollMode="never"
          decelerationRate="normal"
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </View>

      {showPin && <PinVerify visible={showPin} onResult={handlePinApproval} onClose={() => setShowPin(false)} onForgotPin={handleForgotPinRequest} />}
      <FaceVerificationSheet
        isVisible={showFaceVerification}
        sessionId={sessionToken || null}
        referenceImage={undefined}
        riskLevel="MEDIUM"
        getSelfie={false}
        onVerificationComplete={handleFaceVerificationComplete}
        onPreflightFallback={handleFaceVerificationFallback}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});

return AccountSettings;
})();

const ReusableSettingsPage = (() => {
const api = apiConfig.baseUrl;

const BRAND_DARK = "#0E3C2E";
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";

// Use shared skeleton and a small visual delay for smoother reveal

const ReusableSettings = ({ route }) => {
  const { category, search } = route.params || {};
  const pageTitle = category 
    ? `${category.charAt(0).toUpperCase() + category.slice(1)} Settings` 
    : "Settings";

  const navigation = useNavigation();
  const { user } = useApiClient();
  const { isDark, colors } = useTheme();
  const [switchValues, setSwitchValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(null);
  const [pendingValue, setPendingValue] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [pendingActionType, setPendingActionType] = useState('toggle');
  const [searchQuery, setSearchQuery] = useState(search || "");
  const [sessionToken, setSessionToken] = useState(null);
  const [busyFeatureTitles, setBusyFeatureTitles] = useState([]);

  useEffect(() => {
    if (route.params?.search !== undefined && route.params.search !== searchQuery) {
      setSearchQuery(route.params.search || '');
    }
  }, [route.params?.search, searchQuery]);

  useEffect(() => {
    if (route.params?.search !== undefined && route.params.search !== searchQuery) {
      setSearchQuery(route.params.search || '');
    }
  }, [route.params?.search]);
  const [disabledSettingTitles, setDisabledSettingTitles] = useState([]);
  const busyFeatureTitlesRef = useRef(new Set());
  const disabledSettingTitlesRef = useRef(new Set());
  const switchValuesRef = useRef(switchValues);
  const syncQueueRef = useRef(new Set());
  const featureSyncIdRef = useRef({});
  const loadRequestIdRef = useRef(0);

  const filteredSecurityFeatures = useMemo(() => {
    return SettingsFeatures.getRegistry('reusable')
      .filter(section => !category || (section.category && section.category.toLowerCase() === category.toLowerCase()))
      .map(section => ({
        ...section,
        data: section.data.filter(f => 
          f.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (f.description || f.desc || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.data.length > 0);
  }, [searchQuery, category]);

  const allFeatures = useMemo(() => {
    return SettingsFeatures.getRegistry('reusable')
      .filter(section => !category || (section.category && section.category.toLowerCase() === category.toLowerCase()))
      .reduce((acc, section) => acc.concat(section.data), []);
  }, [category]);

  const getStorageKeys = useCallback(() => {
    if (!user?.phone_number) return null;
    return getBiometricStorageKeys(user.phone_number);
  }, [user?.phone_number]);

  useEffect(() => {
    let mounted = true;
    getSessionToken().then((value) => {
      if (mounted) setSessionToken(value);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    switchValuesRef.current = switchValues;
  }, [switchValues]);

  const updateDisabledSettingState = useCallback((title, isDisabled) => {
    if (!title) return;

    if (isDisabled) {
      disabledSettingTitlesRef.current.add(title);
    } else {
      disabledSettingTitlesRef.current.delete(title);
    }

    setDisabledSettingTitles(Array.from(disabledSettingTitlesRef.current));
  }, []);

  const queueEndpointFeatureSync = useCallback(async (feature, loadId, attempt = 0) => {
    if (!feature?.endpoint || syncQueueRef.current.has(feature.title)) return;

    const featureSyncKey = `${feature.title}:${feature.endpoint}`;
    featureSyncIdRef.current[featureSyncKey] = loadId;

    console.log('[REUSABLE SETTINGS QUEUE] sync start', {
      feature: feature.title,
      endpoint: feature.endpoint,
      attempt,
      category,
      loadId,
      currentLoadId: loadRequestIdRef.current,
    });

    syncQueueRef.current.add(feature.title);

    try {
      const sessionTokenValue = await getSessionToken();
      const res = await fetch(`${api}/v1/user/settings/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionTokenValue,
          setting: feature.setting || feature.endpoint,
        }),
      });

      const data = await res.json().catch(() => null);
      const isSuccessfulResponse = Boolean(
        data?.success === true ||
        data?.ok === true ||
        ['success', 'successful', 'ok'].includes(String(data?.status || '').toLowerCase())
      );

      if (!isSuccessfulResponse) {
        throw new Error('Invalid response from settings endpoint');
      }

      const currentFeatureSyncId = featureSyncIdRef.current[`${feature.title}:${feature.endpoint}`];
      if (currentFeatureSyncId !== loadId) {
        console.warn('[REUSABLE SETTINGS QUEUE] stale sync ignored', { feature: feature.title, featureEndpoint: feature.endpoint, loadId, currentFeatureSyncId });
        return;
      }

      const enabledValue = Boolean(data?.details?.enabled ?? data?.enabled ?? false);
      console.log('[REUSABLE SETTINGS QUEUE] sync success', { feature: feature.title, enabledValue, loadId });
      setSwitchValues((prev) => ({ ...prev, [feature.title]: enabledValue }));
      updateDisabledSettingState(feature.title, false);
    } catch (err) {
      const currentFeatureSyncId = featureSyncIdRef.current[`${feature.title}:${feature.endpoint}`];
      if (currentFeatureSyncId !== loadId) {
        console.warn('[REUSABLE SETTINGS QUEUE] stale sync failure ignored', { feature: feature.title, loadId, currentFeatureSyncId, error: err?.message });
        return;
      }

      console.error('[REUSABLE SETTINGS QUEUE] sync failed', { feature: feature.title, endpoint: feature.endpoint, attempt, error: err?.message });
      updateDisabledSettingState(feature.title, true);

      if (loadId === loadRequestIdRef.current && attempt < 2) {
        const retryDelay = 10000 * (attempt + 1);
        setTimeout(() => {
          queueEndpointFeatureSync(feature, loadId, attempt + 1);
        }, retryDelay);
      }
    } finally {
      syncQueueRef.current.delete(feature.title);
    }
  }, [updateDisabledSettingState]);

  const loadSwitches = useCallback(async (isSilent = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadId = ++loadRequestIdRef.current;

    if (!isSilent) {
      setLoading(true);
    }

    try {
      const keys = getStorageKeys();
      await getSessionToken();
      const nextValues = { ...switchValuesRef.current };

      const endpointFeatures = allFeatures.filter((feature) => {
        return feature.endpoint &&
          feature.title !== 'Biometrics Login' &&
          feature.title !== 'Pay With Biometric';
      });

      if (keys) {
        try {
          nextValues['Biometrics Login'] = await getBiometricLoginEnabled(user.phone_number);
          nextValues['Pay With Biometric'] = await getBiometricPaymentEnabled(user.phone_number);
        } catch (e) {
          console.log('Failed to load local feature values', e);
        }
      }

      if (nextValues['Biometrics Login'] === false) {
        updateDisabledSettingState('Biometrics Login', true);
      } else {
        updateDisabledSettingState('Biometrics Login', false);
      }

      setDisabledSettingTitles([]);
      disabledSettingTitlesRef.current.clear();
      setSwitchValues(nextValues);
      setLoading(false);

      endpointFeatures.forEach((feature) => {
        updateDisabledSettingState(feature.title, true);
      });

      endpointFeatures.forEach((feature) => {
        queueEndpointFeatureSync(feature, loadId);
      });
    } catch (err) {
      console.warn('[REUSABLE SETTINGS] loadSwitches error', err?.message || err);
    } finally {
      if (loadId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [allFeatures, getStorageKeys, queueEndpointFeatureSync, user?.phone_number]);

  useEffect(() => {
    loadSwitches(Object.keys(switchValuesRef.current).length > 0);
  }, [loadSwitches]);

  useFocusEffect(
    useCallback(() => {
      loadSwitches(true);
      return () => undefined;
    }, [loadSwitches])
  );

  const updateBusyFeatureState = useCallback((title, isBusy) => {
    if (!title) return;

    if (isBusy) {
      busyFeatureTitlesRef.current.add(title);
    } else {
      busyFeatureTitlesRef.current.delete(title);
    }

    setBusyFeatureTitles(Array.from(busyFeatureTitlesRef.current));
  }, []);

  const handleFaceVerificationFallback = useCallback(() => {
    setShowFaceVerification(false);
    setShowPin(true);
  }, []);

  const beginFacialVerification = useCallback(async () => {
    const currentSessionToken = await getSessionToken();
    if (!currentSessionToken) {
      Alert.sheet('Session unavailable', 'Please log in again and try this setting.');
      resetStates();
      return false;
    }

    const preflight = await runFaceVerificationPreflight({
      timeoutMs: 2500,
    });

    if (!preflight.ok) {
      handleFaceVerificationFallback();
      return false;
    }

    setShowFaceVerification(true);
    return true;
  }, [handleFaceVerificationFallback]);

  const handleSwitchChange = (feature) => {
    if (busyFeatureTitlesRef.current.has(feature.title)) return;

    const newVal = !Boolean(switchValuesRef.current[feature.title]);
    const authPolicy = getSettingAuthPolicy(feature);
    setPendingValue(newVal);
    setCurrentFeature(feature);
    setPendingRoute(null);
    setPendingActionType('toggle');

    const confirmAction = async () => {
      if (!authPolicy.authRequired) {
        await applyCurrentFeatureChange(feature, newVal);
        return;
      }

      if (authPolicy.authMethod === 'facial') {
        setShowPin(false);
        await beginFacialVerification();
        return;
      }

      setShowFaceVerification(false);
      setShowPin(true);
    };

    if (!shouldConfirmBeforeApply(feature)) {
      confirmAction();
      return;
    }

    Alert.sheet(
      'Confirm Action',
      `Are you sure you want to ${newVal ? 'enable' : 'disable'} ${feature.title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: confirmAction },
      ]
    );
  };

  const handleProtectedAction = (item) => {
    const authPolicy = getSettingAuthPolicy(item);
    setPendingRoute(item.route);
    setPendingActionType('navigate');
    setCurrentFeature(item);
    setPendingValue(false);

    const confirmAction = async () => {
      if (!authPolicy.authRequired) {
        navigation.navigate(item.route);
        resetStates();
        return;
      }

      if (authPolicy.authMethod === 'facial') {
        setShowPin(false);
        const currentSessionToken = await getSessionToken();
        setShowFaceVerification(Boolean(currentSessionToken));
        if (!currentSessionToken) {
          Alert.sheet('Session unavailable', 'Please log in again and try this setting.');
          resetStates();
        }
        return;
      }

      setShowFaceVerification(false);
      setShowPin(true);
    };

    if (!shouldConfirmBeforeApply(item)) {
      confirmAction();
      return;
    }

    Alert.sheet(
      'Confirm Action',
      `Are you sure you want to continue with ${item.title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: confirmAction },
      ]
    );
  };

  const applyCurrentFeatureChange = async (feature = currentFeature, nextValue = pendingValue) => {
    if (!feature) return;
    if (busyFeatureTitlesRef.current.has(feature.title)) return;

    updateBusyFeatureState(feature.title, true);

    try {
      setLoading(true);
      if (feature.title === 'Biometrics Login' ||
          feature.title === 'Pay With Biometric') {
        await handleLocalToggle(nextValue, feature.title);
        return;
      }

      const sessionToken = await getSessionToken();
      const res = await fetch(`${api}/v1/user/settings/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionToken,
          setting: feature.setting || feature.endpoint,
          enabled: nextValue,
        }),
      });
      const data = await res.json().catch(() => null);
      const isSuccessfulResponse = Boolean(
        data?.success === true ||
        data?.ok === true ||
        ['success', 'successful', 'ok'].includes(String(data?.status || '').toLowerCase())
      );

      setSwitchValues(prev => ({ ...prev, [feature.title]: nextValue }));

      if (!isSuccessfulResponse) {
        console.warn(`Setting response for ${feature.title} was not recognized as success`, data);
      }
    } catch (err) {
      setSwitchValues(prev => ({ ...prev, [feature.title]: nextValue }));
      console.warn(`Failed to sync ${feature.title}`, err);
    } finally {
      setLoading(false);
      updateBusyFeatureState(feature.title, false);
      resetStates();
    }
  };

  const handlePinApproval = async (status) => {
    setShowPin(false);
    if (status !== 'approved') {
      resetStates();
      return;
    }

    if (pendingActionType === 'navigate' && pendingRoute) {
      const targetRoute = pendingRoute;
      resetStates();
      navigation.navigate(targetRoute);
      return;
    }

    await applyCurrentFeatureChange();
  };

  const handleFaceVerificationComplete = async (result) => {
    setShowFaceVerification(false);
    if (result?.status !== 'SUCCESS') {
      const reason = result?.reason || 'Face verification was cancelled or failed.';
      Alert.sheet('Verification not completed', `The setting was not changed. ${reason}`);
      resetStates();
      return;
    }

    if (pendingActionType === 'navigate' && pendingRoute) {
      const targetRoute = pendingRoute;
      resetStates();
      navigation.navigate(targetRoute);
      return;
    }

    await applyCurrentFeatureChange();
  };

  const handleLocalToggle = async (enable, title) => {
    const keys = getStorageKeys();
    if (!keys) return;
    try {
      const isPayBio = title === 'Pay With Biometric';
      const result = isPayBio
        ? await setBiometricPaymentSetting({ phone: user.phone_number, enabled: enable, promptMessage: 'Enable Biometric Payments' })
        : await setBiometricLoginSetting({
            phone: user.phone_number,
            enabled: enable,
            userData: {
              phone_number: user.phone_number,
              password_hash: user.password_hash || null,
            },
          });

      if (result?.success === false) {
        throw new Error(result?.error || 'Unable to update biometric setting.');
      }

      setSwitchValues(prev => ({ ...prev, [title]: enable }));
    } catch (err) {
      Alert.sheet('Error', err?.message || 'Unexpected error.');
    } finally {
      updateBusyFeatureState(title, false);
      resetStates();
    }
  };

  const resetStates = () => {
    setCurrentFeature(null);
    setPendingValue(false);
    setPendingRoute(null);
    setPendingActionType('toggle');
  };

  const showPlaceholder = useVisualDelay(!loading, 80);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader 
        title={pageTitle} 
        backgroundColor={colors.surface} 
        textColor={colors.textPrimary} 
        iconColor={colors.textPrimary} 
      />
      
      <View style={styles.mainWrapper}>
        <SearchBar 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          placeholder="Search for a setting"
          containerStyle={{ marginBottom: 10 }}
        />
        
        <FlatList
          data={[{ id: 'reusable_settings_content' }]}
          keyExtractor={(item) => item.id}
          renderItem={() => (
            <>
              {showPlaceholder ? (
                <FeatureSkeleton isDark={isDark} colors={colors} />
              ) : (
                <>
                  {filteredSecurityFeatures.length > 0 && (
                    <SettingsFeatures 
                      page="reusable"
                      features={filteredSecurityFeatures} 
                      switchValues={switchValues} 
                      onSwitchChange={handleSwitchChange} 
                      onProtectedAction={handleProtectedAction}
                      busySettingTitles={busyFeatureTitles}
                      disabledSettingTitles={disabledSettingTitles}
                    />
                  )}
                  {filteredSecurityFeatures.length === 0 && (
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: isDark ? colors.textSecondary : colors.textDisabled }]}>No settings found matching "{searchQuery}"</Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          overScrollMode="never"
          decelerationRate="normal"
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </View>
      {showPin && <PinVerify visible={showPin} onResult={handlePinApproval} onClose={() => setShowPin(false)} />}
      <FaceVerificationSheet
        isVisible={showFaceVerification}
        sessionId={sessionToken || user?.phone_number || null}
        referenceImage={user?.avatarUrl || undefined}
        riskLevel="MEDIUM"
        getSelfie={false}
        onVerificationComplete={handleFaceVerificationComplete}
        onPreflightFallback={handleFaceVerificationFallback}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  skeletonSectionWrapper: {
    marginBottom: 6,
  },
  skeletonSectionHeader: {
    marginTop: 8,
    marginBottom: 5,
    marginLeft: 6,
  },
  skeletonContainer: {
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 6,
    paddingVertical: 4,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  placeholderTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  staticLine: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  staticLineDark: {
    backgroundColor: '#2A2A2A',
  },
  staticCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  staticCircleDark: {
    backgroundColor: '#2A2A2A',
  },
  staticPill: {
    width: 40,
    height: 24,
    borderRadius: 70,
    backgroundColor: '#E5E7EB',
  },
  staticPillDark: {
    backgroundColor: '#2A2A2A',
  },
});
return ReusableSettings;
})();

const SystemSettingsPage = (() => {
const api = apiConfig.baseUrl;

const BRAND_DARK = "#0E3C2E";
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";

// Use shared SettingsSkeleton and visual delay for smoother reveal

const SystemSettings = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useApiClient();
  const { isDark, colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState(route.params?.search || '');
  const [showPin, setShowPin] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);

  useEffect(() => {
    if (route.params?.search !== undefined && route.params.search !== searchQuery) {
      setSearchQuery(route.params.search || '');
    }
  }, [route.params?.search]);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [pendingActionType, setPendingActionType] = useState('navigate');
  const [pendingFeature, setPendingFeature] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [switchValues, setSwitchValues] = useState({});
  const [filteredSecurityFeatures, setFilteredSecurityFeatures] = useState([]);
  const [busyFeatureTitles, setBusyFeatureTitles] = useState([]);
  const [disabledSettingTitles, setDisabledSettingTitles] = useState([]);
  const allSystemFeatures = useMemo(() => SettingsFeatures.getRegistry('system'), []);
  const showLogout = allSystemFeatures.some((section) => section.data?.some((item) => item.isLogout));
  const busyFeatureTitlesRef = useRef(new Set());
  const disabledSettingTitlesRef = useRef(new Set());
  const switchValuesRef = useRef(switchValues);
  const syncQueueRef = useRef(new Set());
  const loadRequestIdRef = useRef(0);
  const skeletonTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    getSessionToken().then((value) => {
      if (mounted) setSessionToken(value);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const updateDisabledSettingState = useCallback((title, isDisabled) => {
    if (!title) return;

    if (isDisabled) {
      disabledSettingTitlesRef.current.add(title);
    } else {
      disabledSettingTitlesRef.current.delete(title);
    }

    setDisabledSettingTitles(Array.from(disabledSettingTitlesRef.current));
  }, []);

  const markBiometricSettingUnavailable = useCallback(() => {
    updateDisabledSettingState('Biometrics Login', true);
    setSwitchValues((prev) => ({ ...prev, 'Biometrics Login': false }));
  }, [updateDisabledSettingState]);

  const queueEndpointSettingSync = useCallback(async (feature, loadId, attempt = 0) => {
    if (!feature?.endpoint || syncQueueRef.current.has(feature.title)) return;

    syncQueueRef.current.add(feature.title);

    try {
      const sessionTokenValue = await getSessionToken();
      const res = await fetch(`${api}/v1/user/settings/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionTokenValue,
          setting: feature.setting || feature.endpoint,
        }),
      });
      const data = await res.json().catch(() => null);
      const isSuccessfulResponse = Boolean(
        data?.success === true ||
        data?.ok === true ||
        ['success', 'successful', 'ok'].includes(String(data?.status || '').toLowerCase())
      );

      if (!isSuccessfulResponse) {
        throw new Error('Invalid response from settings endpoint');
      }

      const enabledValue = Boolean(data?.details?.enabled ?? data?.enabled ?? false);
      setSwitchValues((prev) => ({ ...prev, [feature.title]: enabledValue }));
      updateDisabledSettingState(feature.title, false);
    } catch (error) {
      setSwitchValues((prev) => ({ ...prev, [feature.title]: false }));
      updateDisabledSettingState(feature.title, true);

      if (loadId === loadRequestIdRef.current && attempt < 2) {
        const retryDelay = 10000 * (attempt + 1);
        setTimeout(() => {
          queueEndpointSettingSync(feature, loadId, attempt + 1);
        }, retryDelay);
      }
    } finally {
      syncQueueRef.current.delete(feature.title);
    }
  }, [updateDisabledSettingState]);

  const loadSettings = useCallback(async () => {
    const currentLoadId = ++loadRequestIdRef.current;

    if (skeletonTimerRef.current) {
      clearTimeout(skeletonTimerRef.current);
    }

    try {
      setShowPlaceholder(true);
      setDisabledSettingTitles([]);
      disabledSettingTitlesRef.current.clear();

      const phone = user?.phone_number;
      const snapshot = await getUpdatePreferencesSnapshot();
      const biometricLoginEnabled = await getBiometricLoginEnabled(phone);
      const biometricPaymentEnabled = await getBiometricPaymentEnabled(phone);

      const values = {};
      if (snapshot) {
        values['Auto Download'] = snapshot.autoDownload ?? false;
        values['Notify On Update'] = snapshot.notifyOnUpdate ?? snapshot.notify ?? false;
        values['Wi‑Fi Only Downloads'] = snapshot.wifiOnly ?? false;
      }
      values['Biometrics Login'] = biometricLoginEnabled ?? false;
      values['Pay With Biometric'] = biometricPaymentEnabled ?? false;

      const biometricAvailable = Boolean(user?.phone_number && user?.password_hash);
      console.log('[SystemSettings] biometric availability check', {
        biometricAvailable,
        phone: user?.phone_number,
        hasPasswordHash: Boolean(user?.password_hash),
        biometricLoginEnabled,
      });
      updateDisabledSettingState('Biometrics Login', !biometricAvailable);

      const allFeatures = allSystemFeatures.flatMap((section) => section.data || []);
      const endpointFeatures = allFeatures.filter(
        (feature) => feature.endpoint && !['Biometrics Login', 'Pay With Biometric'].includes(feature.title)
      );

      setSwitchValues(values);
      setFilteredSecurityFeatures(searchQuery.trim() ? applySearchToSections(allSystemFeatures, searchQuery) : allSystemFeatures);

      skeletonTimerRef.current = setTimeout(() => {
        if (currentLoadId === loadRequestIdRef.current) {
          setShowPlaceholder(false);
        }
      }, 220);

      endpointFeatures.forEach((feature) => {
        queueEndpointSettingSync(feature, currentLoadId);
      });
    } catch (error) {
      console.warn('Failed to load settings state', error);
      setFilteredSecurityFeatures(searchQuery.trim() ? applySearchToSections(allSystemFeatures, searchQuery) : allSystemFeatures);
      if (currentLoadId === loadRequestIdRef.current) {
        setShowPlaceholder(false);
      }
    }
  }, [allSystemFeatures, queueEndpointSettingSync, user?.phone_number, user?.password_hash]);

  useEffect(() => {
    switchValuesRef.current = switchValues;
  }, [switchValues]);

  const applySearchToSections = useCallback((sections, query) => {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return sections;

    return sections
      .map((section) => ({
        ...section,
        data: (section.data || []).filter((item) => {
          const haystack = `${item.title} ${item.description || ''} ${section.section}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.data.length > 0);
  }, []);

  useEffect(() => {
    loadSettings();

    return () => {
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
      }
    };
  }, [loadSettings]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSecurityFeatures(allSystemFeatures);
      return;
    }
    setFilteredSecurityFeatures(applySearchToSections(allSystemFeatures, searchQuery));
  }, [searchQuery, allSystemFeatures, applySearchToSections]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
      return () => undefined;
    }, [loadSettings])
  );

  useEffect(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      setFilteredSecurityFeatures(allSystemFeatures);
      return;
    }

    const matchingSections = allSystemFeatures
      .map((section) => ({
        ...section,
        data: (section.data || []).filter((item) => {
          const haystack = `${item.title} ${item.description || ''} ${section.section}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.data.length > 0);

    setFilteredSecurityFeatures(matchingSections);
  }, [searchQuery, allSystemFeatures]);

  const handleFaceVerificationFallback = useCallback(() => {
    setShowFaceVerification(false);
    setShowPin(true);
  }, []);

  const beginFacialVerification = useCallback(async () => {
    const currentSessionToken = await getSessionToken();
    if (!currentSessionToken) {
      Alert.sheet('Session unavailable', 'Please log in again and try this setting.');
      resetStates();
      return false;
    }

    const preflight = await runFaceVerificationPreflight({
      timeoutMs: 2500,
    });

    if (!preflight.ok) {
      handleFaceVerificationFallback();
      return false;
    }

    setShowFaceVerification(true);
    return true;
  }, [handleFaceVerificationFallback]);

  const handleProtectedAction = (item) => {
    const authPolicy = getSettingAuthPolicy(item);
    setPendingRoute(item.route);
    setPendingActionType('navigate');
    setPendingFeature(item);

    const confirmAction = async () => {
      if (!authPolicy.authRequired) {
        navigation.navigate(item.route);
        resetStates();
        return;
      }

      if (authPolicy.authMethod === 'facial') {
        setShowPin(false);
        await beginFacialVerification();
        return;
      }

      setShowFaceVerification(false);
      setShowPin(true);
    };

    if (!shouldConfirmBeforeApply(item)) {
      confirmAction();
      return;
    }

    Alert.sheet(
      'Confirm Action',
      `Are you sure you want to continue with ${item.title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: confirmAction },
      ]
    );
  };

  const resetStates = () => {
    setShowPin(false);
    setShowFaceVerification(false);
    setPendingRoute(null);
    setPendingFeature(null);
    setPendingActionType('navigate');
  };

  const updateBusyFeatureState = useCallback((title, isBusy) => {
    if (!title) return;

    if (isBusy) {
      busyFeatureTitlesRef.current.add(title);
    } else {
      busyFeatureTitlesRef.current.delete(title);
    }

    setBusyFeatureTitles(Array.from(busyFeatureTitlesRef.current));
  }, []);

  const handleSwitchChange = async (feature) => {
    if (busyFeatureTitlesRef.current.has(feature.title)) return;

    const authPolicy = getSettingAuthPolicy(feature);
    if (!authPolicy.authRequired) {
      await handleDirectAction(feature);
      return;
    }

    if (!shouldPromptForAuth(feature)) {
      await handleDirectAction(feature);
      return;
    }

    if (!shouldConfirmBeforeApply(feature)) {
      await handleDirectAction(feature);
      return;
    }

    setPendingFeature(feature);
    setPendingRoute(feature.route || null);
    setPendingActionType('switch');
    setShowPin(true);
  };

  const applyCurrentFeatureChange = async (feature, nextValue) => {
    if (!feature?.endpoint) return;

    try {
      const sessionTokenValue = await getSessionToken();
      const res = await fetch(`${api}/v1/user/settings/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionTokenValue,
          setting: feature.setting || feature.endpoint,
          enabled: nextValue,
        }),
      });
      const data = await res.json().catch(() => null);
      const isSuccessfulResponse = Boolean(
        data?.success === true ||
        data?.ok === true ||
        ['success', 'successful', 'ok'].includes(String(data?.status || '').toLowerCase())
      );

      setSwitchValues((prev) => ({ ...prev, [feature.title]: nextValue }));

      if (!isSuccessfulResponse) {
        console.warn(`Setting response for ${feature.title} was not recognized as success`, data);
      }
    } catch (error) {
      setSwitchValues((prev) => ({ ...prev, [feature.title]: nextValue }));
      console.warn(`Failed to sync ${feature.title}`, error);
    }
  };

  const handleDirectAction = async (feature) => {
    const key = feature.title;
    const nextValue = !Boolean(switchValuesRef.current[key]);

    console.log('[SystemSettings] handleDirectAction invoked', {
      featureTitle: feature?.title,
      featureEndpoint: feature?.endpoint,
      switchValues: switchValuesRef.current,
      user,
    });

    if (feature.isTheme) {
      return;
    }

    if (busyFeatureTitlesRef.current.has(key)) return;
    updateBusyFeatureState(key, true);

    try {
      if (feature.title === 'Biometrics Login') {
        if (!user?.phone_number || !user?.password_hash) {
          console.log('[SystemSettings] biometric login disabled because required user data is missing', {
            user,
            hasPhoneNumber: Boolean(user?.phone_number),
            phoneNumber: user?.phone_number,
            hasPasswordHash: Boolean(user?.password_hash),
            passwordHash: user?.password_hash,
          });
          markBiometricSettingUnavailable();
          updateBusyFeatureState(key, false);
          return;
        }
        console.log('[SystemSettings] enabling biometric login', {
          user,
          phone: user.phone_number,
          passwordHash: user.password_hash,
        });
        const result = await setBiometricLoginSetting({
          phone: user.phone_number,
          enabled: nextValue,
          userData: {
            phone_number: user.phone_number,
            password_hash: user.password_hash,
          },
        });
        console.log('[SystemSettings] biometric login result', result);
        if (!result?.success) {
          markBiometricSettingUnavailable();
          setSwitchValues((prev) => ({ ...prev, [key]: false }));
          throw new Error(result?.error || 'Unable to update biometrics login.');
        }
        updateDisabledSettingState(key, false);
        setSwitchValues((prev) => ({ ...prev, [key]: Boolean(result?.enabled ?? nextValue) }));
        return;
      }

      if (feature.title === 'Pay With Biometric') {
        if (!user?.phone_number) {
          updateBusyFeatureState(key, false);
          return;
        }
        const result = await setBiometricPaymentSetting({
          phone: user.phone_number,
          enabled: nextValue,
          promptMessage: 'Enable biometric payments',
        });
        if (!result?.success) {
          throw new Error(result?.error || 'Unable to update biometric payments.');
        }
        setSwitchValues((prev) => ({ ...prev, [key]: nextValue }));
        return;
      }

      if (feature.title === 'Auto Download' || feature.title === 'Notify On Update' || feature.title === 'Wi‑Fi Only Downloads') {
        const saved = await setUpdatePreferenceByTitle(feature.title, nextValue);
        if (!saved) {
          throw new Error('The update preference could not be saved.');
        }

        const refreshedSnapshot = await getUpdatePreferencesSnapshot();
        setSwitchValues((prev) => ({
          ...prev,
          'Auto Download': refreshedSnapshot?.autoDownload ?? prev['Auto Download'] ?? false,
          'Notify On Update': refreshedSnapshot?.notifyOnUpdate ?? refreshedSnapshot?.notify ?? prev['Notify On Update'] ?? false,
          'Wi‑Fi Only Downloads': refreshedSnapshot?.wifiOnly ?? prev['Wi‑Fi Only Downloads'] ?? false,
        }));
        return;
      }

      if (feature.endpoint) {
        await applyCurrentFeatureChange(feature, nextValue);
        return;
      }

      setSwitchValues((prev) => ({ ...prev, [key]: nextValue }));
    } catch (error) {
      Alert.sheet('Error', error?.message || 'Unable to update setting.');
    } finally {
      updateBusyFeatureState(key, false);
    }
  };

  const handlePinApproval = async (pin) => {
    if (!pin) return;

    if (pendingActionType === 'switch' && pendingFeature) {
      await handleDirectAction(pendingFeature);
      resetStates();
      return;
    }

    if (pendingActionType === 'navigate' && pendingRoute) {
      const targetRoute = pendingRoute;
      resetStates();
      navigation.navigate(targetRoute);
      return;
    }
  };

  const handleFaceVerificationComplete = async (result) => {
    setShowFaceVerification(false);
    if (result?.status !== 'SUCCESS') {
      const reason = result?.reason || 'Face verification was cancelled or failed.';
      Alert.sheet('Verification not completed', `The setting was not changed. ${reason}`);
      resetStates();
      return;
    }

    if (pendingActionType === 'switch' && pendingFeature) {
      await handleDirectAction(pendingFeature);
      resetStates();
      return;
    }

    if (pendingActionType === 'navigate' && pendingRoute) {
      const targetRoute = pendingRoute;
      resetStates();
      navigation.navigate(targetRoute);
      return;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader
        title="System Settings"
        backgroundColor={colors.surface}
        textColor={colors.textPrimary}
        iconColor={colors.textPrimary}
      />

      <View style={styles.mainWrapper}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Search for a setting"
          containerStyle={{ marginBottom: 10 }}
        />

        <FlatList
          data={[{ id: 'settings_content' }]}
          keyExtractor={(item) => item.id}
          renderItem={() => {
            if (showPlaceholder) {
              return <FeatureSkeleton isDark={isDark} colors={colors} />;
            }

            if (filteredSecurityFeatures.length > 0) {
              return (
                <View>
                  <SettingsFeatures
                    page="system"
                    features={filteredSecurityFeatures}
                    switchValues={switchValues}
                    onSwitchChange={handleSwitchChange}
                    onProtectedAction={handleProtectedAction}
                    busySettingTitles={busyFeatureTitles}
                    disabledSettingTitles={disabledSettingTitles}
                  />
                  {showLogout && <LogOut />}
                </View>
              );
            }

            return (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No settings found matching "{searchQuery}"</Text>
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          overScrollMode="never"
          decelerationRate="normal"
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </View>

      {showPin && <PinVerify visible={showPin} onResult={handlePinApproval} onClose={() => setShowPin(false)} />}
      <FaceVerificationSheet
        isVisible={showFaceVerification}
        onClose={() => setShowFaceVerification(false)}
        onVerificationComplete={handleFaceVerificationComplete}
        onPreflightFallback={handleFaceVerificationFallback}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
});


return SystemSettings;
})();
const Settings = ({ route }) => {
  const page = route?.params?.page || route?.params?.settingsType || 'system';
  if (page === 'account') return <AccountSettingsPage />;
  if (page === 'reusable') return <ReusableSettingsPage route={route} />;
  return <SystemSettingsPage />;
};

export default Settings;