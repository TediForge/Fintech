import { Alert } from '@components/common/Alert';
import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@components/headers/ScreenHeader';
import useApiClient from '@hooks/apiClient';
import LoadingScreen from '@components/Loading/LoadingScreen';
import Browser from '@components/common/Browser';
import { initializeCardCharge, authorizeCardCharge, verifyCardCharge } from './utilities/apiHelper';
import { quoteCheckoutFee } from '../utilities/feeApi';

const BRAND_COLOR = '#0E3C2E';

const getNextAction = (result) => String(result?.nextAction || 'none').toLowerCase();

const CardDeposit = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, loading: sessionLoading } = useApiClient();
  const invoiceNumber = route.params?.invoiceNumber;
  const invoiceAmount = route.params?.amount;
  const [amount, setAmount] = useState(invoiceAmount?.toString() || '');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolderName, setCardHolderName] = useState(user?.full_name || '');
  const [charge, setCharge] = useState(null);
  const [authValue, setAuthValue] = useState('');
  const [billingAddress, setBillingAddress] = useState({ line1: '', city: '', state: '', country: 'NG', postalCode: '' });
  const [loading, setLoading] = useState(false);
  const [feeQuote, setFeeQuote] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [browserDetails, setBrowserDetails] = useState(null);

  const amountValue = Number(amount || 0);
  const isAmountValid = amountValue >= 100 && amountValue <= 9999;
  const nextAction = getNextAction(charge);
  const cardFirst6 = cardNumber.replace(/\D/g, '').slice(0, 6);

  useEffect(() => {
    let active = true;
    if (!invoiceNumber || cardFirst6.length < 6) {
      setFeeQuote(null);
      return undefined;
    }

    setFeeLoading(true);
    quoteCheckoutFee({ invoiceNumber, method: 'card', cardFirst6 })
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
  }, [cardFirst6, invoiceNumber]);

  const completeCharge = useCallback(async (result) => {
    console.log('completeCharge called with result:', result);
    
    // Safety check for error responses
    if (result?.status >= 400 || result?.error) {
      console.log('Result is an error response, not continuing');
      return;
    }
    
    if (getNextAction(result) === 'redirect' && result.redirectUrl) {
      console.log('Redirecting to:', result.redirectUrl);
      setBrowserDetails({
        url: result.redirectUrl,
        title: 'Card verification',
        callbackRoute: 'cardDeposit',
        callbackUrlPrefix: result.callbackUrl || result.returnUrl || result.callbackUrlPrefix,
        callbackParams: { cardCallback: { reference: result.reference } },
      });
      return;
    }

    if (getNextAction(result) !== 'none' && getNextAction(result) !== 'verify') {
      console.log('Setting charge state, nextAction:', getNextAction(result));
      setCharge(result);
      return;
    }

    console.log('Verifying charge...');
    setLoading(true);
    try {
      const verified = await verifyCardCharge({ invoiceNumber, reference: result.reference, transactionId: result.transactionId });
      console.log('Verification result:', verified);
      if (verified?.status === 'success') {
        console.log('Verification successful, navigating to result screen');
        navigation.replace('CreditTransactionResultScreen', {
          reference: verified.reference || result.reference,
          transaction: {
            summaryRows: [
              { label: 'Amount', value: `₦${amountValue.toLocaleString()}` },
              { label: 'Method', value: 'Card Deposit' },
              { label: 'Reference', value: verified.reference || result.reference },
            ],
          },
        });
      } else {
        console.log('Verification pending or failed');
        setCharge(verified);
        Alert.sheet('Verification pending', verified?.message || 'The card charge is not complete yet.');
      }
    } catch (error) {
      console.log('Verification error:', error);
      Alert.sheet('Verification failed', error.message || 'Could not verify this card charge.');
    } finally {
      setLoading(false);
    }
  }, [amountValue, invoiceNumber, navigation]);

  const handleInitialize = async () => {
    console.log('handleInitialize called - isAmountValid:', isAmountValid);
    if (!invoiceNumber) {
      Alert.sheet('Invoice required', 'Create an online deposit invoice before paying by card.');
      return;
    }
    if (!isAmountValid) {
      Alert.sheet('Invalid amount', 'Enter an amount between ₦100 and ₦9,999.');
      return;
    }
    if (cardNumber.replace(/\D/g, '').length < 12 || !expiryMonth || !expiryYear || cvv.length < 3) {
      Alert.sheet('Incomplete card details', 'Enter valid card number, expiry date, and CVV.');
      return;
    }

    console.log('Starting card charge initialization...');
    setLoading(true);
    try {
      console.log('Calling initializeCardCharge with amount:', amountValue);
      const result = await initializeCardCharge({ invoiceNumber, cardNumber: cardNumber.replace(/\D/g, ''), expiryMonth, expiryYear, cvv, cardHolderName });
      console.log('Initialize result:', result);
      setCharge(result);
      await completeCharge(result);
    } catch (error) {
      console.log('Initialize error:', error);
      Alert.sheet('Card charge failed', error.message || 'Could not start the card charge.');
    } finally {
      console.log('Initialize finally block - setting loading to false');
      setLoading(false);
    }
  };

  const handleAuthorize = async () => {
    console.log('handleAuthorize called - charge:', charge);
    if (!charge?.reference) {
      console.log('Missing reference - returning');
      return;
    }
    const authType = nextAction === 'pin'
      ? 'pin'
      : nextAction === 'otp'
        ? 'otp'
        : nextAction === 'avs_noauth'
          ? 'avs_noauth'
          : 'avs';
    console.log('Auth type:', authType, 'Auth value:', authValue);
    if (authType !== 'avs' && authType !== 'avs_noauth' && !authValue) {
      console.log('Missing auth value for', authType);
      Alert.sheet('Authentication required', `Enter your card ${authType.toUpperCase()}.`);
      return;
    }

    console.log('Starting authorization request...');
    setLoading(true);
    try {
      console.log('Calling authorizeCardCharge with:', { reference: charge.reference, chargeId: charge.chargeId, authType });
      const result = await authorizeCardCharge({
        invoiceNumber,
        reference: charge.reference,
        chargeId: charge.chargeId,
        flwRef: charge.flwRef,
        authType,
        pin: authType === 'pin' ? authValue : undefined,
        otp: authType === 'otp' ? authValue : undefined,
        billingAddress: authType === 'avs' || authType === 'avs_noauth' ? billingAddress : undefined,
      });
      console.log('Authorization result:', result);
      
      // Only update and continue if authorization was successful or needs more auth
      if (result?.status === 'success' || result?.nextAction) {
        setAuthValue('');
        setCharge((currentCharge) => ({
          ...currentCharge,
          ...result,
          reference: result.reference || currentCharge?.reference,
          flwRef: result.flwRef || currentCharge?.flwRef || null,
          chargeId: result.chargeId || currentCharge?.chargeId || null,
        }));
        if (result?.status === 'success' || result?.nextAction === 'none') {
          await completeCharge({
            ...charge,
            ...result,
            reference: result.reference || charge.reference,
            flwRef: result.flwRef || charge.flwRef,
          });
        }
      } else {
        // Authorization failed - show error but keep charge state intact
        Alert.sheet('Authorization failed', result?.message || 'Could not authorize this charge.');
      }
    } catch (error) {
      console.log('Authorization error:', error);
      Alert.sheet('Authorization failed', error.message || 'Could not authorize this charge.');
    } finally {
      console.log('Authorization finally block - setting loading to false');
      setLoading(false);
    }
  };

  const handleWebViewCallback = useCallback(() => {
    if (route.params?.cardCallback?.reference) {
      completeCharge({ reference: route.params.cardCallback.reference, nextAction: 'none' });
      navigation.setParams({ cardCallback: undefined });
    }
  }, [completeCharge, navigation, route.params?.cardCallback]);

  React.useEffect(() => {
    handleWebViewCallback();
  }, [handleWebViewCallback]);

  if (sessionLoading) return <LoadingScreen visible message="Syncing session" />;

  return (
    <>
    <LinearGradient colors={['#e6f2ed', '#f5f8f7']} style={styles.container}>
      <ScreenHeader title="Card Deposit" backgroundColor="#e6f2ed" textColor="#000" iconColor="#000" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {invoiceNumber ? (
            <View style={styles.invoiceAmountBox}>
              <Text style={styles.label}>Invoice amount</Text>
              <Text style={styles.invoiceAmount}>₦{amountValue.toLocaleString()}</Text>
              {feeLoading && <Text style={styles.feeHint}>Calculating card fee...</Text>}
              {!feeLoading && feeQuote?.feeChargedToPayer && (
                <>
                  <Text style={styles.feeRow}>Checkout fee: ₦{Number(feeQuote.totalFee).toLocaleString()}</Text>
                  <Text style={styles.payerTotal}>You pay: ₦{Number(feeQuote.payerPays).toLocaleString()}</Text>
                </>
              )}
              {!feeLoading && !feeQuote && cardFirst6.length < 6 && (
                <Text style={styles.feeHint}>Enter the first 6 card digits to calculate the fee.</Text>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.label}>Amount</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Create an invoice first" />
            </>
          )}
          <Text style={styles.label}>Card number</Text>
          <TextInput style={styles.input} value={cardNumber} onChangeText={setCardNumber} keyboardType="numeric" maxLength={19} placeholder="4111 1111 1111 1111" />
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.third]} value={expiryMonth} onChangeText={setExpiryMonth} keyboardType="numeric" maxLength={2} placeholder="MM" />
            <TextInput style={[styles.input, styles.third]} value={expiryYear} onChangeText={setExpiryYear} keyboardType="numeric" maxLength={4} placeholder="YY" />
            <TextInput style={[styles.input, styles.third]} value={cvv} onChangeText={setCvv} keyboardType="numeric" secureTextEntry maxLength={4} placeholder="CVV" />
          </View>
          <Text style={styles.label}>Card holder name</Text>
          <TextInput style={styles.input} value={cardHolderName} onChangeText={setCardHolderName} placeholder="Name on card" />

          {charge && nextAction !== 'none' && nextAction !== 'verify' && nextAction !== 'redirect' && (
            <View style={styles.authBox}>
              <Text style={styles.authTitle}>Card authorization: {nextAction.toUpperCase()}</Text>
              {nextAction === 'avs' || nextAction === 'avs_noauth' ? (
                Object.keys(billingAddress).map((key) => (
                  <TextInput
                    key={key}
                    style={styles.input}
                    value={billingAddress[key]}
                    onChangeText={(value) => setBillingAddress((current) => ({ ...current, [key]: value }))}
                    placeholder={key}
                    autoCapitalize="characters"
                  />
                ))
              ) : (
                <TextInput style={styles.input} value={authValue} onChangeText={setAuthValue} keyboardType="numeric" secureTextEntry={nextAction === 'pin'} placeholder={`Enter ${nextAction}`} />
              )}
              <TouchableOpacity 
                style={[styles.primaryButton, loading && styles.buttonDisabled]} 
                onPress={!loading ? handleAuthorize : undefined}
                activeOpacity={loading ? 1 : 0.7}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Continue</Text>}
              </TouchableOpacity>
            </View>
          )}

          {(!charge || nextAction === 'none' || nextAction === 'verify') && (
            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.buttonDisabled]} 
              onPress={!loading ? handleInitialize : undefined}
              activeOpacity={loading ? 1 : 0.7}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Charge card</Text>}
            </TouchableOpacity>
          )}
          {loading && <ActivityIndicator color={BRAND_COLOR} style={styles.loader} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
    {browserDetails && (
      <Browser
        visible
        {...browserDetails}
        onClose={() => setBrowserDetails(null)}
      />
    )}
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  label: { color: '#64748B', fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, fontSize: 15, color: '#1E293B', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  third: { flex: 1 },
  authBox: { marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.8)' },
  invoiceAmountBox: { marginTop: 4, marginBottom: 4 },
  invoiceAmount: { color: BRAND_COLOR, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  feeHint: { color: '#64748B', fontSize: 12, marginBottom: 8 },
  feeRow: { color: '#475569', fontSize: 14, marginBottom: 4 },
  payerTotal: { color: BRAND_COLOR, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  authTitle: { color: BRAND_COLOR, fontWeight: '800', marginBottom: 10 },
  primaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: BRAND_COLOR, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  primaryText: { color: '#FFF', fontWeight: '800' },
  loader: { marginTop: 14 },
});

export default CardDeposit;
