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
  Animated,
  Modal,
  SafeAreaView,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SearchBar from '@components/common/SearchBar';
import { useTheme } from '@providers/ThemeProvider';

import DebitTransactionReviewScreen from '../../../transactions/review/DebitTransactionReviewScreen';
import { ScheduleReviewSheet } from '../schedule';
import LoadingScreen from '@components/Loading/LoadingScreen';
import ScreenHeader from '@components/headers/ScreenHeader';
import ExtraServices from '@components/extra/ExtraServices';
import OptionCard from '@components/extra/OptionCard';
import AmountSelector from '../../utilities/AmountSelector';
import ProviderInputCard from '../../utilities/ProviderInputCard';
import BillProviderSelection from '../../utilities/BillProviderSelection';
import { normalizeFetchedDataPlans, normalizeGroupedDataPlans } from '../../utilities/dataPlanUtils';
import AdvertSlider from '@components/ads/AdvertSlider';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import { apiConfig } from '@config/api';
import networkData from '../../resources/networks.json'; // Import the JSON file
import { internationalToLocal } from '../../utilities/phoneLocalizer';
import { getSupportedCountries } from '@hooks/useAuth';

const api = apiConfig.baseUrl;

const { width, height } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

const CACHE_KEY = '@cache_data_plans';
const CACHE_EXPIRY = 4 * 60 * 60 * 1000; // 4 Hours
const BACKGROUND_SYNC_INTERVAL = 5 * 1000;

const BACKEND_API_URL = `${api}/v1/banking/bills/fetching/data-plans`; // Keep this as it's the API endpoint

const groupDataPlans = (plansArray = []) => {
  const normalizedPlans = normalizeFetchedDataPlans(plansArray);
  const grouped = {};

  normalizedPlans.forEach((plan) => {
    const net = plan.network;
    const dur = plan.duration_category;

    if (!grouped[net]) grouped[net] = {};
    if (!grouped[net][dur]) grouped[net][dur] = [];

    grouped[net][dur].push({
      id: plan.id,
      plan: plan.plan_name,
      size: plan.plan_size,
      amount: plan.selling_price,
      raw_amount: plan.selling_price,
      validity: plan.validity,
      category: dur,
      validity_days: plan.validity_days,
      platformName: plan.platformName || '',
    });
  });

  return grouped;
};

const hasCachedData = (value) => Boolean(value?.data && Object.keys(value.data || {}).length > 0);

const readCachedPlans = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsedCache = JSON.parse(cached);
    if (!parsedCache?.data || typeof parsedCache.timestamp !== 'number') {
      return null;
    }

    return parsedCache;
  } catch (error) {
    return null;
  }
};

const writeCachedPlans = async (data) => {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch (error) {
    // Ignore cache write issues so the UI remains stable.
  }
};

const hasDataDiff = (previousData = {}, nextData = {}) => {
  return JSON.stringify(previousData) !== JSON.stringify(nextData);
};

