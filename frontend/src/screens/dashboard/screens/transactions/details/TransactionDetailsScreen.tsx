import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  Share,
  SafeAreaView
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSessionToken } from "@hooks/useAuth";
import { Ionicons } from '@expo/vector-icons';
import ViewShot from "react-native-view-shot";
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@providers/ThemeProvider';

import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import { formatDate as sharedFormatDate, formatTime as sharedFormatTime, formatDateTime as sharedFormatDateTime } from '@lib/utils/format';
import LoadingScreen from '@components/Loading/LoadingScreen';
import config from '@config/app';
import { apiConfig } from '@config/api';
import QRCode from 'react-native-qrcode-svg'; // Added only for the requested QR feature

const api = apiConfig.baseUrl;

// Unified Endpoint
const API_URL = `${api}/v1/user/transactions/history.php`;
const GIFT_CARD_ENDPOINT = `${api}/v1/banking/giftCards/buy/fetching/`;

export default function TransactionDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const { transaction_reference, transactionReference } = route.params || {};
  const resolvedTransactionReference = transactionReference || transaction_reference;

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [resendingGiftCardCode, setResendingGiftCardCode] = useState(false);

  const fetchTransactionDetails = async () => {
    try {
      setLoadingMessage("Fetching records");
      setLoading(true);

      const token = await getSessionToken();
      const payload = {
        [config.sessionToken]: token,
        transactionReference: resolvedTransactionReference
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.status === "success") {
        setDetails(data.details);
      } else {
        setDetails(null);
        Alert.sheet("Error", data.message || "Could not retrieve details");
      }
    } catch (error) {
      console.error("Error fetching transaction details:", error);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactionDetails();
  }, []);

  const viewShotRef = useRef();

  const handleShareReceipt = async () => {
    try {
      const uri = await viewShotRef.current.capture();
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Transaction Receipt',
        UTI: 'public.png',
      });
    } catch (error) {
      console.error("Capture failed", error);
      Alert.sheet("Error", "Could not generate receipt image.");
    }
  };

  const handleReportIssue = () => {
    navigation.navigate('SupportScreen', { reference: details?.ps_ref });
  };

  const formatDateTime = (datetime) => {
    const formatted = sharedFormatDateTime(datetime);
    return formatted || 'N/A';
  };

  const formatTransactionDate = (datetime) => {
    const formatted = sharedFormatDate(datetime);
    return formatted || 'N/A';
  };

  const formatTransactionTime = (datetime) => {
    const formatted = sharedFormatTime(datetime);
    return formatted || 'N/A';
  };

  const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const handleCopy = async (value) => {
    await Clipboard.setStringAsync(value);
    Alert.sheet("Copied", "The reference has been copied successfully.");
  };

  const handleResendGiftCardCode = async () => {
    const reference = details?.ps_ref || details?.session_reference || resolvedTransactionReference;
    if (!reference || resendingGiftCardCode) return;

    setResendingGiftCardCode(true);
    try {
      const sessionToken = await getSessionToken();
      const response = await fetch(GIFT_CARD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resendCode',
          [config.sessionToken]: sessionToken,
          transactionReference: reference,
        }),
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        Alert.sheet('Gift Card Code', result.message || 'The gift-card code was sent to your email.');
      } else {
        Alert.sheet('Unable to Send Code', result.message || 'The gift-card code could not be sent.');
      }
    } catch (error) {
      console.error('Gift card code resend error:', error);
      Alert.sheet('Unable to Send Code', 'Please try again later.');
    } finally {
      setResendingGiftCardCode(false);
    }
  };

