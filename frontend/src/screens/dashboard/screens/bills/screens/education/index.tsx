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
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ExtraServices from '@components/extra/ExtraServices';
import OptionCard from '@components/extra/OptionCard';
import { useTheme } from '@providers/ThemeProvider';
import DebitTransactionReviewScreen from '../../../transactions/review/DebitTransactionReviewScreen';
import { ScheduleReviewSheet } from '../schedule';
import LoadingScreen from '@components/Loading/LoadingScreen';
import SearchBar from '@components/common/SearchBar';
import ScreenHeader from '@components/headers/ScreenHeader';
import AdvertSlider from '@components/ads/AdvertSlider';
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

const CACHE_KEY = '@cache_education_providers';
const CACHE_EXPIRY = 4 * 60 * 60 * 1000; // 4 Hours

// --- CUSTOM LOGOS OVERRIDE (added exactly as requested) ---
const CUSTOM_LOGOS = {
  "jamb": "https://efacility.jamb.gov.ng/assets/admin/img/logo_big.png",
  "waec": "https://www.waec.org/assets/waec-logo-single.png",
  "neco": "https://neco.gov.ng/assets/neco-logo.df6f9256.png",
  "nabteb": "https://nabteb.gov.ng/wp-content/uploads/2021/09/logonew.png",
};

// --- CUSTOM MAIN PROVIDERS ARRAY (added exactly as requested) ---
const CUSTOM_PROVIDERS = [
  {
    key: "jamb",
    name: "JAMB",
    logo: "https://efacility.jamb.gov.ng/assets/admin/img/logo_big.png",
    isActive: true
  },
  {
    key: "waec",
    name: "WAEC",
    logo: "https://www.waec.org/assets/waec-logo-single.png",
    isActive: true
  },
  {
    key: "neco",
    name: "NECO",
    logo: "https://neco.gov.ng/assets/neco-logo.df6f9256.png",
    isActive: true
  },
  {
    key: "nabteb",
    name: "NABTEB",
    logo: "https://nabteb.gov.ng/wp-content/uploads/2021/09/logonew.png",
    isActive: false
  },
];

