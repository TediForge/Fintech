import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import PinVerify from '@auth/verification/pin/pinVerify';
import { Ionicons } from '@expo/vector-icons';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import LoadingScreen from '@components/Loading/LoadingScreen';
import CustomSwitch from '@components/common/Switch';
import SwipeTrack from './utilities/SwipeTrack';

const api = apiConfig.baseUrl;

const { height: screenHeight } = Dimensions.get('window');
const BRAND_COLOR = '#0E3C2E';

export default function DebitTransactionReviewScreen({ data, visible, onClose, reviewData }) {
  const { user, balances = {}, onRefresh } = useApiClient();
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  const [showPin, setShowPin] = useState(false);
  const [isSheetHidden, setIsSheetHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lowBalance, setLowBalance] = useState(false);
  const [useCashback, setUseCashback] = useState(false);

  // Validation states
  const [limitError, setLimitError] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const navigation = useNavigation();

  // Animations using useRef for stability
  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  const mainWallet = balances.MAIN || {};
  const cashbackWallet = balances.CASHBACK || {};
  const walletBalance = parseFloat(mainWallet.availableBalance || 0);
  const cashbackBalance = parseFloat(cashbackWallet.availableBalance || 0);
  const originalAmount = parseFloat(data?.amount || 0);
  const transactionFee = parseFloat(data?.fee || 0);
  const totalCost = originalAmount + transactionFee;
  const cashbackToCharge = useCashback ? Math.min(totalCost, cashbackBalance) : 0;
  const walletToCharge = totalCost - cashbackToCharge;

  // ────────────────────────────────────────────────
  // NEW: 30-second auto-cancel timer (preview phase)
  // ────────────────────────────────────────────────
  const autoCancelTimer = useRef(null);

  useEffect(() => {
    if (visible && hasValidated && !checkingLimit && !limitError && !anomalyData && !lowBalance) {
      autoCancelTimer.current = setTimeout(() => {
        Alert.sheet('Transaction Cancelled', 'You took too long to confirm');
        onClose();
      }, 30000);
    }

    return () => {
      if (autoCancelTimer.current) {
        clearTimeout(autoCancelTimer.current);
      }
    };
  }, [visible, hasValidated, checkingLimit, limitError, anomalyData, lowBalance, onClose]);

  useEffect(() => {
    const totalAvailable = useCashback ? (walletBalance + cashbackBalance) : walletBalance;
    setLowBalance(totalCost > totalAvailable);
  }, [useCashback, walletBalance, cashbackBalance, totalCost]);

  useEffect(() => {
    if (!visible) {
      setIsSheetHidden(false);
      setShowPin(false);
      setLimitError(null);
      setAnomalyData(null);
      setHasValidated(false);
      setCheckingLimit(false);
      animValue.setValue(screenHeight);
      overlayOpacity.setValue(0);
      sheetOpacity.setValue(0);
    } else {
      setUseCashback(false);
      if (!hasValidated && !checkingLimit) {
        validateLimits();
      }
    }
  }, [visible]);

  useEffect(() => {
    if (visible && hasValidated && !checkingLimit && data && user) {
      Animated.parallel([
        Animated.spring(animValue, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 1,
          duration: 2,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, hasValidated, checkingLimit, data, user]);

  const validateLimits = async () => {
    try {
      setCheckingLimit(true);
      const sessionToken = await getSessionToken();

      const response = await fetch(`${api}/v1/banking/limits/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.sessionToken]: sessionToken,
          amount: totalCost,
          direction: 'debit'
        }),
      });
      const text = await response.text();
      let result = null;
      if (text && text.trim()) {
        try {
          result = JSON.parse(text);
        } catch {
          result = { status: 'error', message: text.trim() };
        }
      }
      if (result?.status === 'blocked' && result?.actionRequired === 'kycUpgrade') {
        Alert.sheet(
          'Verification Required',
          result.message || 'Please verify your identity before making this transaction.',
          [
            { text: 'Dismiss', style: 'cancel', onPress: onClose },
            { text: 'Upgrade', onPress: handleUpgrade },
          ]
        );
        return;
      }

      if (result?.status === 'blocked') {
        setLimitError(result);
      } else if (result?.status === 'verification_required') {
        setAnomalyData(result);
      } else if (result?.status === 'error') {
        Alert.sheet('Validation Error', result.message || 'Limit check failed');
        onClose();
        return;
      } else {
        setLimitError(null);
        setAnomalyData(null);
      }
      setHasValidated(true);
    } catch (error) {
      console.error('Limit Check Error:', error);
      Alert.sheet('Network Error', 'Please check your internet connection');  
      onClose();
    } finally {
      setCheckingLimit(false);
    }
  };

  const handleConfirm = () => {
    if (lowBalance) return;

    setIsSheetHidden(true);
    setShowPin(true);
  };

  const handlePinApproval = async (status) => {
    if (status !== 'approved') {
      setShowPin(false);
      setIsSheetHidden(false);
      setSwipeResetKey(s => s + 1);
      return;
    }

    setShowPin(false);
    setLoading(true);

    try {
      if (!data) throw new Error("Transaction data is missing.");

      const sessionToken = await getSessionToken();

      let endpoint = '';
      if (data.request === 'airtime') endpoint = `${api}/v1/banking/bills/initialization/airtime.php`;
      else if (data.request === 'betting') endpoint = `${api}/v1/banking/services/fund-betting`;
      else if (data.request === 'data') endpoint = `${api}/v1/banking/bills/initialization/data.php`;
      else if (data.request === 'cableTv') endpoint = `${api}/v1/banking/bills/initialization/cable-tv.php`;
      else if (data.request === 'electricity') endpoint = `${api}/v1/banking/bills/initialization/electricity.php`;
      else if (data.request === 'transfer') endpoint = `${api}/v1/banking/transfers/initialization/`;
      else if (data.request === 'giftcard') endpoint = `${api}/v1/banking/giftCards/buy/initialization/`;
      else { 
        setLoading(false);
        Alert.sheet('Transaction Error', 'Unknown transaction type');
        onClose();
        return;
      }

      // Construct the payload based on the request type
      const basePayload = {
        [config.sessionToken]: sessionToken,
        use_cashback: useCashback,
        cashback_to_charge: cashbackToCharge,
        wallet_to_charge: walletToCharge,
        actual_amount: originalAmount,
      };

      let finalPayload;
      if (data.request === 'giftcard') {
        finalPayload = {
          [config.sessionToken]: sessionToken,
          ...data.payload,
        };
      } else {
        finalPayload = { ...basePayload, ...data };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      const text = await response.text();
      let result = null;
      if (text && text.trim()) {
        try {
          result = JSON.parse(text);
        } catch {
          result = { status: 'error', message: text.trim() };
        }
      }

      // Support both legacy {status: "success"} and new {success: true} patterns
      const isSuccess = result?.success === true || 
                       (result?.status && ['success', 'successful', 'pending'].includes(String(result.status).toLowerCase()));

      if (isSuccess) {
        if (typeof onRefresh === 'function') onRefresh();
        navigation.replace('DebitTransactionResultScreen', {
          reference: result?.data?.reference || result?.reference || result?.api_response?.ident,
        });
      } else {
        setLoading(false);
        const errorMsg = result?.message || result?.error || 'Transaction could not be completed';
        Alert.sheet('Transaction Failed', errorMsg);
        onClose();
      }
    } catch (error) {
      setLoading(false);
      console.error('Fetch Error:', error);
      Alert.sheet('Network Error', 'Please check your internet connection');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────
  // Rest of your original handlers (unchanged except handlePinApproval)
  // ────────────────────────────────────────────────

  const handleAnomalyVerify = () => {
    setAnomalyData(null);
  };

  const handleAddMoney = () => {
    onClose();
    navigation.navigate('AddMoneyScreen');
  };

  const handleUpgrade = () => {
    onClose();
    navigation.navigate('kycScreen', { upgrade: true });
  };

  const formatAmount = (amt) => {
    const num = parseFloat(amt);
    if (isNaN(num)) return '₦0.00';
    return `₦${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTier = (level) => {
    if (!level) return 'Tier 1';
    const lower = level.toLowerCase();
    if (lower.includes('tier')) {
      return 'Tier ' + level.replace(/tier/i, '').trim();
    }
    return level.toUpperCase();
  };

  const showFeeInfo = () => {
    Alert.sheet(
      "Transaction Fee",
      "This charge covers processing of this payment",
      [{ text: "Understood", style: "cancel" }]
    );
  };  

  // Helper to format camelCase strings into readable text
  const formatProductLabel = (str) => {
    if (!str) return '';
    // Insert a space before all caps and then capitalize the first letter
    const withSpaces = str.replace(/([A-Z])/g, ' $1');
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  };

  // Review rows should be provided by the initiating screen.
  // The review sheet only adds the automatic fee/cashback rows when needed.
  const parseNumericValue = (value) => {
    if (value === undefined || value === null) return NaN;
    const text = String(value).replace(/,/g, '');
    const match = text.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  };

  const visibleRows = (() => {
    const rows = Array.isArray(reviewData) && reviewData.length > 0
      ? reviewData.map((row) => ({ ...row }))
      : [];

    const filteredRows = rows.filter((row) => {
      if (String(row.label || '').trim().toLowerCase() !== 'transaction fee') {
        return true;
      }
      const feeValue = parseNumericValue(row.value);
      return Number.isFinite(feeValue) && feeValue > 0;
    });

    const hasFeeRow = filteredRows.some((row) => String(row.label || '').toLowerCase() === 'transaction fee');
    if (transactionFee > 0 && !hasFeeRow) {
      filteredRows.push({
        label: 'Transaction Fee',
        value: formatAmount(transactionFee),
        hasInfoIcon: true,
      });
    }

    const hasCashbackRow = filteredRows.some((row) => String(row.label || '').toLowerCase() === 'cashback earned');
    if (data?.cashback > 0 && !data?.can_pay_with_cashback && !hasCashbackRow) {
      filteredRows.push({
        label: 'Cashback Earned',
        value: formatAmount(data.cashback),
        color: '#1E8E3E',
      });
    }

    return filteredRows;
  })();

  const renderDetailRow = (row, index) => {
    const isLastDetailRow = index === visibleRows.length - 1;
    const shouldRemoveBorder = isLastDetailRow && !data.can_pay_with_cashback;
    // Support custom row types: default (label/value) and 'switch'
    if (row.type === 'switch') {
      return (
        <View
          key={`detail-${index}`}
          style={[styles.detailRow, shouldRemoveBorder && { borderBottomWidth: 0 }, { alignItems: 'center' }]}
        >
          <Text style={[styles.label, { letterSpacing: 0.1 }]}>{row.label}</Text>
          <CustomSwitch
            value={useCashback}
            onValueChange={() => setUseCashback(!useCashback)}
            width={row.width || 40}
            height={row.height || 22}
          />
        </View>
      );
    }

    return (
      <View
        key={`detail-${index}`}
        style={[
          styles.detailRow,
          shouldRemoveBorder && { borderBottomWidth: 0 }
        ]}
      >
        <View style={styles.labelWithIcon}>
          <Text style={styles.label}>{row.label}</Text>
          {row.hasInfoIcon && (
            <TouchableOpacity
              onPress={() => {
                if (row.infoMessage) Alert.sheet(row.label, row.infoMessage);
                else showFeeInfo();
              }}
              style={styles.infoIconTouch}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <Ionicons
                name="information-circle-outline"
                size={14}
                color="#000"
              />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.value, row.color && { color: row.color }]} numberOfLines={0}>
          {row.value}
        </Text>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <>
      {(checkingLimit || loading) && (
        <LoadingScreen
          visible={true}
          message={checkingLimit ? "Please Wait" : "Processing"}
        />
      )}

      {showPin && (
        <PinVerify
          visible={showPin}
          isPayment={true}
          onResult={handlePinApproval}
            onClose={() => {
              setShowPin(false);
              setIsSheetHidden(false);
              setSwipeResetKey(s => s + 1);
            }}
        />
      )}

      {hasValidated && !checkingLimit && !loading && !showPin && (
        <View style={styles.container}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                opacity: sheetOpacity,
                transform: [{ translateY: isSheetHidden ? screenHeight : animValue }]
              }
            ]}
          >
            <View style={styles.dragIndicator} />

            <View style={styles.topBar}>
              <TouchableOpacity onPress={onClose} style={styles.sideItem}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.headerText}>
                {limitError ? "Limit Alert" : (anomalyData ? "Security Alert" : "Transaction Preview")}
              </Text>
              <View style={styles.sideItem} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
              {limitError ? (
                <View style={styles.upgradeContainer}>
                  <View style={styles.limitIconWrapper}>
                    <Image
                      source={{ uri: 'https://cdn-icons-png.flaticon.com/128/14530/14530023.png' }}
                      style={{ width: 40, height: 40 }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.upgradeTitle}>Limit Exceeded</Text>
                  <Text style={styles.upgradeSubtitle}>
                    {limitError.message || "You have reached your transaction limit for your current tier."}
                  </Text>

                  <View style={styles.limitInfoBox}>
                    <View style={styles.limitInfoRow}>
                      <Text style={styles.limitInfoLabel}>Current Level</Text>
                      <Text style={styles.limitInfoValue}>{formatTier(user?.kycLevel)}</Text>
                    </View>
                    <View style={styles.limitInfoRow}>
                      <Text style={styles.limitInfoLabel}>Impacted Limit</Text>
                      <Text style={styles.limitInfoValue}>{limitError.limit_type?.replace('_', ' ').toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={styles.upgradeInstructions}>
                    Upgrade verification for higher limits
                  </Text>
                  <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
                    <Text style={styles.upgradeBtnText}>Upgrade My Account</Text>
                  </TouchableOpacity>
                </View>
              ) : anomalyData ? (
                <View style={styles.upgradeContainer}>
                  <View style={[styles.limitIconWrapper, { backgroundColor: '#FFF4E5' }]}>
                    <Ionicons name="shield-checkmark" size={50} color="#FF9800" />
                  </View>
                  <Text style={styles.upgradeTitle}>Unusual Transaction</Text>
                  <Text style={styles.upgradeSubtitle}>
                    {anomalyData.message || "This transaction is higher than your usual spending pattern."}
                  </Text>

                  <View style={styles.limitInfoBox}>
                    <View style={styles.limitInfoRow}>
                      <Text style={styles.limitInfoLabel}>Reason</Text>
                      <Text style={[styles.limitInfoValue, { color: '#FF9800' }]}>Unusual Amount</Text>
                    </View>
                    <View style={styles.limitInfoRow}>
                      <Text style={styles.limitInfoLabel}>Transaction</Text>
                      <Text style={styles.limitInfoValue}>{formatAmount(totalCost)}</Text>
                    </View>
                  </View>

                  <Text style={styles.upgradeInstructions}>
                    Standard check to protect your account
                  </Text>
                  <TouchableOpacity style={[styles.upgradeBtn, { backgroundColor: '#FF9800' }]} onPress={handleAnomalyVerify}>
                    <Text style={styles.upgradeBtnText}>Verify & Continue</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.amountContainer}>
                    <Text style={[styles.mainAmount, { color: BRAND_COLOR }]}>
                      <Text style={styles.symbol}>₦</Text>
                      {(data.can_pay_with_cashback && useCashback ? walletToCharge : totalCost).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </Text>
                  </View>
                  {data.can_pay_with_cashback && useCashback && cashbackToCharge > 0 && (
                    <View style={styles.discountRow}>
                      <Text style={styles.strikethroughAmount}>
                        {formatAmount(totalCost)}
                      </Text>
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>
                          -{formatAmount(cashbackToCharge)} Cashback Discount
                        </Text>
                      </View>
                    </View>
                  )}
                  <Text style={styles.sectionHeader}>Transaction Details</Text>
                  <View style={styles.detailsCard}>
                    {visibleRows.map((row, idx) => renderDetailRow(row, idx))}
                    {data.can_pay_with_cashback && (
                      <View
                        style={[
                          styles.detailRow,
                          visibleRows.length === 0 && { borderBottomWidth: 0 },
                          { alignItems: 'center', borderBottomWidth: 0 }
                        ]}
                      >
                        <Text style={[styles.label, { letterSpacing: 0.1 }]}>
                          {`Use Cashback • ₦${cashbackBalance.toLocaleString()}`}
                        </Text>
                        <CustomSwitch
                          value={useCashback}
                          onValueChange={() => setUseCashback(!useCashback)}
                          width={40}
                          height={22}
                        />
                      </View>
                    )}
                  </View>

                  <Text style={styles.sectionHeader}>Payment Method</Text>
                  <View style={styles.methodCard}>
                    <View style={styles.methodRow}>
                      <View style={styles.methodLeft}>
                        <View style={styles.walletIconBg}>
                         <Image
                            source={{ uri: 'https://paysmart.com.ng/assets/images/bitmap-trans2.png' }}
                            style={{
                              width: '50%',
                              height: '50%',
                              resizeMode: 'contain',
                              tintColor: '#0E3C2E'
                            }}
                          />
                        </View>
                        <View>
                          <Text style={styles.methodLabel}>Wallet Balance</Text>
                          <Text style={styles.methodValue}>{formatAmount(walletBalance)}</Text>
                        </View>
                      </View>
                      {lowBalance ? (
                        <TouchableOpacity style={styles.addMoneyBtn} onPress={handleAddMoney}>
                          <Text style={styles.addMoneyText}>Top Up</Text>
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="checkmark-circle" size={24} color="#1E8E3E" />
                      )}
                    </View>
                  </View>

                  {!lowBalance && (
                    <SwipeTrack onConfirm={handleConfirm} resetTrigger={swipeResetKey} />
                  )}

                  {lowBalance && (
                    <TouchableOpacity
                      style={[styles.confirmBtn, styles.disabledBtn]}
                      disabled={true}
                    >
                      <Text style={styles.confirmBtnText}>Insufficient Balance</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View> 
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3000,
    elevation: 3000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 3001,
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    maxHeight: '85%',
    zIndex: 3002,
    elevation: 3002,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 10,
    width: '100%',
  },
  sideItem: { flex: 1 },
  headerText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 2,
  },
  contentContainer: { paddingHorizontal: 20 },
  amountContainer: {
    alignItems: 'center',
    marginVertical: 3,
    gap: -4,
  },
  strikethroughAmount: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  mainAmount: { fontSize: 25, fontWeight: '800' },
  symbol: { fontSize: 15, fontWeight: '600' },
  sectionHeader: { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 18, marginBottom: 8 },
  detailsCard: { backgroundColor: '#F8F9FA', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 8 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'flex-start',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flexBasis: '45%',
    maxWidth: '45%',
    minWidth: 0,
  },
  infoIconTouch: {
    marginLeft: 4,
    paddingTop: 1,
  },
  label: {
    fontSize: 11,
    color: '#666',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  value: {
    fontSize: 11,
    fontWeight: '600',
    flexBasis: '55%',
    maxWidth: '55%',
    minWidth: 0,
    flexWrap: 'wrap',
    textAlign: 'right',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FAF5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 8,
    gap: 12,
  },
  discountBadge: {
    backgroundColor: '#E6F9EE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E8E3E',
  },
  methodCard: { backgroundColor: '#F8F9FA', borderRadius: 14, padding: 12, 
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
   },
  methodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodLeft: { flexDirection: 'row', alignItems: 'center' },
  walletIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6F2ED', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  methodLabel: { fontSize: 11, color: '#666' },
  methodValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginTop: 1, },
  addMoneyBtn: { backgroundColor: BRAND_COLOR, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  addMoneyText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: BRAND_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
    alignSelf: 'center'
  },
  disabledBtn: { backgroundColor: '#E0E0E0' },
  confirmBtnText: { color: '#FFF', fontSize: 14.5, fontWeight: '600' },
  validatingState: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 5,
  },
  limitIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FDECEC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  upgradeSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 20,
    marginBottom: 20,
  },
  limitInfoBox: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
  },
  limitInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  limitInfoLabel: {
    fontSize: 12,
    color: '#666',
  },
  limitInfoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  upgradeInstructions: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 25,
    fontWeight: '500',
  },
  upgradeBtn: {
    backgroundColor: BRAND_COLOR,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 15,
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
}); 