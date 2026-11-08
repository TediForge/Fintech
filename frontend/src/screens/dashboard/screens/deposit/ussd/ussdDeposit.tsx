import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, 
  TextInput, Animated, Modal, Dimensions, Platform, StatusBar, SafeAreaView,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import SearchBar from '@components/common/SearchBar';
import ScreenHeader from '@components/headers/ScreenHeader';
import LoadingScreen from '@components/Loading/LoadingScreen';
import OptionCard, { OptionCardSkeleton } from '@components/extra/OptionCard';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { quoteCheckoutFee } from '../utilities/feeApi';

const api = apiConfig.baseUrl;

const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;

const USSD_DEPOSIT_URL = `${api}/v1/banking/checkout/ussd/index.php`;

const BRAND_COLOR = '#0E3C2E';

// ────────────────────────────────────────────────
// CUSTOM LOGOS FOR BANKS
// ────────────────────────────────────────────────
const CUSTOM_LOGOS = {
  "guaranty trust": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSY9Q1M7dofS4nj1Ua1tYUh_xDbvyLLJRcLzA&s",
  "zenith": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNjRcwTQHoxqm2TsTXnfsDHk9b5c9P_gBnwQ&s",
  "access": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRW5XvwXQGREI3AtiP0HtQF1jnQ2zUydvHN3g&s",
  "united bank for africa": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrzGItALTqSLB0g-XG1CvpG8yJuO5uVyoNeQ&s",
  "first bank": "https://cdn.jsdelivr.net/gh/PaystackHQ/nigerialogos@master/public/logos/first_bank/first_bank.png",
  "fidelity": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQuaTUvg0G2_7y2ERGId-Wq9umafIHWvLMHyQ&s",
  "sterling": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvoNmOACDUTsnBBwMvXws8onDww1br8G3w-Q&s",
  "wema": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSmLO4L8L5KWzcLiArZPGTtkYNGc7GtSxyTqA&s",
  "unity": "https://is1-ssl.mzstatic.com/image/thumb/Purple118/v4/a5/4a/3c/a54a3c5b-a224-d008-159a-16dfda48e1c9/pr_source.jpg/200x200ia-75.webp",
  "first city": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRi13zTbWNYG36ujOiCbYjkx3862uS1GstpLQ&s",
  "union": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQHomRq0DMVEVJbWLLyIfeFsj8OLV5RkfWcMw&s",
  "stanbic": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTxou7nwUERZ2Q0owpFbZxRA19UcvfEo62_Bg&s",
  "parallex": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTPfU1XrzLdBYIgwQxOLwlAk058TIVzA-0P-w&s",
  "keystone": "https://play-lh.googleusercontent.com/WOW-TXJN0E8kq4fRzHvikinLdz-F9nX2Kk-1oRZcMan8yXzU7aNvfwYWYsxFOY6Dlxo",
  "ecobank": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4D1cS4KrX7IgKtnloewks7T_IYne6VheGbA&s",
  "enaira": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRK7iU5_-5xbBbbOe_1eKsTzGM3evd6N9Pfmg&s",
};

const getLogoUrl = (bankName) => {
  if (!bankName) return null;
  const nameLower = bankName.toLowerCase();
  for (const [key, url] of Object.entries(CUSTOM_LOGOS)) {
    if (nameLower.includes(key)) {
      return url;
    }
  }
  return null;
};

