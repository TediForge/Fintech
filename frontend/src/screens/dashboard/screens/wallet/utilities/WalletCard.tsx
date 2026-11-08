import { Alert } from '@components/common/Alert';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ImageBackground,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import useApiClient from '@hooks/apiClient';

const { width: screenWidth } = Dimensions.get('window');
const baseWidth = 410;
const scale = screenWidth / baseWidth;

const BRAND_COLOR = '#0c5b3f';
const INACTIVE_COLOR = '#D1E4DD';

const WalletCard = () => {
  const { balances = {}, accounts, loading } = useApiClient();
  const primaryAccount = accounts?.find((entry) => entry.isPrimary)?.account;
  const navigation = useNavigation();

  const [copied, setCopied] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [showToday, setShowToday] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const iconOpacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -15,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacityAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowToday((prev) => !prev);
        slideAnim.setValue(15);
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(iconOpacityAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num) => {
    const n = parseFloat(num || 0).toFixed(2);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const copyToClipboard = async () => {
    try {
      const accountNumber = primaryAccount?.accountNumber || 'N/A';
      const accountName = primaryAccount?.accountName || 'Incomplete KYC';
      const bankName = primaryAccount?.bankName || 'Contact Customer Support';
      const textToCopy = `${accountNumber}\n${accountName}\n${bankName}`;
      await Clipboard.setString(textToCopy);
      setCopied(true);
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      Alert.sheet('Copied!', 'Account details copied to clipboard.', [{ text: 'OK' }], { cancelable: true });
      setTimeout(() => setCopied(false), 4000);
    } catch (error) {
      Alert.sheet('Error', 'Failed to copy. Please try again.');
      console.error('Clipboard Error:', error);
    }
  };

  const displayAccountNumber = primaryAccount?.accountNumber || '';
  const displayAccountName = primaryAccount?.accountName || (loading ? 'Loading Account Details..' : 'User');
  const displayBankName = primaryAccount?.bankName || 'Bank account';

  return (
    <View style={[styles.container, { marginVertical: 10 * scale, marginHorizontal: 16 * scale }]}>
      <ImageBackground
        source={{ uri: 'https://paysmart.com.ng/assets/images/pattern.jpeg' }}
        style={[styles.balanceBox, { padding: 16 * scale, borderRadius: 16 * scale }]}
        imageStyle={{ borderRadius: 16 * scale }}
      >
        <View style={styles.overlay} />
        <View style={styles.balanceContent}>
          <View style={[styles.balanceContentBottom2, { marginBottom: 20 * scale }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" style={{ opacity: 0.6 }} />
              ) : (
                <TouchableOpacity onPress={() => setIsBalanceVisible(!isBalanceVisible)}>
                  <Ionicons 
                    name={isBalanceVisible ? 'eye-outline' : 'eye-off-outline'} 
                    size={20 * scale} 
                    color="#fff" 
                    style={{ opacity: 0.8 }}
                  />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.balanceLabel, { fontSize: 11 * scale, marginLeft: 5 }]}>
                 {"Protected by NLL\u00AE"}
              </Text>
          </View>

          <View style={styles.balanceContentBottom}>
            <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={() => {}}
                >
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'left', alignItems: 'center', }}>
              <Text style={[styles.balanceLabel, { fontSize: 11 * scale }]}>Available Balance</Text>
              <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/271/271228.png' }}
                style={styles.seeAllIcon}
              />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                {isBalanceVisible ? (
                  <>
                    <Text style={[styles.balanceAmount, { letterSpacing: 0.7 }]}>₦{formatNumber(balances.MAIN?.availableBalance)}</Text>
                  </>
                ) : (
                  <Text style={[styles.balanceAmount, { fontSize: 10, textTransform: 'uppercase', lineHeight: 14, marginTop: 3, opacity: 0.8, }]}>
                    Confidential
                  </Text>
                )}
              </View>
            </View>
            </TouchableOpacity>

            <View style={[styles.ring22, { borderRadius: 30 * scale, padding: 3 * scale }]}>
              <TouchableOpacity activeOpacity={0.9}
                style={[styles.button22, { paddingVertical: 4 * scale, paddingHorizontal: 14 * scale, borderRadius: 30 * scale }]}
                onPress={() => navigation.navigate('AddMoneyScreen')}
              >
                <Text style={[styles.buttonText, { fontSize: 10, padding: 1, }]}>Deposit Funds</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.topSection}>
        <View style={[styles.nameWrapper, { borderRadius: 15 }]}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} 
            onPress={copyToClipboard}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View 
                style={[
                  styles.avatar, 
                  { 
                    width: 24 * scale, 
                    height: 24 * scale, 
                    borderRadius: 15 * scale, 
                    zIndex: 2, 
                  }
                ]}
              >
                <Image
                  source={{ uri: 'https://paysmart.com.ng/assets/brand-logos/bitmap.png' }}
                  style={{ height: '90%', width: '90%', borderRadius: (24 * scale) / 2 }}
                />
              </View>

              {/*
              <View 
                style={[
                  styles.avatar, 
                  { 
                    width: 24 * scale, 
                    height: 24 * scale, 
                    borderRadius: 15 * scale, 
                    zIndex: 1 
                  }
                ]}
              >
                <Image
                  source={{ uri: 'https://cdn.phototourl.com/free/2026-03-30-dd9af0fd-4f34-49a4-a627-95832501fb66.png' }}
                  style={{ height: '85%', width: '85%', borderRadius: (24 * scale) / 2 }}
                />
              </View>
              */}
            </View>

            <View style={styles.nameSection}>
              <Text style={[styles.nameText, { fontSize: 9.5 }]} numberOfLines={1}>
                {displayAccountName}
              </Text>
              <Text style={[styles.bankText, { fontSize: 8.5 }]}>
                {displayBankName} - {displayAccountNumber}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={copyToClipboard}
            style={[styles.accountSection, { paddingLeft: 12, justifyContent: 'center', alignItems: 'center' }]}
          >
            <View style={{
              width: 24 * scale,
              height: 24 * scale,
              borderRadius: 12 * scale,
              backgroundColor: 'rgba(12, 91, 63, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 0.5,
              borderColor: '#0c5b3f'
            }}>
              <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/1621/1621635.png' }} 
                style={{ width: 12 * scale, height: 12 * scale, tintColor: '#0c5b3f' }} 
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default WalletCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
  },
  holderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holderDot: {
    backgroundColor: 'rgba(204, 204, 204, 0.50)',
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -37,
    zIndex: 1,
  },
  nameWrapper: {
    borderColor: 'rgba(204, 204, 204, 0.50)',
    borderWidth: 0.5,
    margin: 0.5,
    paddingTop: 40,
    paddingBottom: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECF6F3',
    flex: 1,
  },
  avatar: {
    backgroundColor: '#022c22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  nameSection: {
    flex: 1,
    marginLeft: 8,
  },
  nameText: {
    color: '#022c22',
    fontWeight: '500',
    marginTop: -1.5,
  },
  bankText: {
    color: '#555',
    fontWeight: '400',
    marginTop: 1.5,
  },
  accountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#e6f2ed',
    height: 30,
  },
  accountNumber: {
    color: '#111',
    fontWeight: '600',
    opacity: 0.7,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  balanceBox: {
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
    zIndex: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 44, 34, 0.88)',
  },
  balanceContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  balanceContentBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  balanceContentBottom2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  balanceLabel: {
    color: '#fff',
    fontWeight: '500',
    opacity: 0.7,
    letterSpacing: 0.1,
  },
  currencyText: {
    color: '#fff',
    fontWeight: '600',
    opacity: 0.8,
  },
  balanceAmount: {
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  ring22: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  button22: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  buttonText: {
    fontWeight: 'bold',
    color: 'rgba(2, 44, 34, 0.88)',
  },
  seeAllIcon: {
    width: 6,
    height: 6,
    marginLeft: 2,
    tintColor: '#fff',
    opacity: 0.8,
    marginTop: 1.5,
  },
});