const renderDetailRow = (label, value, isCopyable = false, customStyle = null) => {
  if (!value || value === "N/A") return null;

  return (
    <View style={styles.row2}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '70%' }}>
        <Text style={[styles.value, customStyle]}>
          {value}
        </Text>

        {isCopyable && (
          <TouchableOpacity onPress={() => handleCopy(value)} style={{ marginLeft: 4 }}>
            <Ionicons name="copy-outline" size={11} color="#0E3C2E" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const renderActionRow = (label, actionLabel, onPress, isLoading = false) => (
  <View style={styles.row2}>
    <Text style={styles.label}>{label}</Text>
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading}
      style={styles.actionValueButton}
      activeOpacity={0.75}
    >
      <Ionicons name="mail-outline" size={13} color="#fff" />
      <Text style={styles.actionValueButtonText}>{isLoading ? 'Sending...' : actionLabel}</Text>
    </TouchableOpacity>
  </View>
);

const renderBrandedHeader = () => {
  const direction = details?.transaction_direction?.toLowerCase() || '';
  const directionColor = direction === 'credit' ? "#2FB86D" : "#D9534F";
  const directionLabel = direction === 'credit' ? "CREDIT" : "DEBIT";

  const rawStatus = details?.status?.toLowerCase() || '';
  let statusColor = "#2FB86D";
  if (['failed'].includes(rawStatus)) statusColor = "#D9534F";
  else if (['reversed', 'refunded'].includes(rawStatus)) statusColor = "#007BFF";

  return (
    <View style={styles.brandedHeader}>
      <View style={styles.brandRow}>
        <View>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: 'https://paysmart.com.ng/assets/brand-logos/Full-Logo-White.png' }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.receiptBadge}>
          <Text style={styles.receiptBadgeText}>TRANSACTION RECEIPT</Text>
        </View>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroServiceLabel}>{details?.service_name || "Transaction"}</Text>
          
          <Text style={styles.heroAmount}>
            {details?.currency || "₦"} {parseFloat(details?.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>

          {/* Both badges in a row directly under the amount */}
          <View style={styles.badgesRow}>
            <View style={[styles.directionBadge, { backgroundColor: directionColor + '15' }]}>
              <Text style={[styles.directionBadgeText, { color: directionColor }]}>
                {directionLabel}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {capitalize(details?.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* QR code in the place where the old status badge was (right side) */}
        <View style={styles.qrContainer}>
          {details?.ps_ref && (
            <QRCode
              value={details.ps_ref}
              size={58}
              color="#0E3C2E"
              backgroundColor="white"
            />
          )}
        </View>
      </View>
      
      <View style={styles.headerDivider} />
    </View>
  );
};

const getRelativeTime = (isoString, minusSeconds) => {
  if (!isoString) return "00:00:00";
  const date = new Date(isoString);
  date.setSeconds(date.getSeconds() - minusSeconds);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const renderStatusStepper = () => {
  if (!details || !details.created_at) return null;

  const rawStatus = details.status?.toLowerCase();
  const direction = details.transaction_direction?.toLowerCase();
  const isFailed = ['failed', 'reversed', 'cancelled', 'refunded'].includes(rawStatus);
  const isProcessing = ['processing', 'pending', 'submitted'].includes(rawStatus);
  const isCredit = direction === 'credit';

  const steps = [
    { 
      label: isCredit ? "Inbound" : "Initiated", 
      desc: isCredit ? "From sender" : "Request placed",
      time: getRelativeTime(details.created_at, 6)
    },
    { 
      label: "Processing", 
      desc: isCredit ? "Verifying funds" : "Network routing",
      time: getRelativeTime(details.created_at, 3)
    },
    { 
      label: isFailed 
        ? (rawStatus === 'refunded' ? "Refunded" : "Failed") 
        : isProcessing ? "Pending" : "Completed", 
      desc: isFailed 
        ? (rawStatus === 'refunded' ? "Funds Returned" : "TXN Declined") 
        : isProcessing ? "Finalizing" : (isCredit ? "Wallet Updated" : "Value Delivered"),
      time: getRelativeTime(details.created_at, 0)
    }
  ];

  const getStepColor = (index) => {
    if (index === 2) {
      if (['reversed', 'refunded'].includes(rawStatus)) return "#007BFF";
      if (['failed'].includes(rawStatus)) return "#D9534F";
      if (isProcessing) return "#CED4DA";
    }
    return "#2FB86D";
  };

  return (
    <View style={styles.stepperContainer}>
      <View style={styles.ticksRow}>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepUnit}>
            <View style={styles.tickAndLineContainer}>
              <View style={[styles.connector, { backgroundColor: index > 0 ? "#2FB86D" : "transparent" }]} />
              <View style={[styles.tickCircle, { backgroundColor: index === 2 ? getStepColor(2) : "#2FB86D" }]}>
                <Ionicons 
                  name={isFailed && index === 2 ? "close" : "checkmark"} 
                  size={8} 
                  color="#fff" 
                />
              </View>
              <View style={[styles.connector, { backgroundColor: index < 2 ? (index === 1 && isProcessing ? "#E9ECEF" : "#2FB86D") : "transparent" }]} />
            </View>
            
            <Text style={[styles.stepLabel, index === 2 && isFailed && { color: getStepColor(2) }]}>
              {step.label}
            </Text>
            <Text style={styles.stepDesc} numberOfLines={1}>
              {step.desc}
            </Text>
            <Text style={styles.stepTime}>
              {step.time}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const renderTransactionDetails = () => {
    if (!details) return <Text style={styles.emptyText}>No details available</Text>;

    const txType = String(details.type || details.transaction_type || '').trim().toLowerCase();
    const direction = String(details.direction || details.transaction_direction || '').trim().toLowerCase();
    const isGiftCardDebit = ['gift card', 'giftcard'].includes(txType) && direction === 'debit';

    const amountVal = Number(details.amount || 0);
    const transFee = Number(details.transaction_fee || 0);
    const vatFee = Number(details.vat || 0);
    const psFee = Number(details.paysmart_fee || 0);
    const cashbackUsed = Number(details.cashback_used || 0);

    let calculatedFee = 0;
    let finalDisplayAmount = 0;
    let finalLabel = "Wallet Debited";

    if (direction === 'credit') {
      finalLabel = "Wallet Credited";
      if (txType.includes('bank transfer inward')) {
        calculatedFee = transFee + vatFee + psFee;
      } else {
        calculatedFee = vatFee + psFee;
      }
      finalDisplayAmount = amountVal - calculatedFee;
    } else {
      finalLabel = "Wallet Debited";
      calculatedFee = transFee + vatFee + psFee;
      finalDisplayAmount = (amountVal + calculatedFee) - cashbackUsed;
    }

    return (
      <View style={styles.transactionItem}>
        
        <View style={styles.boxline}>
          {renderBrandedHeader()}      
        </View>

        <View style={styles.boxline}>
          <Text style={styles.boxSectionTitle}>Payment Summary</Text>

          {renderDetailRow(
            "Service Value",
            `₦${amountVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          )}

          {calculatedFee > 0 && renderDetailRow(
            "Transaction Fees",
            `₦${calculatedFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          )}

          {cashbackUsed > 0 && (
            <>
              <View style={styles.dashedLine} />
              {renderDetailRow(
                "Cashback Discount",
                `-₦${cashbackUsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                false,
                { color: '#2FB86D', fontWeight: '600' }
              )}
            </>
          )}

          <View style={[styles.dashedLine, { borderBottomWidth: 1.5, borderStyle: 'solid', opacity: 0.1 }]} />
          
          {renderDetailRow(
            finalLabel,
            `₦${finalDisplayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            false,
            { fontSize: 13, fontWeight: '800', color: '#0E3C2E' }
          )}

          {parseFloat(details.bonus_earned) > 0 && (
            <View style={{ marginTop: 8, backgroundColor: '#2FB86D10', padding: 8, borderRadius: 8, marginHorizontal: 12 }}>
              {renderDetailRow(
                "Reward Points Earned", 
                `+${parseFloat(details.bonus_earned).toLocaleString()} Pts`, 
                false, 
                { color: '#2FB86D', fontWeight: '800', fontSize: 11 }
              )}
            </View>
          )}

        </View>

        <View style={styles.boxline} >
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#0E3C2E', marginBottom: 10, marginLeft: 12, textAlign: 'left' }}>Service Details</Text>

        {isGiftCardDebit && (
          <>
            {renderDetailRow("Category", "Gift Card")}
            {renderActionRow(
              'Redeem Code',
              'Send to email',
              handleResendGiftCardCode,
              resendingGiftCardCode
            )}
          </>
        )}

        {txType.includes('airtime') && (
          <>
            {renderDetailRow("Category", "Airtime Purchase")}
            {renderDetailRow("Network:", `${details.network} NG`)}
            {renderDetailRow("Recipient Mobile", details.recipient_phone || details.recipient)}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('bonus') && (
          <> 
            {renderDetailRow("Category", "Bonus Earned")}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('data') && (
          <>
            {renderDetailRow("Service:", "Data Subscription")}
            {renderDetailRow("Network:", `${details.network} NG`)}
            {renderDetailRow("Data Plan:", details.plan_name)}
            {renderDetailRow("Phone Number:", details.recipient_phone || details.recipient)}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('cable') && (
          <>
            {renderDetailRow("Service:", "Cable TV")}
            {renderDetailRow("Provider:", details.network)}
            {renderDetailRow("Package:", details.plan_name)}
            {renderDetailRow("SmartCard/IUC:", details.customer_id)}
            {renderDetailRow("Customer:", details.customer_name)}
          </>
        )}

        {txType.includes('betting') && (
          <>
            {renderDetailRow("Category", "Betting Subscription")}
            {renderDetailRow("Provider:", details.service_provider)}
            {renderDetailRow("Customer ID", details.customer_id)}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('electricity') && (
          <>
            {renderDetailRow("Service:", "Electricity Bill")}
            {renderDetailRow("Disco:", details.service_provider)}
            {renderDetailRow("Meter Number:", details.meter_number)}
            {renderDetailRow("Account Name:", details.customer_name)}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('card') && (
          <>
            {renderDetailRow("Service:", "Card Topup")}
            {renderDetailRow("Card Type:", details.card_type)}
            {renderDetailRow("Card Number:", details.card_last4 ? `**** **** **** ${details.card_last4}` : null)}
            {renderDetailRow("Issuer:", details.card_issuer)}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('bank transfer inward') && (
          <>
            {renderDetailRow("Category", "Bank Deposit")}
            {renderDetailRow(
              "Sender Details",
              <Text style={{ fontSize: 10, color: '#0E3C2E', fontWeight: '600', textAlign: 'right', lineHeight: 14 }}>
                {details.originator_name} 
                {"\n"}
                <Text style={{ fontSize: 9, opacity: 0.7 }}>
                {details.originator_bank} - {details.originator_account_number}*******
                </Text>
              </Text>
            )}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('bank transfer outward') && (
          <>
          {renderDetailRow("Service:", "Bank Transfer")}
            {renderDetailRow(
              "Recipient Details",
              <Text style={{ fontSize: 10, color: '#0E3C2E', fontWeight: '600', textAlign: 'right', lineHeight: 14 }}>
                {details.recipient_name} 
                {"\n"}
                <Text style={{ fontSize: 9, opacity: 0.7 }}>
                {details.transfer_bank_name} - {details.transfer_account_number}
                </Text>
              </Text>
            )}
            {renderDetailRow("Payment Method", "Wallet Balance")}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('system transfer outward') && (
          <>
          {renderDetailRow("Service:", "System Transfer")}
            {renderDetailRow(
              "Recipient Details",
              <Text style={{ fontSize: 10, color: '#0E3C2E', fontWeight: '600', textAlign: 'right', lineHeight: 14 }}>
                {details.recipient_name} 
                {"\n"}
                <Text style={{ fontSize: 9, opacity: 0.7 }}>
                {details.transfer_bank_name} - {details.transfer_account_number}
                </Text>
              </Text>
            )}
            {renderDetailRow("Payment Method", "Wallet Balance")}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('system transfer inward') && (
          <>
          {renderDetailRow("Service:", "System Transfer")}
            {renderDetailRow(
              "Recipient Details",
              <Text style={{ fontSize: 10, color: '#0E3C2E', fontWeight: '600', textAlign: 'right', lineHeight: 14 }}>
                {details.recipient_name} 
                {"\n"}
                <Text style={{ fontSize: 9, opacity: 0.7 }}>
                {details.transfer_bank_name} - {details.transfer_account_number}
                </Text>
              </Text>
            )}
            {renderDetailRow("Payment Method", "Wallet Balance")}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
          </>
        )}

        {txType.includes('fee') && (
          <>
            {renderDetailRow("Category", details.service_name)}
            {renderDetailRow("Transaction Time", formatTransactionTime(details.created_at))}
            {renderDetailRow("Transaction Date", formatTransactionDate(details.created_at))}
            {renderDetailRow("Payment Method", "Wallet Balance")}
            {renderDetailRow("Transaction No", details.ps_ref, true)}
            {renderDetailRow(
              "Fee for TXN",
              details.narration.match(/PS[-\w]+/)?.[0],
              true
            )}
          </>
        )}
        </View>

        {txType.includes('electricity') && (
          <View style={styles.boxline}>
            <Text style={{
              fontSize: 11,
              fontWeight: '600',
              color: '#0E3C2E',
              marginBottom: 10,
              marginLeft: 12,
              textAlign: 'left'
            }}>
              Token Information
            </Text>
            {renderDetailRow("Meter Type:", details.meter_type?.replace(/\b\w/g, l => l.toUpperCase()) || details.meter_type)}
            {renderDetailRow("Token:", details.token, true)}
            {renderDetailRow("Units:", `${details.units} kWh`)}
          </View>
        )}
        
      </View>
    );
  };

  return (
    <LinearGradient colors={isDark ? [colors.background, colors.background] : [colors.surfaceAlt, colors.background]} style={styles.mainScreenContainer}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ScreenHeader
            title="Transaction Details"
            backgroundColor={colors.surface}
            textColor={colors.textPrimary}
            iconColor={colors.textPrimary}
            leftComponent={
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                <Ionicons name="chevron-back" size={24} color="#000" />
              </TouchableOpacity>
            }
          />

          <LoadingScreen visible={loading} message={loadingMessage || "Loading..."} />

          {!loading && (
            <>
          <ScrollView 
            contentContainerStyle={{ paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            overScrollMode="never"
          >
            <ViewShot 
              ref={viewShotRef} 
              options={{ format: "png", quality: 0.9 }}
              style={{ backgroundColor: '#f5f8f7' }}
            >
            {renderTransactionDetails()}
            </ViewShot>
          </ScrollView>
              <View style={styles.floatingFooter}>
                <TouchableOpacity 
                   style={styles.reportButton} 
                   onPress={handleReportIssue}
                >
                  <Ionicons name="help-circle-outline" size={20} color="#D9534F" />
                  <Text style={styles.reportButtonText}>Report Issue</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.shareButton} 
                  onPress={handleShareReceipt}
                >
                  <Text style={styles.shareButtonText}>Share Receipt</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mainScreenContainer: { flex: 1 },
  transactionItem: {
    borderRadius: 16,
    margin: 12,
    position: 'relative',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 12, color: "#0E3C2E" },
  verifiedIcon: { width: 14, height: 14, marginLeft: 4.5 },
  row2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  label: { fontSize: 10, color: '#555' },
  value: { fontSize: 10, color: '#0E3C2E', fontWeight: '600', textAlign: 'right' },
  actionValueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E3C2E',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  actionValueButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  dashedLine: { borderBottomColor: '#CED4DA', borderBottomWidth: 1, borderStyle: 'dashed', marginVertical: 10, marginHorizontal: 15, width: '92%', alignSelf: 'center' },
  emptyText: { textAlign: "center", marginTop: 40, color: "gray" },
  topRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, justifyContent: 'space-between', paddingHorizontal: 12 },
  imageStack: { flexDirection: 'row', position: 'relative' },
  circleImage: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E9ECEF' },
  overlappingImage: { position: 'absolute', left: 25 },
  amountType: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: '700', color: '#0E3C2E' },
  transactionTypeText: { fontSize: 12, color: '#555' },
  boxline: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderColor: 'rgba(206, 212, 218, 0.5)',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 5,
    paddingVertical: 11,
    borderRadius: 12,
    marginHorizontal: 15,
    width: '100%',
    alignSelf: 'center'  
  },
stepperContainer: {
    marginVertical: 20,
    width: '100%',
    paddingHorizontal: 5,
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  stepUnit: {
    width: '35%',
    alignItems: 'center',
  },
  tickAndLineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },
  connector: {
    flex: 1,
    height: 1.5,
  },
  tickCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0E3C2E',
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 7,
    fontWeight: '400',
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  stepTime: {
    fontSize: 7,
    fontWeight: '700',
    color: '#0E3C2E',
    marginTop: 2,
    opacity: 0.5,
  },
  
  floatingFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f8f7',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 1,
    borderColor: '#D9534F',
  },
  reportButtonText: {
    color: '#D9534F',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: '#0E3C2E',
    height: 45,
    borderRadius: 22.5,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  brandedHeader: {
    paddingHorizontal: 15,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  logoContainer: {
    width: 125,
    height: 40,
  },
  logo: {
    width: '100%',
    height: '100%',
    tintColor: '#6c757d',
  },
  receiptBadge: {
    backgroundColor: '#E9ECEF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  receiptBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#495057',
    letterSpacing: 0.5,
  },
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  heroServiceLabel: {
    fontSize: 8,
    color: '#6c757d',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0E3C2E',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
    directionBadge: {
    marginTop: 1,
    backgroundColor: '#2FB86D15',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  directionBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#2FB86D',
  },
  statusPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPillText: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase', 
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 1,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  headerDivider: {
    height: 0.5,
    backgroundColor: 'rgba(0,0,0,0.04)',
    width: '100%',
    marginTop: 5,
  },
  boxSectionTitle: {
    fontSize: 11, 
    fontWeight: '700', 
    color: '#0E3C2E', 
    marginBottom: 12, 
    marginLeft: 12, 
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
});  