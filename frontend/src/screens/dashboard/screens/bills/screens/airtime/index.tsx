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
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SearchBar from '@components/common/SearchBar';
import OptionCard, { OptionCardSkeleton } from '@components/extra/OptionCard';
import { useTheme } from '@providers/ThemeProvider';

import DebitTransactionReviewScreen from '../../../transactions/review/DebitTransactionReviewScreen';
import { ScheduleReviewSheet } from '../schedule';
import LoadingScreen from '@components/Loading/LoadingScreen';
import ScreenHeader from '@components/headers/ScreenHeader';
import ExtraServices from '@components/extra/ExtraServices';
import AdvertSlider from '@components/ads/AdvertSlider';
import AmountSelector from '../../utilities/AmountSelector';
import ProviderInputCard from '../../utilities/ProviderInputCard';
import BillProviderSelection from '../../utilities/BillProviderSelection';
import useApiClient from '@hooks/apiClient';
import networkData from '../../resources/networks.json'; // Import the JSON file
import { useVisualDelay } from '@hooks/useVisualDelay';
import { internationalToLocal } from '../../utilities/phoneLocalizer';
import { getSupportedCountries } from '@hooks/useAuth';

const { width, height } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

export default function BuyAirtimeScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(networkData[0]); // Use networkData
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmData, setConfirmData] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmReviewData, setConfirmReviewData] = useState(null);
    const [scheduleVisible, setScheduleVisible] = useState(false);
    const [schedulePayload, setSchedulePayload] = useState(null);
  
  const { user } = useApiClient();
  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const showNetworkSkeleton = useVisualDelay(!loading, 350);

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

  const autoPopulateUserNumber = async (userData, setPhoneField) => {
    if (userData?.phone_number) {
      try {
        const countries = await getSupportedCountries();
        const local = await internationalToLocal(userData.phone_number, 'NG', countries);
        setPhoneField(local);
        formatAndDetect(local);
      } catch (err) {
        // fallback to simple conversion
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
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const formatAndDetect = (text) => {
    // expect local digits (e.g. 09130541422) or best-effort digits
    let normalized = String(text || '').replace(/[^\d]/g, '');

    if (normalized.length >= 4) {
      const prefix = normalized.slice(0, 4);
      const detectedNetworkName = prefixMap[prefix];
      if (detectedNetworkName && detectedNetworkName !== selectedNetwork?.name) {
        const networkObj = networkData.find(n => n.name === detectedNetworkName);
        if (networkObj && networkObj.id !== selectedNetwork.id) {
          setSelectedNetwork(networkObj);
        }
      }
    }

    setPhoneNumber(normalized);
  };

  const pickContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const contact = await Contacts.presentContactPickerAsync();
        if (contact?.phoneNumbers?.[0]) {
          // Normalize international contact phone to local then detect
          const countries = await getSupportedCountries();
          const local = await internationalToLocal(contact.phoneNumbers[0].number, 'NG', countries);
          formatAndDetect(local);
        }
      } else {
        Alert.sheet('Permission Denied', 'Please allow contact access to continue.');
      }
    } catch (error) {
      Alert.sheet('Error', 'Unable to access contacts.');
    }
  };

  const handleProceed = (selectedAmount) => {
    const finalAmount = selectedAmount || amount;

    if (!selectedNetwork) return Alert.sheet('Error', 'Please select a network.');
    if (!phoneNumber.trim() || phoneNumber.length < 10) return Alert.sheet('Error', 'Enter a valid phone number.');
    if (!finalAmount || parseFloat(finalAmount) < 100) return Alert.sheet('Error', 'Minimum amount is ₦100.');

    const prefix = phoneNumber.slice(0, 4);
    const detectedNetworkName = prefixMap[prefix];

    if (detectedNetworkName && detectedNetworkName !== selectedNetwork.name) {
      Alert.sheet(
        "Network Mismatch",
        `Are you sure the phone number ${phoneNumber} you entered is from ${selectedNetwork.name}?`,
        [
          { text: "Recheck", style: "cancel" },
          { text: "Yes, Go On", onPress: () => initiateTransaction(finalAmount) }
        ]
      );
    } else {
      initiateTransaction(finalAmount);
    }
  };

  const initiateTransaction = (finalAmount) => {
    setProcessing(true);
    setAmount(finalAmount.toString());

    const cashbackValue = Math.floor(parseFloat(finalAmount) * 0.01);
    const dataPayload = {
      request: 'airtime',
      network: selectedNetwork.name,
      phone_number: phoneNumber,
      amount: parseFloat(finalAmount),
      cashback: cashbackValue,
      fee: 0,
      can_pay_with_cashback: false,
    };
    if (route?.params?.schedule) {
      setProcessing(false);
      setSchedulePayload({
        billType: 'airtime',
        billPayload: {
          network: selectedNetwork.name,
          phone_number: phoneNumber,
          amount: parseFloat(finalAmount),
        },
        reviewData: [
          { label: 'Amount', value: `₦${Number(finalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Network', value: selectedNetwork.name },
          { label: 'Recipient', value: phoneNumber },
        ],
      });
      setScheduleVisible(true);
      return;
    }

    setTimeout(() => {
      setProcessing(false);
      const fmt = (v) => `₦${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      setConfirmData(dataPayload);
      const rows = [
        { label: 'Amount', value: fmt(dataPayload.amount) },
        { label: 'Network', value: dataPayload.network },
        { label: 'Recipient', value: dataPayload.phone_number },
      ];
      if (dataPayload.fee > 0) {
        rows.push({
          label: 'Transaction Fee',
          value: fmt(dataPayload.fee),
          hasInfoIcon: true,
          infoMessage: 'This charge covers processing of this payment',
        });
      }
      setConfirmReviewData(rows);
      setConfirmVisible(true);
    }, 800);
  };

  const filteredNetworks = useMemo(() => {
    return networkData.filter(c => // Use networkData
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleSelectNetwork = (network) => {
    setSelectedNetwork(network);
    setStep(1);
  };

  const handleBack = () => {
    if (step === 1) {
      setStep(0);
    } else {
      navigation.goBack();
    }
  };

  if (loading) return <LoadingScreen visible={true} message="Airtime Page.." />;

  if (step === 0) {
    return (
      <BillProviderSelection
        isDark={isDark}
        onClose={handleBack}
        eyebrow="Buy Airtime"
        title="Select a Network"
        description="Select the mobile network for your airtime top up"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search for a network"
        items={filteredNetworks}
        isLoading={showNetworkSkeleton}
        itemKey={(item) => `network-${item.id}`}
        itemTitle={(item) => item.name}
        itemSubtitle={() => 'Mobile Network'}
        itemImage={(item) => item.logo}
        selectedItem={selectedNetwork}
        onSelect={handleSelectNetwork}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? ['#121212', '#121212'] : ['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

      <ScreenHeader
        title="Buy Airtime"
        backgroundColor={isDark ? "#121212" : "#eff7f4"}
        onBack={step === 1 ? () => setStep(0) : undefined}
        textColor={isDark ? "#E4E4E4" : "#000"}
        iconColor={isDark ? "#E4E4E4" : "#000"}
        rightText="Records"
        onRightPress={() => navigation.navigate('TransactionHistoryScreen', { category: 'Airtime' })}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <AdvertSlider />
       
        <ProviderInputCard
          label="Network & Phone"
          imageUri={selectedNetwork?.logo}
          onProviderPress={() => setStep(0)}
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
          onContactPress={pickContact}
        />

        <AmountSelector 
          amount={amount}
          setAmount={setAmount}
          title="Top up Airtime"
          showCashback={true}
          cashbackPercent={1}
          onSubmit={handleProceed}
          isDark={isDark}
        />

        <ExtraServices currentScreen="AirtimeScreen" showUssdEnquiry={false} isDark={isDark} />
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
    paddingBottom: 40,
    paddingTop: 20,
  },
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
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
    paddingVertical: 5,
  },
  contactIconBtn: { 
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F7F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    paddingBottom: 20,
    maxHeight: height * 0.70,
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
  innerIcon: { width: 42 * scale, height: 42 * scale, borderRadius: 42 * scale, resizeMode: 'cover' },
  textContainer: { flex: 1, marginLeft: 15 * scale },
  optionTitleText: { fontSize: 15 * scale, fontWeight: '700', color: '#1A1C1E' },
  chevronWrapper: { marginLeft: 10 * scale },
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