export default function DataScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const [fullData, setFullData] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [selectedNetwork, setSelectedNetwork] = useState(networkData[0]); // Use networkData
  const [phoneNumber, setPhoneNumber] = useState("");
  
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [confirmData, setConfirmData] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmReviewData, setConfirmReviewData] = useState(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [schedulePayload, setSchedulePayload] = useState(null);

  const [currentStep, setCurrentStep] = useState(0); // 0: network picker, 1: main form, 2: refine category/duration

  const [searchQuery, setSearchQuery] = useState("");

  // Create prefixMap from imported networkData
  const prefixMap = useMemo(() => {
    const map = {};
    networkData.forEach(network => {
      network.prefixes.forEach(prefix => {
        map[prefix] = network.id;
      });
    });
    return map;
  }, [networkData]);

  const { user } = useApiClient();
  
  const autoPopulateUserNumber = async (userData, setPhoneField) => {
    if (userData?.phone_number) {
      try {
        const countries = await getSupportedCountries();
        const local = await internationalToLocal(userData.phone_number, 'NG', countries);
        setPhoneField(local);
        formatAndDetect(local);
      } catch (err) {
        let num = userData.phone_number;
        if (num.startsWith('234')) num = '0' + num.slice(3);
        setPhoneField(num);
        formatAndDetect(num);
      }
    }
  };
  
  useEffect(() => {
    if (user && !phoneNumber) {
      autoPopulateUserNumber(user, setPhoneNumber);
    }
  }, [user]);

  useEffect(() => {
    fetchDataPlans();

    const backgroundSyncTimer = setInterval(() => {
      fetchDataPlans({ silent: true });
    }, BACKGROUND_SYNC_INTERVAL);

    return () => clearInterval(backgroundSyncTimer);
  }, []);

  const fetchDataPlans = async (options = {}) => {
    const { silent = false } = options;

    try {
      const cached = await readCachedPlans();
      const hasValidCache = cached && Date.now() - cached.timestamp < CACHE_EXPIRY;

      if (!silent && hasValidCache && hasCachedData(cached)) {
        const normalizedCachedData = normalizeGroupedDataPlans(cached.data);
        setFullData(normalizedCachedData);
        
        // Ensure selected network is in the cache, otherwise pick first available
        let networkToUse = selectedNetwork.id;
        if (!normalizedCachedData[networkToUse] || Object.keys(normalizedCachedData[networkToUse]).length === 0) {
          const availableNetworks = Object.keys(normalizedCachedData);
          if (availableNetworks.length > 0) {
            networkToUse = availableNetworks[0];
            const switchNetwork = networkData.find(n => n.id === networkToUse);
            if (switchNetwork) {
              setSelectedNetwork(switchNetwork);
            }
          }
        }
        
        initializeSelection(networkToUse, normalizedCachedData);
        setLoading(false);
      }

      // Fetch with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch_details' }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const json = await res.json();

      if (json.status !== 'success') {
        throw new Error(json.message || 'Failed to load plans');
      }

      const plansArray = Array.isArray(json.data) ? json.data : [];
      
      const grouped = groupDataPlans(plansArray);

      if (hasDataDiff(cached?.data || {}, grouped)) {
        if (!silent) {
          setFullData(grouped);
          
          // Ensure selected network has data, otherwise pick the first available
          let networkToUse = selectedNetwork.id;
          if (!grouped[networkToUse] || Object.keys(grouped[networkToUse]).length === 0) {
            const availableNetworks = Object.keys(grouped);
            if (availableNetworks.length > 0) {
              networkToUse = availableNetworks[0];
              const switchNetwork = networkData.find(n => n.id === networkToUse);
              if (switchNetwork) {
                setSelectedNetwork(switchNetwork);
              }
            }
          }
          
          initializeSelection(networkToUse, grouped);
        }

        await writeCachedPlans(grouped);
      } else {
        // Even if no changes, ensure we have data displayed by picking available network
        if (!silent && Object.keys(fullData).length === 0 && Object.keys(grouped).length > 0) {
          setFullData(grouped);
          
          let networkToUse = selectedNetwork.id;
          if (!grouped[networkToUse] || Object.keys(grouped[networkToUse]).length === 0) {
            const availableNetworks = Object.keys(grouped);
            if (availableNetworks.length > 0) {
              networkToUse = availableNetworks[0];
              const switchNetwork = networkData.find(n => n.id === networkToUse);
              if (switchNetwork) {
                setSelectedNetwork(switchNetwork);
              }
            }
          }
          
          initializeSelection(networkToUse, grouped);
        }
      }
    } catch (error) {
      if (!silent) {
        const cached = await readCachedPlans();
        
        // If API fails, try to use stale cache instead of showing error
        if (cached && hasCachedData(cached)) {
          const normalizedCachedData = normalizeGroupedDataPlans(cached.data);
          setFullData(normalizedCachedData);
          
          // Ensure selected network is in the cache, otherwise pick first available
          let networkToUse = selectedNetwork.id;
          if (!normalizedCachedData[networkToUse] || Object.keys(normalizedCachedData[networkToUse]).length === 0) {
            const availableNetworks = Object.keys(normalizedCachedData);
            if (availableNetworks.length > 0) {
              networkToUse = availableNetworks[0];
              const switchNetwork = networkData.find(n => n.id === networkToUse);
              if (switchNetwork) {
                setSelectedNetwork(switchNetwork);
              }
            }
          }
          
          initializeSelection(networkToUse, normalizedCachedData);
          Alert.sheet('Info', 'Showing cached data. Please check your connection.');
        } else {
          Alert.sheet('Error', 'Could not load data plans. Please check your internet connection and try again.', [
            { text: "Dismiss", style: "cancel" },
            { text: "Try Again", onPress: () => fetchDataPlans() }
          ]);
        }
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const initializeSelection = (netId, data = fullData) => {
    const netData = data[netId] || {};
    const durations = Object.keys(netData);

    let bestDuration = null;
    let maxCount = -1;

    durations.forEach(dur => {
      const planCount = netData[dur]?.length || 0;
      if (planCount > maxCount) {
        maxCount = planCount;
        bestDuration = dur;
      }
    });

    setSelectedDuration(bestDuration || (durations.length > 0 ? durations[0] : null));
    setSelectedPlan(null);
  };

  const formatAndDetect = (text) => {
    let normalized = text.replace(/[^\d]/g, "");
    if (normalized.length >= 4) {
      const prefix = normalized.slice(0, 4);
      const detectedNetId = prefixMap[prefix];
      if (detectedNetId && detectedNetId !== selectedNetwork?.id) { // Added nullish coalescing for safety
        const networkObj = networkData.find(n => n.id === detectedNetId); // Use networkData
        setSelectedNetwork(networkObj);
        initializeSelection(detectedNetId);
      }
    }
    setPhoneNumber(normalized);
  };

  const handleProceed = (plan) => {
    if (phoneNumber.length < 11) return Alert.sheet("Error", "Invalid phone number.");
    if (!plan) return Alert.sheet("Error", "Select a plan.");

    const prefix = phoneNumber.slice(0, 4);
    const detectedNetId = prefixMap[prefix];

    if (detectedNetId && detectedNetId !== selectedNetwork.id) {
      Alert.sheet(
        "Network Mismatch",
        `Are you sure the phone number ${phoneNumber} you entered is from ${selectedNetwork.name}?`,
        [
          { text: "Recheck", style: "cancel" },
          { text: "Yes, Go On", onPress: () => initiateTransaction(plan) }
        ]
      );
    } else {
      initiateTransaction(plan);
    }
  };

  const initiateTransaction = (plan) => {
    setSelectedPlan(plan);
    setProcessing(true);
    setConfirmData({
      request: 'data',
      plan_id: plan.id,
      network: selectedNetwork.id,
      phone_number: phoneNumber,
      plan_name: plan.plan,
      plan_size: plan.size,
      plan_type: 'Data Bundle', 
      category: plan.category,   // Use plan.category directly from the plan object
      validity: plan.validity,
      amount: plan.raw_amount,
    });
    if (route?.params?.schedule) {
      setProcessing(false);
      setSchedulePayload({
        billType: 'data',
        billPayload: {
          network: selectedNetwork.id,
          phone_number: phoneNumber,
          plan_id: Number(plan.id),
          amount: Number(plan.raw_amount),
        },
        reviewData: [
          { label: 'Amount', value: `₦${Number(plan.raw_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Network', value: selectedNetwork?.name || selectedNetwork?.id || 'Unknown Network' },
          { label: 'Size', value: plan.size },
          { label: 'Validity', value: plan.validity },
          { label: 'Recipient', value: phoneNumber },
        ],
      });
      setScheduleVisible(true);
      return;
    }
    setTimeout(() => { 
      setProcessing(false); 
      const reviewItems = [
        { label: 'Amount', value: `₦${Number(plan.raw_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: 'Network', value: selectedNetwork?.name || selectedNetwork?.id || 'Unknown Network' },
        { label: 'Size', value: plan.size },
        { label: 'Validity', value: plan.validity },
      ];

      if (plan.platformName) {
        reviewItems.push({ label: 'Platform', value: plan.platformName });
      }

      reviewItems.push({ label: 'Recipient', value: phoneNumber });

      setConfirmReviewData(reviewItems);
      setConfirmVisible(true); 
    }, 1000);
  };

  const filteredNetworks = useMemo(() => {
    return networkData.filter(c => // Use networkData
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleSelectNetwork = (network) => {
    setSelectedNetwork(network);
    initializeSelection(network.id);
    setSelectedPlan(null); // Reset selected plan when network changes
    setCurrentStep(1);
  };

  const handleBack = () => {
    if (currentStep === 1) {
      setCurrentStep(0);
    } else {
      navigation.goBack();
    }
  };

  if (loading) return <LoadingScreen visible={true} message="Fetching Plans..." />;

  const currentNetworkData = fullData[selectedNetwork.id] || {};
  const durationCategories = Object.keys(currentNetworkData) || [];
  const filteredPlans = selectedDuration ? (currentNetworkData[selectedDuration] || []) : [];

  if (currentStep === 0) {
    return (
      <BillProviderSelection
        isDark={isDark}
        onClose={handleBack}
        eyebrow="Mobile Data"
        title="Select a Network"
        description="Choose the mobile network for your data bundle"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search for a network"
        items={filteredNetworks}
        itemKey={(item) => `network-${item.id}`}
        itemTitle={(item) => item.name}
        itemSubtitle={() => 'Mobile Network'}
        itemImage={(item) => item.logo}
        selectedItem={selectedNetwork}
        onSelect={handleSelectNetwork}
      />
    );
  }

  // Step 1: Main form with plans
  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#121212', '#121212'] : ['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

      <ScreenHeader 
        title="Mobile Data" 
        backgroundColor={isDark ? "#121212" : "#eff7f4"} 
        textColor={isDark ? "#E4E4E4" : "#000"} 
        iconColor={isDark ? "#E4E4E4" : "#000"} 
        rightText="Records"
        onRightPress={() => navigation.navigate('TransactionHistoryScreen', { category: 'Data' })}
        onBack={currentStep === 1 ? () => setCurrentStep(0) : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <AdvertSlider />

        <ProviderInputCard
          label="Network & Phone"
          imageUri={selectedNetwork?.logo}
          onProviderPress={() => setCurrentStep(0)}
          value={phoneNumber}
          onChangeText={async (text) => {
            const hasPlus = /\+/.test(text);
            if (hasPlus) {
              const countries = await getSupportedCountries();
              const local = await internationalToLocal(text, 'NG', countries);
              formatAndDetect(local);
            } else {
              formatAndDetect(text);
            }
          }}
          placeholder="08012345678"
          keyboardType="phone-pad"
          maxLength={11}
          isDark={isDark}
          isContact
          onContactPress={async () => {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
              const contact = await Contacts.presentContactPickerAsync();
              if (contact?.phoneNumbers?.[0]) {
                const countries = await getSupportedCountries();
                const local = await internationalToLocal(contact.phoneNumbers[0].number, 'NG', countries);
                formatAndDetect(local);
              }
            }
          }}
        />

        <View style={styles.tabSection}>
          <Text style={[styles.tabSectionTitle, isDark && { color: '#B0B0B0' }]}>Plan Validity</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.tabsScrollContainer}
          >
            {durationCategories.map(dur => (
              <TouchableOpacity 
                key={dur} 
                onPress={() => { setSelectedDuration(dur); setSelectedPlan(null); }}
                style={[styles.tabItem, isDark && { backgroundColor: '#1E1E1E', borderColor: '#2E2E2E' }, selectedDuration === dur && (isDark ? { backgroundColor: '#4CAF50', borderColor: '#4CAF50' } : styles.activeTabItem)]}
              >
                <Text style={[styles.tabText, selectedDuration === dur && styles.activeTabText2]}>{dur}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <AmountSelector
          title="Available Plans"
          isDark={isDark}
          showCashback={false} // Data plans typically don't have cashback
          showManualInput={false} // Data plans are usually fixed amounts
          bannerSource="https://paysmart.com.ng/assets/images/trybanner5.png"
          data={filteredPlans.map(plan => ({
            id: plan.id,
            amount: Number(plan.amount),
            subText: plan.platformName ? `${plan.validity} - ${plan.platformName}` : plan.validity,
            planSize: plan.size,
            original: plan, // Keep the full plan object accessible
          }))}
          onItemPress={(item) => handleProceed(item.original)}
          selectedId={selectedPlan?.id}
          // amount={selectedPlan ? selectedPlan.amount.toString() : ''} // This prop is only for manual input or display, not selection.
          // setAmount={() => {}} // No manual input, so no setter needed
        />

        <ExtraServices 
          currentScreen="DataScreen" 
          showUssdEnquiry={false} 
          isDark={isDark}
        />
      </ScrollView>

      <LoadingScreen visible={processing} message="Please wait..." />
      {confirmData && (
        <DebitTransactionReviewScreen 
          visible={confirmVisible} 
          data={confirmData} 
          reviewData={confirmReviewData}
          onClose={() => setConfirmVisible(false)} 
        />
      )}
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
  scrollContent: { 
    paddingHorizontal: 20 * scale, 
    paddingTop: 20,
    paddingBottom: 40 
  },
  scrollContent2: {
    paddingHorizontal: 16,
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
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
    paddingVertical: 5,
  },
  filterTrigger: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 15,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  tabSection: { marginBottom: 10 },
  tabSectionTitle: { fontSize: 11, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 12, paddingLeft: 2 },
  tabsScrollContainer: { gap: 8, paddingBottom: 5, paddingHorizontal: 2 },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: '#FFF',
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
    marginRight: 4,
  },
  activeTabItem: {
    backgroundColor: BRAND_COLOR,
    borderColor: BRAND_COLOR,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: '#555' },
  
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  planTile: { width: '31%', height: 90, backgroundColor: 'rgba(209, 228, 221, 0.2)', borderRadius: 12, padding: 8, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  activePlanTile: { backgroundColor: 'rgba(47, 184, 109, 0.3)' },
  durationBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(47, 184, 109, 0.15)', 
    paddingVertical: 2.5,
    paddingHorizontal: 5,
  },
  durationBadgeActive: {
    backgroundColor: 'rgba(47, 184, 109, 0.3)', 
  },
  durationText: { fontSize: 7, fontWeight: '800', color: '#2FB86D', textAlign: 'center' },
  durationTextActive: { color: '#2F5B3C' },
  planSize: { fontSize: 16, fontWeight: '800', color: BRAND_COLOR },
  planPrice: { fontSize: 11, fontWeight: '600', color: '#555', marginTop: 2 },
  activeTabText: { color: '#2F5B3C' },
  activeTabText2: { color: '#FFF' },
  emptyText: { width: '100%', textAlign: 'center', color: '#999', paddingVertical: 20 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginTop: 20,
    marginBottom: 12,
    paddingHorizontal: 3,
  },
  selectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  selectionItem: {
    width: '47%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  activeSelectionItem: {
    backgroundColor: BRAND_COLOR,
    borderColor: BRAND_COLOR,
  },
  activeSelectionItemGreen: {
    backgroundColor: '#2FB86D',
    borderColor: '#2FB86D',
  },
  selectionItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
  },
  continueBtn: {
    backgroundColor: BRAND_COLOR,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: Platform.OS === 'ios' ? 34 : 34,
    height: 45,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    paddingBottom: 30,
    maxHeight: height * 0.85,
  },
  dragIndicator: { width: 40 * scale, height: 5 * scale, backgroundColor: '#E0E0E0', borderRadius: 3, alignSelf: 'center', marginTop: 15 * scale },
  sheetHeader: { alignItems: 'center', paddingTop: 10 * scale, paddingBottom: 15 * scale },
  sheetMainTitle: { fontSize: 18 * scale, fontWeight: '700', color: '#1A1A1A' },
  sheetScrollContent: { paddingHorizontal: 20 * scale, paddingBottom: 25, paddingTop: 10 },
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
  innerIcon: { width: 22 * scale, height: 22 * scale, resizeMode: 'contain' },
  textContainer: { flex: 1, marginLeft: 15 * scale },
  optionTitleText: { fontSize: 15 * scale, fontWeight: '700', color: '#1A1C1E' },
  chevronWrapper: { marginLeft: 10 * scale },

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
  }
});