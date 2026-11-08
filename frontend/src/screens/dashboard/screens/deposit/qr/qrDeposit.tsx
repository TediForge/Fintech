import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Dimensions, TextInput,
  TouchableOpacity, ActivityIndicator, ScrollView, Platform, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';

// --- ALL QR LINKS IN ONE PLACE ---
const BASE_URL = 'https://api.paysmart.com.ng/v1';

const API_LINKS = {
  QR_GATEWAY: `${BASE_URL}/banking/qr-deposit/qr-payment`,
  BRAND_LOGO: 'https://paysmart.com.ng/assets/brand-logos/bitmap.png',
};
// ------------------------------

const { width } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

export default function QrDeposit({ navigation }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [txRef, setTxRef] = useState(null);
  const [isGenerated, setIsGenerated] = useState(false);
  
  const pollingInterval = useRef(null);

  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  const initiateQR = async () => {
    const numAmount = parseFloat(amount);
    
    // Validation: Min 10, Max 9999
    if (!amount || numAmount < 10 || numAmount > 9999) {
      Alert.sheet("Invalid Amount", "Please enter an amount between ₦10 and ₦9,999");
      return;
    }

    setLoading(true);
    try {
      const token = await getSessionToken();
      const formData = new FormData();
      formData.append(config.sessionToken, token);
      formData.append('action', 'initiate_qr');
      formData.append('amount', amount);

      const response = await fetch(API_LINKS.QR_GATEWAY, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.status) {
        setQrCode(result.qr_code);
        setTxRef(result.tx_ref);
        setIsGenerated(true);
        startPolling(result.tx_ref);
      } else {
        Alert.sheet("Error", result.message || "Could not generate QR code");
      }
    } catch (error) {
      Alert.sheet("Error", "Check your internet connection");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (ref) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    pollingInterval.current = setInterval(() => {
      checkStatus(ref);
    }, 5000);
  };

  const checkStatus = async (ref) => {
    try {
      const token = await getSessionToken();
      const formData = new FormData();
      formData.append(config.sessionToken, token);
      formData.append('action', 'verify_status');
      formData.append('tx_ref', ref);

      const response = await fetch(API_LINKS.QR_GATEWAY, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.status === true) {
        clearInterval(pollingInterval.current);
        Alert.sheet("Success", "QR Payment Received!", [
          { text: "Go Home", onPress: () => navigation.navigate('Home') }
        ]);
      }
    } catch (e) {
      console.log("QR Polling error", e);
    }
  };

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      
      <ScreenHeader 
        title="QR Deposit" 
        backgroundColor="#eff7f4" 
        textColor="#000" 
        iconColor="#000" 
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Input Section - Hidden after generation */}
        {!isGenerated && (
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Enter Amount to Deposit</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>₦</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0.00"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                editable={!loading}
              />
            </View>
            <Text style={styles.limitHint}>Min: ₦10 • Max: ₦9,999</Text>

            <TouchableOpacity 
              style={[styles.generateBtn, loading && { opacity: 0.7 }]} 
              onPress={initiateQR}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.generateBtnText}>Generate Payment QR</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* QR Display Section - Visible only after successful generation */}
        {isGenerated && (
          <>
            <View style={styles.amountDisplayCard}>
              <Text style={styles.amountLabel}>Paying</Text>
              <Text style={styles.amountText}>₦{Number(amount).toLocaleString()}</Text>
            </View>

            <View style={styles.qrContainer}>
                <View style={styles.qrWrapper}>
                  <Image 
                    source={{ uri: qrCode }} 
                    style={styles.qrImage} 
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.instruction}>
                  Scan this code with your banking app to complete the transaction.
                </Text>
            </View>

            <View style={styles.statusBox}>
              <ActivityIndicator size="small" color={BRAND_COLOR} style={{ marginRight: 10 }} />
              <Text style={styles.statusText}>Waiting for scan detection...</Text>
            </View>
          </>
        )}

        <TouchableOpacity 
          style={styles.cancelBtn} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>{isGenerated ? "Cancel Transaction" : "Go Back"}</Text>
        </TouchableOpacity>

        <View style={styles.securityInfo}>
          <Ionicons name="shield-checkmark" size={14} color="#27AE60" />
          <Text style={styles.securityText}>Secured QR Checkout</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { 
    alignItems: 'center', 
    paddingHorizontal: 25 * scale,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 70 : 110,
    paddingBottom: 40
  },
  // Input Styles
  inputCard: {
    backgroundColor: '#FFF',
    width: '100%',
    borderRadius: 20,
    padding: 25 * scale,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  inputLabel: { fontSize: 14, color: '#666', fontWeight: '600', marginBottom: 15 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: BRAND_COLOR,
    paddingBottom: 5,
  },
  currencyPrefix: { fontSize: 24, fontWeight: '700', color: BRAND_COLOR, marginRight: 5 },
  textInput: { flex: 1, fontSize: 32, fontWeight: '900', color: BRAND_COLOR },
  limitHint: { fontSize: 11, color: '#999', marginTop: 10, textAlign: 'center' },
  generateBtn: {
    backgroundColor: BRAND_COLOR,
    marginTop: 25,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  // QR Styles
  amountDisplayCard: { alignItems: 'center', marginBottom: 20 },
  amountLabel: { fontSize: 13, color: '#999', fontWeight: '600' },
  amountText: { fontSize: 32 * scale, fontWeight: '900', color: BRAND_COLOR },
  
  qrContainer: {
    backgroundColor: '#FFF',
    width: '100%',
    borderRadius: 25,
    padding: 30 * scale,
    alignItems: 'center',
    elevation: 4,
  },
  qrWrapper: {
    width: 240 * scale,
    height: 240 * scale,
    backgroundColor: '#F9F9F9',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrImage: { width: '90%', height: '90%' },
  instruction: { marginTop: 20 * scale, textAlign: 'center', fontSize: 13, color: '#666', lineHeight: 20 },

  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    backgroundColor: 'rgba(14, 60, 46, 0.05)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20
  },
  statusText: { fontSize: 12, color: BRAND_COLOR, fontWeight: '600' },

  cancelBtn: { marginTop: 40, padding: 10 },
  cancelText: { color: '#E74C3C', fontWeight: '700' },

  securityInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  securityText: { fontSize: 11, color: '#999', marginLeft: 6 }
});