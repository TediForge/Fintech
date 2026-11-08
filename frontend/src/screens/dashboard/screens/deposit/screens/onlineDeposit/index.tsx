import { Alert } from '@components/common/Alert';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import LoadingScreen from '@components/Loading/LoadingScreen';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';

const INVOICE_ENDPOINT = `${apiConfig.baseUrl}/v1/banking/invoices/index.php`;
const BRAND_COLOR = '#0E3C2E';

const OnlineDepositScreen = () => {
  const navigation = useNavigation();
  const [amount, setAmount] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);

  const paymentMethods = [
    {
      id: 'card',
      title: 'Card',
      desc: 'Pay with a debit or credit card',
      icon: 'card-outline',
      navigateTo: 'cardDeposit',
      isActive: true,
    },
    {
      id: 'ussd',
      title: 'USSD',
      desc: 'Pay through your bank USSD code',
      icon: 'phone-portrait-outline',
      navigateTo: 'ussdDeposit',
      isActive: true,
    },
  ];

  const createInvoice = async () => {
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue < 100 || amountValue > 9999) {
      Alert.sheet('Invalid amount', 'Enter an amount between ₦100 and ₦9,999.');
      return;
    }

    setLoading(true);
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        Alert.sheet('Session expired', 'Please log in again.');
        return;
      }

      const response = await fetch(INVOICE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'create',
          [config.sessionToken]: sessionToken,
          type: 'paymentLink',
          currency: 'NGN',
          purpose: 'walletDeposit',
          amount: {
            value: amountValue,
            isFixed: true,
          },
          description: 'Wallet deposit payment link',
        }),
      });
      const result = await response.json();
      if (result?.status !== 'success' || !result.data?.invoiceNumber) {
        throw new Error(result?.message || 'Could not create the payment link.');
      }
      setInvoice({
        ...result.data,
        amount: result.data.amount ?? amountValue,
        currency: result.data.currency || 'NGN',
      });
    } catch (error) {
      Alert.sheet('Payment link failed', error.message || 'Could not create the payment link.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen visible message="Creating payment link" />;

  return (
    <LinearGradient colors={['#e6f2ed', '#f5f8f7']} style={styles.container}>
      <ScreenHeader title="Online Deposit" backgroundColor="#e6f2ed" textColor="#000" iconColor="#000" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!invoice ? (
          <View style={styles.panel}>
            <View style={styles.iconWrap}>
              <Ionicons name="receipt-outline" size={28} color={BRAND_COLOR} />
            </View>
            <Text style={styles.title}>Create a payment link</Text>
            <Text style={styles.subtitle}>Set the amount, then choose Card or USSD to pay.</Text>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="₦100 - ₦9,999"
              editable={!loading}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={createInvoice} disabled={loading}>
              <Text style={styles.primaryText}>Create payment link</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.panel}>
              <Text style={styles.eyebrow}>Payment link created</Text>
              <Text style={styles.amount}>₦{Number(invoice.amount).toLocaleString()}</Text>
              <Text style={styles.reference}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.methodsSection}>
              <Text style={styles.methodsTitle}>Choose payment method</Text>
              <FeatureCardGrid
                items={paymentMethods.filter((method) => method.isActive)}
                onPress={(method) => navigation.navigate(method.navigateTo, {
                  invoiceNumber: invoice.invoiceNumber,
                  amount: Number(invoice.amount),
                  currency: invoice.currency || 'NGN',
                })}
                delayMs={0}
              />
            </View>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  panel: { backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 18, padding: 20 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DCEDE6', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { color: BRAND_COLOR, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#14251F', fontSize: 23, fontWeight: '800', marginBottom: 8 },
  amount: { color: '#14251F', fontSize: 32, fontWeight: '900', marginTop: 8 },
  reference: { color: '#64748B', fontSize: 12, marginTop: 6 },
  subtitle: { color: '#64748B', lineHeight: 20, marginBottom: 20 },
  label: { color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderColor: '#D7E3DE', borderWidth: 1, borderRadius: 12, padding: 14, color: '#14251F', fontSize: 16 },
  primaryButton: { backgroundColor: BRAND_COLOR, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryText: { color: '#FFF', fontWeight: '800' },
  methodsSection: { marginTop: 20 },
  methodsTitle: { color: BRAND_COLOR, fontSize: 15, fontWeight: '800', marginBottom: 10 },
});

export default OnlineDepositScreen;
