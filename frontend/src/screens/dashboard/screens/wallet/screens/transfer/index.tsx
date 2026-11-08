import { Alert } from '@components/common/Alert';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import PinVerify from '@auth/verification/pin/pinVerify';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';

const availabilityEndpoint = `${apiConfig.baseUrl}/v1/user/wallets/transfer/fetching/index.php`;
const initializationEndpoint = `${apiConfig.baseUrl}/v1/user/wallets/transfer/initialization/index.php`;

const formatAmount = (value) => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const WalletTransferScreen = ({ navigation, route }) => {
  const { wallet } = useApiClient();
  const requestedSource = route?.params?.source;
  const [walletsByCurrency, setWalletsByCurrency] = useState({});
  const [currency, setCurrency] = useState('');
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [amount, setAmount] = useState('');
  const [sheet, setSheet] = useState(null);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const currencyWallets = walletsByCurrency[currency] || { sources: [], destinations: [] };
  const balance = source?.balance || wallet?.balance || '0.00';
  const currencies = Object.keys(walletsByCurrency);

  React.useEffect(() => {
    const fetchWallets = async () => {
      try {
        const sessionToken = await getSessionToken();
        const response = await fetch(`${availabilityEndpoint}?${encodeURIComponent(config.sessionToken)}=${encodeURIComponent(sessionToken || '')}`);
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.success !== true) {
          throw new Error(result?.message || 'Unable to load transfer wallets.');
        }

        const availableWallets = result.data && typeof result.data === 'object' ? result.data : {};
        const firstCurrency = Object.keys(availableWallets)[0] || '';
        const firstCurrencyWallets = availableWallets[firstCurrency] || {};
        setWalletsByCurrency(availableWallets);
        const requestedWallet = firstCurrencyWallets.sources?.find((item) => item.key === requestedSource);
        const initialSource = requestedWallet || firstCurrencyWallets.sources?.[0] || null;
        setCurrency(firstCurrency);
        setSource(initialSource);
        setDestination(firstCurrencyWallets.destinations?.[0] || null);
        setAmount(initialSource?.balance || '');
      } catch (error) {
        Alert.sheet('Unable to load wallets', error?.message || 'Please try again later.');
      } finally {
        setLoadingWallets(false);
      }
    };

    fetchWallets();
  }, []);

  const selectCurrency = (nextCurrency) => {
    const nextWallets = walletsByCurrency[nextCurrency] || {};
    const requestedWallet = nextWallets.sources?.find((item) => item.key === requestedSource);
    const nextSource = requestedWallet || nextWallets.sources?.[0] || null;
    setCurrency(nextCurrency);
    setSource(nextSource);
    setDestination(nextWallets.destinations?.[0] || null);
    setAmount(nextSource?.balance || '');
    setSheet(null);
  };

  const selectSource = (nextSource) => {
    setSource(nextSource);
    setAmount(nextSource?.balance || '');
    setSheet(null);
  };

  const selectDestination = (nextDestination) => {
    setDestination(nextDestination);
    setSheet(null);
  };

  const amountPresets = [
    { label: '25%', value: Number(balance) * 0.25 },
    { label: '50%', value: Number(balance) * 0.5 },
    { label: '70%', value: Number(balance) * 0.7 },
    { label: 'All', value: Number(balance) },
  ];

  const handleContinue = () => {
    const normalizedAmount = Number(amount.replace(/,/g, ''));

    if (!currency || !source?.key || !destination?.key) {
      Alert.sheet('Wallet selection required', 'Select a currency, source wallet, and destination wallet.');
      return;
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      Alert.sheet('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }

    if (normalizedAmount > Number(source.balance || 0)) {
      Alert.sheet('Insufficient balance', `Available balance is ${currency} ${formatAmount(source.balance)}.`);
      return;
    }

    setShowPin(true);
  };

  const handlePinApproval = (status) => {
    setShowPin(false);
    if (status !== 'approved') return;

    const normalizedAmount = Number(amount.replace(/,/g, ''));
    setTransferring(true);
    getSessionToken().then((sessionToken) => fetch(initializationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [config.sessionToken]: sessionToken || '',
        source: source.key,
        amount: normalizedAmount,
        currency,
      }),
    })).then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || 'Unable to complete wallet transfer.');
      }
      Alert.sheet('Transfer successful', result.message || `${currency} ${formatAmount(normalizedAmount)} moved to your Main wallet.`);
      setAmount('');
    }).catch((error) => {
      Alert.sheet('Transfer failed', error?.message || 'Unable to complete wallet transfer.');
    }).finally(() => setTransferring(false));
  };

  return (
    <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={styles.container}>
      <ScreenHeader
        title="Wallet Transfer"
        backgroundColor="#eff7f4"
        textColor="#1A1A1A"
        iconColor="#1A1A1A"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <View style={styles.iconBox}>
              <Ionicons name="swap-horizontal-outline" size={28} color="#0E3C2E" />
            </View>
            <Text style={styles.title}>Move money between your wallets</Text>
            <Text style={styles.subtitle}>
              Transfer funds from Spend & Save or Cashback to your Main wallet.
            </Text>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available source balance</Text>
            <Text style={styles.balanceValue}>{currency || '---'} {formatAmount(balance)}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Currency</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setSheet('currency')} disabled={loadingWallets}>
              <Text style={styles.selectorText}>{currency || 'Select currency'}</Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>

            <Text style={styles.label}>Source wallet</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setSheet('source')} disabled={!currency}>
              <Text style={styles.selectorText}>{source?.name || 'Select source wallet'}</Text>
              <Text style={styles.selectorBalance}>{source ? formatAmount(source.balance) : ''}</Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>

            <Text style={styles.label}>Destination wallet</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setSheet('destination')} disabled={!currency}>
              <Text style={styles.selectorText}>{destination?.name || 'Select destination wallet'}</Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>

            <Text style={styles.label}>Amount</Text>
            <View style={styles.amountInput}>
              <Text style={styles.currency}>₦</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#8A9A94"
                keyboardType="decimal-pad"
                style={styles.amountTextInput}
              />
            </View>
            <View style={styles.presetRow}>
              {amountPresets.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={styles.presetButton}
                  onPress={() => setAmount(preset.value.toFixed(2))}
                  disabled={!source || preset.value <= 0 || transferring}
                >
                  <Text style={styles.presetText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={loadingWallets || transferring} activeOpacity={0.8}>
            {transferring ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Text style={styles.continueText}>Transfer funds</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {sheet && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setSheet(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {sheet === 'currency' ? 'Select currency' : sheet === 'source' ? 'Select source wallet' : 'Select destination wallet'}
            </Text>
            {(sheet === 'currency' ? currencies : sheet === 'source' ? currencyWallets.sources : currencyWallets.destinations).map((item) => {
              const value = sheet === 'currency' ? item : item;
              const label = sheet === 'currency' ? item : item.name;
              const selected = sheet === 'currency' ? currency === value : (sheet === 'source' ? source?.key : destination?.key) === value.key;
              return (
                <TouchableOpacity
                  key={sheet === 'currency' ? value : value.key}
                  style={[styles.sheetOption, selected && styles.sheetOptionSelected]}
                  onPress={() => sheet === 'currency' ? selectCurrency(value) : sheet === 'source' ? selectSource(value) : selectDestination(value)}
                >
                  <Text style={styles.sheetOptionText}>{label}</Text>
                  {sheet !== 'currency' && <Text style={styles.sheetOptionBalance}>{formatAmount(value.balance)}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <PinVerify
        visible={showPin}
        onResult={handlePinApproval}
        onClose={() => setShowPin(false)}
        isPayment
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  intro: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: '#DDEDE6',
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    marginBottom: 12,
    width: 64,
  },
  title: {
    color: '#0E3C2E',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#0E3C2E',
    borderRadius: 14,
    marginBottom: 14,
    padding: 16,
  },
  balanceLabel: {
    color: '#C6DED4',
    fontSize: 12,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 5,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  label: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 4,
  },
  input: {
    borderColor: '#DCE7E2',
    borderRadius: 10,
    borderWidth: 1,
    color: '#1A1A1A',
    fontSize: 14,
    marginBottom: 14,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  selector: {
    alignItems: 'center',
    borderColor: '#DCE7E2',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 14,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  selectorText: {
    color: '#1A1A1A',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  selectorBalance: {
    color: '#64748B',
    fontSize: 12,
    marginRight: 8,
  },
  amountInput: {
    alignItems: 'center',
    borderColor: '#DCE7E2',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 14,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  currency: {
    color: '#0E3C2E',
    fontSize: 16,
    fontWeight: '700',
  },
  amountTextInput: {
    color: '#1A1A1A',
    flex: 1,
    fontSize: 16,
    marginLeft: 6,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  presetButton: {
    alignItems: 'center',
    borderColor: '#0E3C2E',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  presetText: {
    color: '#0E3C2E',
    fontSize: 12,
    fontWeight: '800',
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: '#0E3C2E',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 52,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
  },
  sheetTitle: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  sheetOption: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  sheetOptionSelected: {
    backgroundColor: '#EAF5EF',
  },
  sheetOptionText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetOptionBalance: {
    color: '#64748B',
    fontSize: 12,
  },
});

export default WalletTransferScreen;
