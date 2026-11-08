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
import ExtraServices from '@components/extra/ExtraServices';
import OptionCard from '@components/extra/OptionCard';
import DebitTransactionReviewScreen from '../../../transactions/review/DebitTransactionReviewScreen';
import { ScheduleReviewSheet } from '../schedule';
import LoadingScreen from '@components/Loading/LoadingScreen';
import ScreenHeader from '@components/headers/ScreenHeader';
import AdvertSlider from '@components/ads/AdvertSlider';
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

const CACHE_KEY = '@cache_betting_providers';
const CACHE_EXPIRY = 4 * 60 * 60 * 1000; // 4 Hours

const presetAmounts = [100, 500, 1000, 2000, 5000, 10000];

export default function BettingScreen({ navigation, route }) {
  const { user, loading: sessionLoading } = useApiClient();
  const { isDark } = useTheme();

  const [providers, setProviders] = useState([]); 
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [processing, setProcessing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');

  const [confirmData, setConfirmData] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmReviewData, setConfirmReviewData] = useState(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [schedulePayload, setSchedulePayload] = useState(null);
  
  const [isValidating, setIsValidating] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);

  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch Betting Providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_EXPIRY) {
            setProviders(data);
            if (data.length > 0) setSelectedProvider(data[0]);
            setLoadingProviders(false);
            return;
          }
        }

        const response = await fetch(`${api}/v1/utilities/api-config/api-config?action=list_betting_providers`);
        const res = await response.json();
        if (res.status === 'success' && res.providers.length > 0) {
          setProviders(res.providers);
          setSelectedProvider(res.providers[0]);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: res.providers }));
        }
      } catch (err) {
        Alert.sheet("Connection Error", "Could not load betting platforms.");
      } finally {
        setLoadingProviders(false);
      }
    };
    fetchProviders();
  }, []);

  // 2. ID Validation Logic
  useEffect(() => {
    const validateAccount = async () => {
      if (customerId.trim().length >= 5 && selectedProvider) {
        setIsValidating(true);
        setCustomerInfo(null);
        
        try {
          const url = `${api}/v1/utilities/api-config/api-config?action=verify_bet_account&service=${selectedProvider.service_code}&userid=${customerId.trim()}`;
          const response = await fetch(url);
          const result = await response.json();

          if (result.status === 'success') {
            setCustomerInfo({
              name: result.customer_name || "Verified Account",
              error: false
            });
          } else {
            setCustomerInfo({ error: result.message || "Invalid Betting ID" });
          }
        } catch (error) {
          setCustomerInfo({ error: "Verification failed. Try again." });
        } finally {
          setIsValidating(false);
        }
      }
    };

    const delayDebounceFn = setTimeout(() => validateAccount(), 1000);
    return () => clearTimeout(delayDebounceFn);
  }, [customerId, selectedProvider]);

  // === EXACT VERIFY BUTTON LOGIC FROM CABLE TV SCREEN ===
  const handleVerify = async () => {
    if (!customerId || customerId.trim().length < 5) {
      return Alert.sheet('Invalid ID', 'Please enter a valid User ID / Account ID');
    }
    if (!selectedProvider) {
      return Alert.sheet('Error', 'Please select a provider first');
    }

    setIsValidating(true);
    setCustomerInfo(null);
    
    const url = `${api}/v1/utilities/api-config/api-config?action=verify_bet_account&service=${selectedProvider.service_code}&userid=${customerId.trim()}`;
    
    try {
      const response = await fetch(url);
      const result = await response.json();
      if (result.status === 'success') {
        setCustomerInfo({
          name: result.customer_name || "Verified Account",
          error: false
        });
      } else {
        setCustomerInfo({ error: result.message || "Invalid Betting ID" });
      }
    } catch (error) {
      setCustomerInfo({ error: "Verification failed. Try again." });
    } finally {
      setIsValidating(false);
    }
  };

  const handleProceed = (selectedAmount) => {
    const finalAmount = selectedAmount || amount;

    if (!selectedProvider) return Alert.sheet('Error', 'Please select a provider.');
    if (!customerInfo || customerInfo.error) {
       return Alert.sheet('Error', 'Please enter a valid User ID and wait for verification.');
    }
    if (!finalAmount || parseFloat(finalAmount) < 100) {
       return Alert.sheet('Error', 'Minimum amount is ₦100.');
    }

    setProcessing(true);
    
    if (selectedAmount) setAmount(selectedAmount.toString());

    const dataPayload = {
      request: 'betting',
      provider: selectedProvider.display_name,
      service_code: selectedProvider.service_code,
      customer_id: customerId,
      customer_name: customerInfo.name,
      amount: parseFloat(finalAmount),
      fee: 50,
    };

    if (route?.params?.schedule) {
      setProcessing(false);
      setSchedulePayload({
        billType: 'betting',
        billPayload: {
          service_code: selectedProvider.service_code,
          customer_id: customerId,
          amount: parseFloat(finalAmount),
        },
        reviewData: [
          { label: 'Amount', value: `₦${Number(finalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Platform', value: selectedProvider.display_name },
          { label: 'User ID', value: customerId },
          { label: 'Customer', value: customerInfo.name },
          { label: 'Transaction Fee', value: '₦50.00', hasInfoIcon: true, infoMessage: 'This charge covers processing of this payment' },
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
        { label: 'Platform', value: dataPayload.provider },
        { label: 'User ID', value: dataPayload.customer_id },
        { label: 'Customer', value: dataPayload.customer_name },
        { label: 'Transaction Fee', value: `₦${Number(dataPayload.fee || 0).toLocaleString()}`, hasInfoIcon: true, infoMessage: 'This charge covers processing of this payment' }
      ]);
      setConfirmVisible(true);
    }, 1000);
  };

  const filteredProviders = useMemo(() => {
    return providers.filter(c =>
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
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

  if (sessionLoading || loadingProviders) return <LoadingScreen visible={true} message="Betting Platforms.." />;

  if (step === 0) {
    return (
      <BillProviderSelection
        isDark={isDark}
        onClose={handleBack}
        eyebrow="Bets Funding"
        title="Select a Platform"
        description="Select the betting platform for your funding"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search for a platform"
        items={filteredProviders}
        itemKey={(item) => `provider-${item.service_code}`}
        itemTitle={(item) => item.display_name}
        itemSubtitle={() => 'Betting Platform'}
        itemImage={(item) => item.logo_url}
        selectedItem={selectedProvider}
        onSelect={handleSelectProvider}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#121212', '#121212'] : ['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader title="Fund Your Bets" onBack={step === 1 ? () => setStep(0) : undefined}  backgroundColor={isDark ? "#121212" : "#eff7f4"} textColor={isDark ? "#E4E4E4" : "#000"} iconColor={isDark ? "#E4E4E4" : "#000"} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <AdvertSlider />
        
        <ProviderInputCard
          label="Platform & User ID"
          imageUri={selectedProvider?.logo_url}
          onProviderPress={() => setStep(0)}
          value={customerId}
          onChangeText={setCustomerId}
          placeholder="User ID / Account ID"
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
          amount={amount}
          setAmount={setAmount}
          title="Select Amount"
          isDark={isDark}
          showCashback={false}
          onSubmit={handleProceed}
          data={presetAmounts}
          bannerSource="https://paysmart.com.ng/assets/images/trybanner2.png"
        />

        <ExtraServices currentScreen="BettingScreen" showUssdEnquiry={false} isDark={isDark} />
      </ScrollView>

      <LoadingScreen visible={processing} message="Preparing payment..." />
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
    overflow: 'hidden'
  },
  providerLogo: { width: 38, height: 38, resizeMode: 'cover' },
  dropIcon: { marginLeft: 4 },
  divider: { width: 1, height: 15, backgroundColor: '#E0E0E0', marginHorizontal: 5 },
  phoneNumberInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    paddingVertical: 5,
  },

  // === EXACT VERIFY BUTTON STYLES FROM CABLE TV SCREEN ===
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

  input: { flex: 1, paddingHorizontal: 15, fontSize: 15, color: '#000', fontWeight: '600' },
  validatingBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 10 },
  validatingText: { fontSize: 12, color: BRAND_COLOR, marginLeft: 8, fontWeight: '600' },
  customerCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: BRAND_COLOR + '20' },
  customerCardError: { borderColor: '#D32F2F40', backgroundColor: '#FFF8F8' },
  customerCardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F5F3', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  customerCardContent: { flex: 1 },
  customerLabel: { fontSize: 10, color: '#777', fontWeight: '700' },
  customerName: { fontSize: 14, fontWeight: '700', color: '#111', marginTop: 2 },
  
  // --- Modal / Sheet Styles ---
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    paddingBottom: 20,
    maxHeight: 550,
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
  bankScrollContent: { paddingHorizontal: 20 * scale, paddingBottom: 70, paddingTop: 10 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12 * scale,
    borderRadius: 18 * scale,
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
    overflow: 'hidden'
  },
  innerIcon: { width: 45 * scale, height: 45 * scale, resizeMode: 'cover' },
  textContainer: { flex: 1, marginLeft: 15 * scale },
  optionTitleText: { fontSize: 15 * scale, fontWeight: '700', color: '#1A1C1E' },
  checkmarkWrapper: { marginLeft: 10 * scale },

  gradientBackground: {
    flex: 1,
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