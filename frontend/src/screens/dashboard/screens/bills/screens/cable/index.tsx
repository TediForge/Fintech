import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
  Modal,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '@components/common/SearchBar';
import { useTheme } from '@providers/ThemeProvider';

import DebitTransactionReviewScreen from '../../../transactions/review/DebitTransactionReviewScreen';
import { ScheduleReviewSheet } from '../schedule';
import LoadingScreen from '@components/Loading/LoadingScreen';
import ScreenHeader from '@components/headers/ScreenHeader';
import AdvertSlider from '@components/ads/AdvertSlider';
import ExtraServices from '@components/extra/ExtraServices';
import OptionCard from '@components/extra/OptionCard';
import AmountSelector from '../../utilities/AmountSelector';
import ProviderInputCard from '../../utilities/ProviderInputCard';
import BillProviderSelection from '../../utilities/BillProviderSelection';
import useApiClient from '@hooks/apiClient';
import ValidationStatus from '@components/extra/ValidationStatus';
import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;

const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

const BASE_API_URL = `${api}/v1/banking/bills`;

const CACHE_KEY = '@cache_cable_tv_plans';
const CACHE_EXPIRY = 4 * 60 * 60 * 1000; // 4 Hours

const presetAmounts = [1000, 2000, 5000, 10000, 15000, 20000];

