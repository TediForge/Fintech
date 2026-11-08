import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, Platform, StatusBar, StyleSheet, Dimensions, ActivityIndicator, Animated, Modal, SafeAreaView, RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '@components/common/SearchBar';
import OptionCard, { OptionCardSkeleton } from '@components/extra/OptionCard';
import { useTheme } from '@providers/ThemeProvider';

import DebitTransactionReviewScreen from '../../../transactions/review/DebitTransactionReviewScreen';
import { ScheduleReviewSheet } from '../schedule';
import LoadingScreen from '@components/Loading/LoadingScreen';
import ScreenHeader from '@components/headers/ScreenHeader';
import ValidationStatus from '@components/extra/ValidationStatus';
import AdvertSlider from '@components/ads/AdvertSlider';
import AmountSelector from '../../utilities/AmountSelector';
import ProviderInputCard from '../../utilities/ProviderInputCard';
import BillProviderSelection from '../../utilities/BillProviderSelection';
import ExtraServices from '@components/extra/ExtraServices';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { useVisualDelay } from '@hooks/useVisualDelay';

const api = apiConfig.baseUrl;

const { width, height } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

const BASE_URL = `${api}/v1/banking/bills`;

const CACHE_KEY = '@cache_electricity_providers';
const CACHE_EXPIRY = 4 * 60 * 60 * 1000; // 4 Hours

const presetAmounts = [1000, 2000, 5000, 10000, 15000, 20000];
const meterTypes = ["Prepaid", "Postpaid"];

// --- CUSTOM LOGOS OVERRIDE ---
const CUSTOM_LOGOS = {
  "ikeja": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRO67XEjr6aybwENzYyZSGv0tbIEANaIBdQeA&s",
  "eko": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQmp1bvU-Ao1bBBgu-9fNrAoGOn9Mpn7kMOw&s",
  "abuja": "https://gsubz.com/uploads/service/681168996.png",
  "kaduna": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvNPoVFDPT0Kkkb6_MGlKZ6hUlkDZijg7b4g&s",
  "kano": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQAl6-_FhFsrhr8R3k87wjKhnOa0ae9L-HvDw&s",
  "ibadan": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQAZg8u02uKdqFeZ5uLkpQQWzuey-hyBTQjfQ&s",
  "enugu": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYHNZE03h1hidl_2_bPwqWcvYLxR9eftEfzQ&s",
  "port": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMUMy7LlQEnUa7Yq4qxXvFO65v24AgwLcGBQ&s",
  "jos": "https://cdn.vanguardngr.com/wp-content/uploads/2020/11/JEDC.png",
  "yola": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTW98OeAy9d_FOQqaANrUPvUICUSAx3dKg64A&s",
  "aba": "https://abapower.com/logo.png",
  "benin": "https://beninelectric.com/wp-content/uploads/2022/10/BEDC-Logo-new-favico-1.png",
};

// Helper to get custom logo first
const getLogoUrl = (providerName) => {
  if (!providerName) return null;
  const nameLower = providerName.toLowerCase();
  for (const [key, url] of Object.entries(CUSTOM_LOGOS)) {
    if (nameLower.includes(key)) {
      return url;
    }
  }
  return null;
};