export default function EducationScreen({ navigation, route }) {
  const { user, loading: sessionLoading } = useApiClient();
  const { isDark } = useTheme();

  const [providers, setProviders] = useState([]); 
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false); 
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [profileCode, setProfileCode] = useState('');

  const [confirmData, setConfirmData] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmReviewData, setConfirmReviewData] = useState(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [schedulePayload, setSchedulePayload] = useState(null);
  
  const [isValidating, setIsValidating] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);

  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // NEW STATES FOR TWO-LEVEL PROVIDER SELECTION (added exactly as requested)
  const [mainProviders, setMainProviders] = useState([]);
  const [selectedMain, setSelectedMain] = useState(null);
  const [currentServices, setCurrentServices] = useState([]);

  const fetchProviders = async (forceRefresh = false) => {
    if (!forceRefresh) {
      setLoadingProviders(true);
    }

    try {
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const cachedData = Array.isArray(parsed?.data) ? parsed.data : [];
            const cacheIsFresh = Date.now() - (parsed?.timestamp || 0) < CACHE_EXPIRY;
            if (cacheIsFresh && cachedData.length > 0) {
              console.log('[EducationScreen] using cached providers', cachedData.length);
              processEducationProviders(cachedData);
              setLoadingProviders(false);
            }
          } catch (cacheError) {
            console.warn('[EducationScreen] cache parse failed:', cacheError);
          }
        }
      }

      console.log('[EducationScreen] fetching providers', { forceRefresh });
      const response = await fetch(`${api}/v1/utilities/api-config/api-config?action=list_education_providers`);
      const rawText = await response.text();
      console.log('[EducationScreen] raw response', rawText.slice(0, 2000));

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseError) {
        console.error('[EducationScreen] invalid JSON response', parseError, rawText.slice(0, 500));
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

      console.log('[EducationScreen] parsed providers count', activeProviders.length, 'status', parsed?.status);

      if (parsed?.status === 'success' && activeProviders.length > 0) {
        processEducationProviders(activeProviders);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: activeProviders,
        }));
        return;
      }

      console.warn('[EducationScreen] provider fetch returned no usable data', parsed);
      if (!forceRefresh && providers.length === 0) {
        processEducationProviders(CUSTOM_PROVIDERS.filter((provider) => provider.isActive));
      }
    } catch (err) {
      console.log('[EducationScreen] fetch providers error:', err);
      if (!forceRefresh && providers.length === 0) {
        processEducationProviders(CUSTOM_PROVIDERS.filter((provider) => provider.isActive));
      }
    } finally {
      setLoadingProviders(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProviders(true);
  };

  const processEducationProviders = (backendProviders) => {
    setProviders(backendProviders);

    // Derive main providers from custom array + backend data + isActive
    const activeMains = CUSTOM_PROVIDERS.filter(main => main.isActive);
    const filteredMains = activeMains.filter(main => 
      backendProviders.some(p => p.display_name.toLowerCase().includes(main.key))
    );
    setMainProviders(filteredMains);
  };

    // Helper to get custom logo first (provider name lowercase include check)
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

  // Auto-verify non-JAMB providers
  useEffect(() => {
    if (selectedProvider && step === 2) {
      const isJamb = selectedProvider.service_name?.toLowerCase() === 'jamb';
      if (!isJamb) {
        setCustomerInfo({
          name: "Verified Account",
          error: false
        });
      } else {
        setCustomerInfo(null);
      }
    }
  }, [selectedProvider, step]);

  // === VERIFY BUTTON (ONLY FOR JAMB) ===
  const handleVerify = async () => {
    if (!profileCode || profileCode.trim().length < 8) {
      return Alert.sheet('Invalid Code', 'Please enter a valid Profile Code');
    }
    if (!selectedProvider) {
      return Alert.sheet('Error', 'Please select a provider first');
    }

    setIsValidating(true);
    setCustomerInfo(null);
    
    const url = `${api}/v1/utilities/api-config/api-config?action=verify_education_account&service=${selectedProvider.service_name}&product_code=${selectedProvider.product_code}&profilecode=${profileCode.trim()}`;
    
    try {
      const response = await fetch(url);
      const result = await response.json();
      if (result.status === 'success') {
        setCustomerInfo({
          name: result.customer_name,
          error: false
        });
      } else {
        setCustomerInfo({ error: result.message || "Invalid ID/Profile Code" });
      }
    } catch (error) {
      setCustomerInfo({ error: "Verification failed" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleProceed = () => {
    if (!selectedProvider) return Alert.sheet('Error', 'Please select an exam provider.');

    const isJamb = selectedProvider.service_name?.toLowerCase() === 'jamb';

    if (isJamb && (!customerInfo || customerInfo.error)) {
      return Alert.sheet('Error', 'Please verify your Profile Code first.');
    }

    setProcessing(true);

    const dataPayload = {
      request: 'examination',
      provider: selectedProvider.service_name.toUpperCase(),
      service: selectedProvider.display_name,
      customer_id: profileCode,
      customer_name: customerInfo?.name || "Verified Account",
      amount: parseFloat(selectedProvider.price),
      product_code: selectedProvider.product_code,
      fee: 0, 
    };

    if (route?.params?.schedule) {
      setProcessing(false);
      setSchedulePayload({
        billType: 'remita',
        billPayload: {
          rrr: profileCode,
          amount: parseFloat(selectedProvider.price),
        },
        reviewData: [
          { label: 'Amount', value: `₦${Number(selectedProvider.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Provider', value: dataPayload.provider },
          { label: 'Service', value: dataPayload.service },
          { label: 'Profile Code', value: profileCode },
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
        { label: 'Service', value: dataPayload.service },
        { label: 'Profile Code', value: dataPayload.customer_id },
      ]);
      setConfirmVisible(true);
    }, 800);
  };

  // NEW: Filtered services for the selected main provider
  const filteredServices = useMemo(() => {
    return currentServices.filter(c =>
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [currentServices, searchQuery]);

  const handleSelectMain = (main) => {
    const filtered = providers.filter(p => 
      p.display_name.toLowerCase().includes(main.key)
    );
    setCurrentServices(filtered);
    setSelectedMain(main);
    setStep(1);
  };

  const handleSelectService = (service) => {
    setSelectedProvider(service);
    setStep(2);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 1) {
      setStep(0);
      setSelectedMain(null);
    } else {
      navigation.goBack();
    }
  };

  if (sessionLoading || loadingProviders) return <LoadingScreen visible={true} message="Loading Services" />;

  if (step === 0) {
    return (
      <BillProviderSelection
        isDark={isDark}
        onClose={handleBack}
        eyebrow="Examination Services"
        title="Select Exam Board"
        description="Choose the examination body you want to process"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search for a board"
        items={mainProviders}
        itemKey={(item) => `main-${item.key}`}
        itemTitle={(item) => item.name}
        itemSubtitle={() => 'Exam Board'}
        itemImage={(item) => item.logo}
        selectedItem={selectedMain}
        onSelect={handleSelectMain}
        emptyLabel="No examination boards available"
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

  if (step === 1) {
    return (
      <BillProviderSelection
        isDark={isDark}
        onClose={handleBack}
        headerIcon="arrow-back"
        eyebrow="Examination Services"
        title="Select Exam Service"
        description={`Choose the specific service for ${selectedMain?.name}`}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search services"
        items={filteredServices}
        itemKey={(item) => `service-${item.service_name}-${item.product_code}`}
        itemTitle={(item) => item.display_name}
        itemSubtitle={() => `${selectedMain?.name} Service`}
        itemImage={(item) => getLogoUrl(item.display_name)}
        selectedItem={selectedProvider}
        onSelect={handleSelectService}
        emptyLabel="No services found for"
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

  const isJamb = selectedProvider?.service_name?.toLowerCase() === 'jamb';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#121212', '#121212'] : ['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader title="Examination" onBack={handleBack} backgroundColor={isDark ? "#121212" : "#eff7f4"} textColor={isDark ? "#E4E4E4" : "#000"} iconColor={isDark ? "#E4E4E4" : "#000"} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <AdvertSlider currentScreen="EducationScreen" />
        
        <ProviderInputCard
          label="Provider & Profile Code"
          imageUri={getLogoUrl(selectedProvider?.display_name || '')}
          onProviderPress={() => setStep(1)}
          value={profileCode}
          onChangeText={setProfileCode}
          placeholder={isJamb ? 'Profile Code' : 'Exam ID / Profile Code'}
          keyboardType="numeric"
          isDark={isDark}
          isButton={isJamb}
          onButtonPress={handleVerify}
          buttonDisabled={isValidating}
        />

                            <ValidationStatus 
              isValidating={isValidating} 
              customerInfo={customerInfo} 
              isDark={isDark}
            />

        <View style={styles.amountContainerMain}>
          <View style={styles.bannerContainer}>
            <Image 
              source={{ uri: 'https://paysmart.com.ng/assets/images/trybanner3.png' }} 
              style={styles.bannerImage} 
            />
          </View>

          <View style={[styles.amountContainer, isDark && { backgroundColor: '#1E1E1E', borderWidth: 0 }]}>
            <Text style={[styles.label, isDark && { color: '#B0B0B0' }]}>{selectedProvider?.display_name || 'Package Amount'}</Text>
            <View style={styles.phoneNetworkRow2}>
              <View style={[styles.inputWrapper2, isDark && { backgroundColor: '#242424', borderColor: '#2E2E2E' }]}>
                <View style={styles.nairaSymbol}><Text style={styles.nairaText}>₦</Text></View>
                <TextInput
                  style={[styles.input, { paddingLeft: 10 }]}
                  editable={false}
                  value={selectedProvider ? parseFloat(selectedProvider.price).toLocaleString() : '0.00'}
                  placeholderTextColor="#999"
                />
              </View>
              <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed} activeOpacity={0.9}>
                <Text style={styles.proceedBtnText}>Pay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ExtraServices currentScreen="EducationScreen" showUssdEnquiry={false} isDark={isDark} />
      </ScrollView>

      <LoadingScreen visible={processing} message="Preparing request..." />
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

  amountContainerMain: { zIndex: 1 },
  bannerContainer: {
    zIndex: 0,
    marginBottom: -25,
    width: '100%',
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  amountContainer: { 
    backgroundColor: '#FFFFFF', 
    padding: 15, 
    borderRadius: 16, 
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1, 
  },
  label: { fontSize: 11, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 15 },
  phoneNetworkRow2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputWrapper2: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 15, borderWidth: 1, borderColor: '#EEE', width: '70%', height: 50 },
  nairaSymbol: { paddingLeft: 15 },
  nairaText: { fontSize: 18, fontWeight: '700', color: BRAND_COLOR },
  proceedBtn: { backgroundColor: BRAND_COLOR, height: 50, width: '26%', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  proceedBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  gradientBackground: { flex: 1 },
  safeArea: { flex: 1, paddingTop: 20,},
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
  headerTitle: { fontSize: 14, fontWeight: "700", color: BRAND_COLOR },
  heroSection: { marginBottom: 15 },
  heroSubtitle: { fontSize: 10, fontWeight: "700", color: BRAND_COLOR, textTransform: "uppercase", marginBottom: 4 },
  heroTitle: { fontSize: 18, fontWeight: "800", color: BRAND_COLOR, lineHeight: 24, marginBottom: 6 },
  heroDesc: { fontSize: 11, color: "#64748B", lineHeight: 17 },
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
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, color: BRAND_COLOR, height: "100%" },
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
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  textMetadataContainer: { flex: 1 },
  permissionTitle: { fontSize: 13, fontWeight: "700", color: BRAND_COLOR, marginBottom: 2 },
  permissionDesc: { fontSize: 11, color: "#64748B", lineHeight: 16 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: { borderColor: BRAND_COLOR },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND_COLOR,
  },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: 'center' }
});  