// --- CUSTOM LOGOS OVERRIDE ---
const CUSTOM_LOGOS = {
  "dstv": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSSGqu7CJWI_bjc8BzBhidZ5t9o27-xpWqKbQ&s",
  "gotv": "https://yt3.googleusercontent.com/t5tj2_aVphUlbgLG4VVxmTEmgF4x2wGhL3DuTvTpC4wTJlFu1zW714Z1ZFQ14OUYWAMh5UPd=s900-c-k-c0x00ffffff-no-rj",
  "startimes": "https://pbs.twimg.com/profile_images/3192794606/b40f3fd4fac95344aea9c047fa97a816_400x400.png",
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

export default function CableTvScreen({ navigation, route }) {
  const { user, loading: sessionLoading } = useApiClient();
  const { isDark } = useTheme();
  const [providers, setProviders] = useState([]);
  const [allBillItems, setAllBillItems] = useState([]);
  const [loadingBillers, setLoadingBillers] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedBouquet, setSelectedBouquet] = useState(null);
  const [smartCardNumber, setSmartCardNumber] = useState('');
  
  const [confirmData, setConfirmData] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmReviewData, setConfirmReviewData] = useState(null);
    const [scheduleVisible, setScheduleVisible] = useState(false);
    const [schedulePayload, setSchedulePayload] = useState(null);
  
  const [isValidating, setIsValidating] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTvProviders();
  }, []);

  const fetchTvProviders = async () => {
    try {
      // Try to load from cache first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          processPlansData(data);
          setLoadingBillers(false);
          return;
        }
      }

      const response = await fetch(`${BASE_API_URL}/fetching/cable-tv.php`);
      const res = await response.json();
      
      if (res.status === 'success') {
        processPlansData(res.plans || []);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: res.plans || [] }));
      }
    } catch (err) {
      console.error("Fetch Error", err);
      Alert.sheet("Error", "Could not load TV providers.");
    } finally {
      setLoadingBillers(false);
    }
  };

  const processPlansData = (plans) => {
    setAllBillItems(plans);
    
    const unique = [];
    const seen = new Set();
    plans.forEach(item => {
      if (!seen.has(item.service_code)) {
        seen.add(item.service_code);
        unique.push(item);
      }
    });
    setProviders(unique);
    if (unique.length > 0) setSelectedProvider(unique[0]);
  };

  const handleVerify = async () => {
    if (!smartCardNumber || smartCardNumber.trim().length < 8) {
      return Alert.sheet('Invalid IUC', 'Please enter a valid SmartCard or IUC number');
    }
    if (!selectedProvider) {
      return Alert.sheet('Error', 'Please select a provider first');
    }

    const defaultVariation = allBillItems.find(item => item.service_code === selectedProvider.service_code);
    if (!defaultVariation) return;

    setIsValidating(true);
    setCustomerInfo(null);

    const params = new URLSearchParams({
      service: selectedProvider.service_code || '',
      smartno: smartCardNumber.trim(),
      variation: defaultVariation.variation_code || '',
    });
    const url = `${BASE_API_URL}/validation/cable-tv.php?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
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
          result = { status: 'error', message: text || 'Verification failed' };
        }
      }

      const isSuccess = result?.status === 'success' || result?.status === 101 || result?.status === true;

      if (isSuccess) {
        setCustomerInfo({
          name: result.customer_name || result.customerName || 'Verified Customer',
          status: result.message || 'Account verification successful',
          plan: result.current_plan || result.currentPlan || '',
          dueDate: result.due_date || result.dueDate || '',
          smartNo: result.smart_no || result.smartNo || smartCardNumber.trim(),
          service: result.service || selectedProvider.provider,
          error: false,
        });
      } else {
        setCustomerInfo({ error: result.message || result.error || 'Invalid SmartCard/IUC Number' });
      }
    } catch (error) {
      setCustomerInfo({ error: 'Verification failed' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleProceed = (bouquet) => {
    setSelectedBouquet(bouquet);
    
    if (smartCardNumber.trim().length < 8) {
        return Alert.sheet('Error', 'Please enter your SmartCard/IUC Number first.');
    }
    if (!customerInfo || customerInfo.error) {
        return Alert.sheet('Error', 'Please verify your account first.');
    }
    setProcessing(true);
    const dataPayload = {
      request: 'cableTv',
      provider: selectedProvider.provider,
      service_code: selectedProvider.service_code,
      plan_name: bouquet.plan_name,
      variation_code: bouquet.variation_code,
      smart_card: smartCardNumber,
      customer_name: customerInfo.name,
      amount: bouquet.price,
    };
    if (route?.params?.schedule) {
      setProcessing(false);
      setSchedulePayload({
        billType: 'cable',
        billPayload: {
          service_code: selectedProvider.service_code,
          smart_card: smartCardNumber,
          variation_code: bouquet.variation_code,
          amount: Number(bouquet.price),
        },
        reviewData: [
          { label: 'Amount', value: `₦${Number(bouquet.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Provider', value: selectedProvider.provider },
          { label: 'Plan', value: bouquet.plan_name },
          { label: 'SmartCard/IUC', value: smartCardNumber },
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
        { label: 'Provider', value: dataPayload.provider },
        { label: 'Plan', value: dataPayload.plan_name },
        { label: 'SmartCard/IUC', value: dataPayload.smart_card },
      ]);
      setConfirmVisible(true);
    }, 800);
  };

  const filteredProviders = useMemo(() => {
    return providers.filter(c =>
      c.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [providers, searchQuery]);

  const handleSelectProvider = (provider) => {
    setSelectedProvider(provider);
    setSelectedBouquet(null);
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

  const currentBouquets = allBillItems.filter(item =>
    item.service_code === selectedProvider?.service_code
  );

  if (sessionLoading || loadingBillers) return <LoadingScreen visible={true} message="Loading Cable TV..." />;

  if (step === 0) {
    return (
      <BillProviderSelection
        isDark={isDark}
        onClose={handleBack}
        eyebrow="Cable TV"
        title="Select a Provider"
        description="Select the cable TV provider for your subscription"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search for a provider"
        items={filteredProviders}
        itemKey={(item) => `provider-${item.service_code}`}
        itemTitle={(item) => item.provider}
        itemSubtitle={() => 'Cable TV Provider'}
        itemImage={(item) => getLogoUrl(item.provider) || item.logo_url || 'https://cdn-icons-png.flaticon.com/128/1243/1243929.png'}
        selectedItem={selectedProvider}
        onSelect={handleSelectProvider}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#121212', '#121212'] : ['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader 
        title="Cable TV" 
        backgroundColor={isDark ? "#121212" : "#eff7f4"} 
        textColor={isDark ? "#E4E4E4" : "#000"} 
        iconColor={isDark ? "#E4E4E4" : "#000"} 
        onBack={step === 1 ? () => setStep(0) : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <AdvertSlider />
        <ProviderInputCard
          label="Provider & SmartCard Number"
          imageUri={getLogoUrl(selectedProvider?.provider) || selectedProvider?.logo_url || 'https://cdn-icons-png.flaticon.com/128/1243/1243929.png'}
          onProviderPress={() => setStep(0)}
          value={smartCardNumber}
          onChangeText={setSmartCardNumber}
          placeholder="IUC / SmartCard Number"
          keyboardType="numeric"
          isDark={isDark}
          isButton
          onButtonPress={handleVerify}
          buttonDisabled={isValidating}
        />
                            <ValidationStatus 
              isValidating={isValidating} 
              customerInfo={customerInfo} 
              isDark={isDark}
            />

        <AmountSelector 
          title="Select Bouquet"
          showCashback={false}
          showManualInput={false}
          isDark={isDark}
          bannerSource="https://paysmart.com.ng/assets/images/trybanner1.png"
          data={currentBouquets.map(b => ({
            id: b.variation_code,
            amount: Number(b.price),
            subText: b.plan_name.replace(/dstv|gotv|startimes/gi, '').trim(),
            original: b
          }))}
          selectedId={selectedBouquet?.variation_code}
          onItemPress={(item) => handleProceed(item.original)}
        />
        
        <ExtraServices
        currentScreen="CableTvScreen"
        showUssdEnquiry={false}
        isDark={isDark}
        />
      </ScrollView>
      <LoadingScreen visible={processing} message="Preparing transaction..." />
      {confirmData && <DebitTransactionReviewScreen visible={confirmVisible} data={confirmData} reviewData={confirmReviewData} onClose={() => setConfirmVisible(false)} />}
      <ScheduleReviewSheet
        visible={scheduleVisible}
        payload={schedulePayload}
        reviewData={schedulePayload?.reviewData}
        onClose={() => setScheduleVisible(false)}
        onSubmitted={() => navigation.goBack()}
      />
    </View>
  );
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
  divider: { width: 1, height: 15, backgroundColor: '#E0E0E0', marginHorizontal: 5 },
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
  customerAddress: { fontSize: 11, color: BRAND_COLOR, fontWeight: '600' },
  amountContainerMain: {
    zIndex: 1,
  },
  bannerContainer: {
    zIndex: 0,
    marginBottom: -25,
    width: '100%',
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  amountContainer: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16, borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1, },
  label: { fontSize: 11, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 15 },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amountTile: {
    position: 'relative',
    width: '31%',
    height: 60,
    backgroundColor: 'rgba(209, 228, 221, 0.3)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1,
  },
  activeAmountTile: { backgroundColor: 'rgba(209, 228, 221, 0.7)' },
  amountText: { fontSize: 13, fontWeight: '700', color: '#333' },
  activeAmountText: { color: '#222' },
  subAmountText: { fontSize: 9, fontWeight: '800', marginTop: 2, color: '#333' },
  // --- Modal / Sheet Styles ---
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    paddingBottom: 70,
    maxHeight: 355,
  },
  dragIndicator: {
    width: 40 * scale,
    height: 5 * scale,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 15 * scale
  },
  safeArea: { width: '100%' },
  sheetHeader: { alignItems: 'center', paddingTop: 10 * scale, paddingBottom: 15 * scale },
  sheetMainTitle: { fontSize: 18 * scale, fontWeight: '700', color: '#1A1A1A' },
  bankScrollContent: { paddingHorizontal: 20 * scale, paddingBottom: 10, paddingTop: 10, },
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
  iconCircleWrapper: {
    width: 45 * scale,
    height: 45 * scale,
    borderRadius: 23 * scale,
    backgroundColor: '#F0F7F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerIcon: { width: 30 * scale, height: 30 * scale, resizeMode: 'contain' },
  textContainer: { flex: 1, marginLeft: 15 * scale },
  optionTitleText: { fontSize: 15 * scale, fontWeight: '700', color: '#1A1C1E' },
  chevronWrapper: { marginLeft: 10 * scale },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: 'center' },
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
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
    borderRadius: 25,
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