export default function ElectricityScreen({ navigation, route }) {
  const { user, loading: sessionLoading } = useApiClient();
  const { isDark } = useTheme();

  const [providers, setProviders] = useState([]); 
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [meterType, setMeterType] = useState('Prepaid'); 
  const [confirmData, setConfirmData] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmReviewData, setConfirmReviewData] = useState(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [schedulePayload, setSchedulePayload] = useState(null);
  
  const [isValidating, setIsValidating] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);

  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const showProviderSkeleton = useVisualDelay(!loadingProviders, 350);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY && Array.isArray(data) && data.length > 0) {
            setProviders(data);
            setSelectedProvider((current) => current || data[0]);
            setLoadingProviders(false);
            return;
          }
        }
      }

      const providersUrl = `${api}/v1/utilities/api-config/api-config?action=list_electricity_providers`;
      const response = await fetch(providersUrl, {
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
      const rawText = await response.text();
      console.log('[ElectricityScreen] provider response', {
        url: providersUrl,
        status: response.status,
        ok: response.ok,
        body: rawText,
      });

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseError) {
        console.error('[ElectricityScreen] invalid JSON response', parseError, rawText.slice(0, 500));
        return;
      }

      const nextProviders = Array.isArray(parsed?.providers)
        ? parsed.providers
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];

      const activeProviders = nextProviders.filter((provider) => {
        const isActive = provider?.is_active ?? provider?.isActive ?? true;
        return isActive !== false && isActive !== 0;
      });

      console.log('[ElectricityScreen] parsed providers count', activeProviders.length, 'status', parsed?.status);

      if (parsed?.status === 'success' && activeProviders.length > 0) {
        setProviders(activeProviders);
        setSelectedProvider((current) => current || activeProviders[0]);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: activeProviders,
        }));
        return;
      }

      console.warn('[ElectricityScreen] provider fetch returned no usable data', parsed);
      if (!forceRefresh && providers.length === 0) {
        setProviders([]);
      }
    } catch (err) {
      console.log('[ElectricityScreen] fetch providers error:', err);
    } finally {
      setLoadingProviders(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProviders(true);
  };

  const validateMeter = async () => {
    if (meterNumber.trim().length >= 8 && selectedProvider) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsValidating(true);
      setCustomerInfo(null);

      const params = new URLSearchParams({
        service: selectedProvider.service_code || '',
        meterno: meterNumber.trim(),
        metertype: meterType.toLowerCase(),
      });
      const verifyUrl = `${BASE_URL}/validation/electricity.php?${params.toString()}`;

      try {
        const response = await fetch(verifyUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        let result = {};
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          result = await response.json();
        } else {
          const text = await response.text();
          try {
            result = JSON.parse(text);
          } catch {
            result = { status: 'error', message: text || 'Could not verify meter number.' };
          }
        }

        const isSuccess =
          result?.status === 'success' ||
          result?.status === 200 ||
          result?.status === true;

        if (isSuccess) {
          setCustomerInfo({
            name: result.customer_name || result.customerName || 'Verified Customer',
            address: result.address || '',
            meterNumber: result.meter_number || result.meterNumber || meterNumber.trim(),
            service: result.service || selectedProvider.service_code,
            meterType: result.metertype || meterType.toLowerCase(),
            error: false,
          });
        } else {
          const errorMessage =
            result?.message ||
            result?.error ||
            'Could not verify meter number.';
          setCustomerInfo({ error: errorMessage });
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Verification aborted');
        } else {
          setCustomerInfo({ error: 'Network error during verification.' });
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsValidating(false);
        }
      }
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      validateMeter();
    }, 1200); 

    return () => {
      clearTimeout(delayDebounceFn);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [meterNumber, selectedProvider, meterType]);

  const handleProceed = (selectedAmount) => {
    const finalAmount = selectedAmount || amount;

    if (!selectedProvider) return Alert.sheet('Error', 'Please select a provider.');
    if (!customerInfo || customerInfo.error) return Alert.sheet('Error', 'Please enter a valid meter number.');
    if (!finalAmount || parseFloat(finalAmount) < (selectedProvider.min_amount || 1000)) {
       return Alert.sheet('Error', `Minimum amount is ₦${selectedProvider.min_amount || 1000}.`);
    }

    setProcessing(true);
    if (selectedAmount) setAmount(selectedAmount.toString());

    const dataPayload = {
      request: 'electricity',
      disco: selectedProvider.company_name,
      service_code: selectedProvider.service_code,
      meter_number: meterNumber,
      meter_type: meterType.toLowerCase(),
      customer_name: customerInfo.name,
      customer_address: customerInfo.address,
      amount: parseFloat(finalAmount),
      fee: 0, 
    };

    if (route?.params?.schedule) {
      setProcessing(false);
      setSchedulePayload({
        billType: 'electricity',
        billPayload: {
          service_code: selectedProvider.service_code,
          meter_number: meterNumber,
          meter_type: meterType.toLowerCase(),
          amount: parseFloat(finalAmount),
        },
        reviewData: [
          { label: 'Amount', value: `₦${Number(finalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Provider', value: selectedProvider.company_name },
          { label: 'Customer Name', value: customerInfo.name },
          { label: 'Meter Number', value: meterNumber },
          { label: 'Meter Type', value: meterType },
        ],
      });
      setScheduleVisible(true);
      return;
    }

    setTimeout(() => {
      setProcessing(false);
      setConfirmData(dataPayload);
      setConfirmReviewData([
        { label: 'Amount', value: `₦${Number(dataPayload.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: 'Provider', value: dataPayload.disco },
        { label: 'Customer Name', value: dataPayload.customer_name },
        { label: 'Meter Number', value: dataPayload.meter_number },
        { label: 'Meter Type', value: dataPayload.meter_type ? dataPayload.meter_type.charAt(0).toUpperCase() + dataPayload.meter_type.slice(1) : '' },
      ]);
      setConfirmVisible(true);
    }, 800);
  };

  const filteredProviders = useMemo(() => {
    return providers.filter(c =>
      c.company_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [providers, searchQuery]);

  const handleSelectProvider = (provider) => {
    setSelectedProvider(provider);
    setCustomerInfo(null);
    setStep(1);
  };

  const handleBack = () => {
    if (step === 1) {
      setStep(0);
    } else {
      navigation.goBack();
    }
  };

  if (sessionLoading || loadingProviders) return <LoadingScreen visible={true} message="Loading Utilities..." />;

  if (step === 0) {
    return (
      <BillProviderSelection
        isDark={isDark}
        onClose={handleBack}
        eyebrow="Electricity Bill"
        title="Select a Provider"
        description="Select the electricity provider for your bill payment"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search for a provider"
        items={filteredProviders}
        isLoading={showProviderSkeleton}
        itemKey={(item) => `provider-${item.service_code}`}
        itemTitle={(item) => item.company_name}
        itemSubtitle={() => 'Electricity Provider'}
        itemImage={(item) => getLogoUrl(item.company_name) || item.logo_url || 'https://cdn-icons-png.flaticon.com/128/1243/1243929.png'}
        selectedItem={selectedProvider}
        onSelect={handleSelectProvider}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[BRAND_COLOR]}
            tintColor={BRAND_COLOR}
          />
        }
      />
    );
  }

  return (
    <>
      <View style={styles.container}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? ['#121212', '#121212'] : ['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
        <ScreenHeader title="Electricity Bill" onBack={step === 1 ? () => setStep(0) : undefined} backgroundColor={isDark ? "#121212" : "#eff7f4"} textColor={isDark ? "#E4E4E4" : "#000"} iconColor={isDark ? "#E4E4E4" : "#000"} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <AdvertSlider /> 

          <ProviderInputCard
            label="Provider & Meter Number"
            imageUri={getLogoUrl(selectedProvider?.company_name) || selectedProvider?.logo_url || 'https://cdn-icons-png.flaticon.com/128/1243/1243929.png'}
            onProviderPress={() => setStep(0)}
            value={meterNumber}
            onChangeText={setMeterNumber}
            placeholder="Enter Meter Number"
            keyboardType="numeric"
            isDark={isDark}
            isButton
            onButtonPress={validateMeter}
            buttonDisabled={isValidating}
          />

                      <ValidationStatus 
              isValidating={isValidating} 
              customerInfo={customerInfo} 
              isDark={isDark}
            />

          <AmountSelector 
            amount={amount}
            setAmount={setAmount}
            title="Select Amount"
            isDark={isDark}
            showCashback={false}
            onSubmit={handleProceed}
            data={presetAmounts}
            bannerSource="https://paysmart.com.ng/assets/images/trybanner4.png"
          />
          
          <ExtraServices currentScreen="ElectricityScreen" showUssdEnquiry={false} isDark={isDark} />
        </ScrollView>

      </View>

      <LoadingScreen visible={processing} message="Preparing payment..." />
      {confirmData && (
        <DebitTransactionReviewScreen 
          visible={confirmVisible} 
          data={confirmData} 
          reviewData={confirmReviewData}
          onClose={() => setConfirmVisible(false)} 
        />
      )}
    </>
  );
      <ScheduleReviewSheet
        visible={scheduleVisible}
        payload={schedulePayload}
        reviewData={schedulePayload?.reviewData}
        onClose={() => setScheduleVisible(false)}
        onSubmitted={() => navigation.goBack()}
      />
} 

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 * scale, paddingTop: 20, paddingBottom: 40 },
  scrollContent2: {
    paddingHorizontal: 20 * scale,
    paddingBottom: 40,
    paddingTop: 5,
  },
  
  // Unified Card Styles
  unifiedCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    marginTop: 10,
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  labelRow: { marginBottom: 12 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.3, },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  networkSelector: { flexDirection: 'row', alignItems: 'center', paddingRight: 5 },
  logoWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  providerLogo: { width: 36, height: 36, borderRadius: 18, resizeMode: 'contain' },
  dropIcon: { marginLeft: 4 },
  divider: { width: 1, opacity: 0.5, height: 15, backgroundColor: '#E0E0E0', marginHorizontal: 5 },
  phoneNumberInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
    paddingVertical: 5,
  },
 verifyButton: {
     backgroundColor: BRAND_COLOR,
     paddingHorizontal: 12,
     height: 35.2,
     borderRadius: 100,
     alignItems: 'center',
     justifyContent: 'center',
     width: 72, 
     marginLeft: 10,
     shadowColor: BRAND_COLOR,
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.1,
     shadowRadius: 3,
     elevation: 2,
   },
  verifyButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  validatingBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 10 },
  validatingText: { fontSize: 12, color: BRAND_COLOR, marginLeft: 8, fontWeight: '600' },
  
  customerCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: BRAND_COLOR + '20' },
  customerCardError: { borderColor: '#D32F2F40', backgroundColor: '#FFF8F8' },
  customerCardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F5F3', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  customerCardContent: { flex: 1 },
  customerLabel: { fontSize: 10, color: '#777', fontWeight: '700' },
  customerName: { fontSize: 14, fontWeight: '700', color: '#111', marginTop: 2 },
  customerAddress: { fontSize: 11, color: '#666', marginTop: 2 },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    paddingBottom: 30,
    maxHeight: height * 0.7,
  },
  dragIndicator: { width: 40 * scale, height: 5 * scale, backgroundColor: '#E0E0E0', borderRadius: 3, alignSelf: 'center', marginTop: 15 * scale },
  sheetHeader: { alignItems: 'center', paddingTop: 10 * scale, paddingBottom: 15 * scale },
  sheetMainTitle: { fontSize: 18 * scale, fontWeight: '700', color: '#1A1A1A' },
  sheetScrollContent: { paddingHorizontal: 20 * scale, paddingBottom: 70, paddingTop: 10 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16 * scale,
    borderRadius: 20 * scale,
    marginBottom: 12 * scale,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  iconCircleWrapper: { width: 45 * scale, height: 45 * scale, borderRadius: 23 * scale, backgroundColor: '#F0F7F4', justifyContent: 'center', alignItems: 'center' },
  innerIcon: { width: 30 * scale, height: 30 * scale, resizeMode: 'contain' },
  textContainer: { flex: 1, marginLeft: 15 * scale },
  optionTitleText: { fontSize: 15 * scale, fontWeight: '700', color: '#1A1C1E' },
  chevronWrapper: { marginLeft: 10 * scale },

  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    width: '100%',
    flex: 1,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 50,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: BRAND_COLOR,
  },
  heroSection: {
    marginBottom: 15,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_COLOR,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: BRAND_COLOR,
    lineHeight: 24,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 17,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: BRAND_COLOR,
    height: "100%",
  },
  permissionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  cardInternalWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  leftInfoSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  permissionIcon: {
    width: 25,
    height: 25,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  textMetadataContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_COLOR,
    marginBottom: 2,
  },
  permissionDesc: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: BRAND_COLOR,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND_COLOR,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: 'center',
  }
});