export default function UssdDeposit({ route, navigation }) {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState(null);
  const [feeQuote, setFeeQuote] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);
  
  const invoiceNumber = route?.params?.invoiceNumber;
  const [amount, setAmount] = useState(route?.params?.amount?.toString() || ""); 
  
  const [ussdData, setUssdData] = useState(null); 
  const [isPolling, setIsPolling] = useState(false);
  const [timer, setTimer] = useState(300); 

  const pollInterval = useRef(null);

  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;
    if (!invoiceNumber) return undefined;

    setFeeLoading(true);
    quoteCheckoutFee({ invoiceNumber, method: 'ussd' })
      .then((quote) => {
        if (active) setFeeQuote(quote);
      })
      .catch(() => {
        if (active) setFeeQuote(null);
      })
      .finally(() => {
        if (active) setFeeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [invoiceNumber]);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      try {
        // 1. ALWAYS load banks first (Check cache then background fetch)
        const cachedBanks = await AsyncStorage.getItem('ussd_banks_cache');
        if (cachedBanks) {
          setBanks(JSON.parse(cachedBanks));
          fetchBanks(true);
        } else {
          await fetchBanks();
        }

        // 2. Check for old payment
        const pending = await AsyncStorage.getItem('pending_ussd');
        if (pending) {
          const parsed = JSON.parse(pending);
          const currentTime = Date.now();
          const elapsed = Math.floor((currentTime - parsed.startTime) / 1000);
          const remaining = 300 - elapsed;

          if (remaining > 0) {
            setUssdData(parsed.ussdData);
            setSelectedBank(parsed.selectedBank);
            setAmount(parsed.amount);
            setTimer(remaining);
            setStep(2);
            const txRef = parsed.ussdData?.txRef;
            if (txRef) {
              startPolling(txRef);
            }
          } else {
            await AsyncStorage.removeItem('pending_ussd');
          }
        }
        
        setLoading(false);

      } catch (e) {
        console.error("Initialization Error:", e);
        setLoading(false);
      }
    };
    initialize();
    return () => {
      isMounted = false;
      clearInterval(pollInterval.current);
    };
  }, []);

  useEffect(() => {
    let interval = null;
    if (isPolling && timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0 && isPolling) {
      stopPolling();
      AsyncStorage.removeItem('pending_ussd');
      Alert.sheet("Session Expired", "Please generate a new code.");
      setStep(0);
    }
    return () => clearInterval(interval);
  }, [isPolling, timer]);

  const fetchBanks = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await fetch(USSD_DEPOSIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetchBanks',
        }),
      });
      const res = await response.json();
      if (res.success) {
        setBanks(res.data);
        await AsyncStorage.setItem('ussd_banks_cache', JSON.stringify(res.data));
      } else if (!isBackground) {
        Alert.sheet("Error", res.message || "Could not load banks");
      }
    } catch (e) {
      if (!isBackground) Alert.sheet("Error", "Connection to banking service failed");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const initiateUssd = async (bank = selectedBank) => {
    const numAmount = parseFloat(amount);
    if (!invoiceNumber) {
      return Alert.sheet("Invoice Required", "Create an online deposit invoice first.");
    }
    if (!invoiceNumber && (!amount || isNaN(numAmount) || numAmount < 100 || numAmount > 9999)) {
      return Alert.sheet("Invalid Amount", "Please enter an amount between ₦100 and ₦9,999");
    }
    if (!bank) return Alert.sheet("Select Bank", "Please choose a bank.");
    
    setLoading(true);
    try {
      const response = await fetch(USSD_DEPOSIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'charge',
          invoiceNumber,
          bankCode: bank.code,
        }),
      });
      const res = await response.json();
      if (res.success) {
        const ussdCode = res.data?.ussdCode;
        const txRef = res.data?.txRef;
        
        const newUssdData = { code: ussdCode, txRef };
        setUssdData(newUssdData);
        setTimer(300);
        
        await AsyncStorage.setItem('pending_ussd', JSON.stringify({
          ussdData: newUssdData,
          selectedBank: bank,
          amount,
          startTime: Date.now()
        }));
        
        setStep(2);
        startPolling(txRef);
      } else {
        Alert.sheet("Error", res.message || "Initialization failed");
      }
    } catch (e) {
      Alert.sheet("Error", "Failed to reach server");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (txRef) => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    setIsPolling(true);
    pollInterval.current = setInterval(async () => {
      try {
        const response = await fetch(USSD_DEPOSIT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            invoiceNumber,
            txRef,
          }),
        });
        const res = await response.json();
        
        if (res.success && res.data?.paymentStatus === "successful") {
          stopPolling();
          await AsyncStorage.removeItem('pending_ussd');
          
          navigation.replace('CreditTransactionResultScreen', {
            reference: txRef,
            transaction: {
              summaryRows: [
                { label: 'Amount', value: `₦${amount}` },
                { label: 'Bank', value: selectedBank?.name || 'Selected Bank' },
                { label: 'Reference', value: txRef },
              ],
            },
          });
        } else if (res.success && res.data?.paymentStatus === "failed") {
          stopPolling();
          await AsyncStorage.removeItem('pending_ussd');
          Alert.sheet("Failed", "Transaction failed, please try again.");
          setStep(0);
        }
      } catch (e) { console.log("Polling error", e); }
    }, 7000); 
  };

  const stopPolling = () => {
    setIsPolling(false);
    clearInterval(pollInterval.current);
    pollInterval.current = null;
  };

  const copyToClipboard = () => {
    Clipboard.setString(ussdData.code);
    Alert.sheet("Copied", "USSD code copied to clipboard.");
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const filteredBanks = useMemo(() => {
    return banks.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [banks, searchQuery]);

  const handleSelectBank = (bank) => {
    setSelectedBank(bank);
    if (invoiceNumber) {
      initiateUssd(bank);
      return;
    }
    setStep(1);
  };

  const handleBack = () => {
    if (step === 1) {
      setStep(0);
    } else {
      navigation.goBack();
    }
  };

  const cancelPending = async () => {
    Alert.sheet(
      "Cancel Payment",
      "Do you want to cancel this payment request",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          onPress: async () => {
            stopPolling();
            await AsyncStorage.removeItem('pending_ussd');
            setUssdData(null);
            setStep(0);
          }
        }
      ]
    );
  };

  if (loading && !banks.length && step === 0) {
    return <LoadingScreen visible={true} message="Loading Banks" />;
  }

  // STEP 0: Full-screen bank list (exact design)
  if (step === 0) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <LinearGradient colors={["#e8f0ec", "#f5faf8"]} style={styles.gradientBackground}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <Ionicons name="close" size={18} color={BRAND_COLOR} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}></Text>
              <View style={{ width: 32 }} />
            </View>

            <View style={{ paddingTop: 15, paddingHorizontal: 16 }}>
              <View style={[styles.heroSection, { paddingHorizontal: 0 }]}>
                <Text style={styles.heroSubtitle}>USSD Deposit</Text>
                <Text style={styles.heroTitle}>Select Bank</Text>
                <Text style={styles.heroDesc}>Choose your bank to generate USSD code</Text>
              </View>
              <SearchBar 
                searchQuery={searchQuery} 
                setSearchQuery={setSearchQuery} 
                placeholder="Search for a bank"
                containerStyle={{ marginBottom: 10 }}
              />
            </View>

            <ScrollView 
              contentContainerStyle={styles.scrollContent2} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {loading && !banks.length ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <OptionCardSkeleton key={`bank-skeleton-${index}`} />
                ))
              ) : (
                filteredBanks.map((item) => (
                  <OptionCard
                    key={`bank-${item.code}`}
                    item={item}
                    onPress={() => handleSelectBank(item)}
                    selected={selectedBank?.code === item.code}
                    title={item.name}
                    subtitle="Nigerian Bank"
                    imageUri={getLogoUrl(item.name) || 'https://cdn-icons-png.flaticon.com/128/3914/3914464.png'}
                    delayMs={0}
                  />
                ))
              )}
              
              {filteredBanks.length === 0 && !loading && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No results found for "{searchQuery}"</Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </>
    );
  }

  // STEP 1: Legacy amount + Generate USSD (invoice flow generates on bank selection)
  if (step === 1) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
        <ScreenHeader title="USSD Deposit" backgroundColor="#eff7f4" textColor="#000" iconColor="#000" onBack={() => setStep(0)} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Selected Bank Display */}
          <View style={styles.selectedBankCard}>
            <Image source={{ uri: getLogoUrl(selectedBank?.name) || 'https://cdn-icons-png.flaticon.com/128/3914/3914464.png' }} style={styles.bankLogoLarge} />
            <Text style={styles.selectedBankName}>{selectedBank?.name}</Text>
          </View>

          {!invoiceNumber && <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Enter Amount (₦100 - ₦9,999)</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>₦</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0.00"
                maxLength={4}
                editable={!ussdData} 
              />
            </View>
          </View>}

          {!ussdData ? (
            <TouchableOpacity style={styles.mainBtn} onPress={initiateUssd} activeOpacity={0.8}>
              <Text style={styles.mainBtnText}>Generate USSD Code</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <LoadingScreen visible={loading} message="Processing..." />
      </View>
    );
  }

  // STEP 2: USSD Code Display
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader title="Verify Payment" backgroundColor="#eff7f4" textColor="#000" iconColor="#000" onBack={cancelPending} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.codeHeader}>
          <Image 
            source={{ uri: getLogoUrl(selectedBank?.name) || 'https://cdn-icons-png.flaticon.com/128/3914/3914464.png' }} 
            style={styles.bankLogoLarge} 
          />
          <Text style={styles.bankNameLarge}>{selectedBank?.name}</Text>
        </View>

        <View style={styles.detailsCard}>
          {invoiceNumber && (
            <View style={styles.feeCard}>
              <Text style={styles.feeTitle}>Payment summary</Text>
              <Text style={styles.feeRow}>Invoice amount: ₦{Number(amount).toLocaleString()}</Text>
              {feeLoading && <Text style={styles.feeHint}>Calculating USSD fee...</Text>}
              {!feeLoading && feeQuote?.feeChargedToPayer && (
                <>
                  <Text style={styles.feeRow}>Checkout fee: ₦{Number(feeQuote.totalFee).toLocaleString()}</Text>
                  <Text style={styles.feeTotal}>You pay: ₦{Number(feeQuote.payerPays).toLocaleString()}</Text>
                </>
              )}
              {!feeLoading && feeQuote && !feeQuote.feeChargedToPayer && (
                <Text style={styles.feeHint}>No checkout fee is charged to the payer.</Text>
              )}
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValue}>₦{amount}</Text>
          </View>
          {feeQuote?.feeChargedToPayer && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Checkout fee</Text>
                <Text style={styles.detailValue}>₦{Number(feeQuote.totalFee).toLocaleString()}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>You pay</Text>
                <Text style={styles.detailValueBold}>₦{Number(feeQuote.payerPays).toLocaleString()}</Text>
              </View>
            </>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>USSD Code</Text>
            <Text style={styles.detailValueBold}>{ussdData?.code}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Valid for</Text>
            <Text style={styles.detailValue}>{formatTime(timer)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.copyBtnLarge} onPress={copyToClipboard}>
          <Ionicons name="copy-outline" size={20} color="#FFF" />
          <Text style={styles.copyTextLarge}>Copy USSD Code</Text>
        </TouchableOpacity>

        <View style={styles.waitingBox}>
          <Text style={styles.waitingText}>Confirming payment status...</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.cancelBtnLarge} 
          onPress={cancelPending}
        >
          <Text style={styles.cancelTextLarge}>Cancel & Change Bank</Text>
        </TouchableOpacity>
      </ScrollView>

      <LoadingScreen visible={loading} message="Processing..." />
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
  gradientBackground: { flex: 1 },
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
  feeCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D7E3DE',
  },
  feeTitle: { color: BRAND_COLOR, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  feeRow: { color: '#475569', fontSize: 13, marginBottom: 5 },
  feeHint: { color: '#64748B', fontSize: 12, marginTop: 4 },
  feeTotal: { color: BRAND_COLOR, fontSize: 16, fontWeight: '800', marginTop: 4 },
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
  textMetadataContainer: { flex: 1 },
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
  radioOuterSelected: { borderColor: BRAND_COLOR },
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
  },
  inputCard: { backgroundColor: BRAND_COLOR, borderRadius: 16, padding: 20, marginBottom: 25 },
  inputLabel: { color: '#B2C7C0', fontSize: 11, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#FFF' },
  currencyPrefix: { color: '#FFF', fontSize: 24, fontWeight: '700', marginRight: 5 },
  amountInput: { color: '#FFF', fontSize: 28, fontWeight: '800', flex: 1, paddingVertical: 5 },
  mainBtn: { backgroundColor: BRAND_COLOR, height: 54, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  waitingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  waitingText: { color: '#666', fontSize: 14, fontWeight: '600' },
  codeHeader: { alignItems: 'center', marginBottom: 20 },
  selectedBankCard: { 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    padding: 20, 
    alignItems: 'center', 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  bankLogoLarge: { width: 60, height: 60, borderRadius: 30, marginBottom: 10 },
  selectedBankName: { fontSize: 16, fontWeight: '700', color: BRAND_COLOR },
  bankNameLarge: { fontSize: 16, fontWeight: '700', color: BRAND_COLOR },
  detailsCard: { 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  detailRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  detailLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  detailValue: { fontSize: 15, color: '#111', fontWeight: '700' },
  detailValueBold: { fontSize: 18, color: BRAND_COLOR, fontWeight: '800' },
  copyBtnLarge: { 
    backgroundColor: BRAND_COLOR, 
    height: 54, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexDirection: 'row',
    marginBottom: 20 
  },
  copyTextLarge: { color: '#FFF', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  cancelBtnLarge: { 
    backgroundColor: '#FFF', 
    borderWidth: 2, 
    borderColor: '#E74C3C', 
    height: 54, 
    borderRadius: 15, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  cancelTextLarge: { color: '#E74C3C', fontSize: 16, fontWeight: '700' }
});  