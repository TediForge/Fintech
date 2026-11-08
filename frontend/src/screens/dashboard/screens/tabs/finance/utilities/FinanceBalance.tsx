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
  Easing,
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

const BalanceCardWithNewCard = () => {
  const { balances: walletBalances = {}, accounts, loading } = useApiClient();
  const primaryAccount = accounts?.find((entry) => entry.isPrimary)?.account;
  const navigation = useNavigation();

  const [expanded, setExpanded] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [showToday, setShowToday] = useState(true);
  const animation = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const iconOpacityAnim = useRef(new Animated.Value(1)).current;

  // --- Animation Logic for Balance Count-Up ---
  const balances = [
    { name: 'Wallet Balance', value: walletBalances.MAIN?.balance },
    { name: 'Cashback', value: walletBalances.CASHBACK?.balance },
    { name: 'SmartWealth', value: walletBalances.SMARTWEALTH?.balance, navigateTo: 'SmartWealthScreen' },
    { name: 'SmartLock', value: walletBalances.SMARTLOCK?.balance, navigateTo: 'SmartWealthScreen' },
    { name: 'Spend & Save', value: walletBalances['SPEND&SAVE']?.balance, navigateTo: 'SpendSaveScreen' },
  ];

  const totalBalance = balances.reduce(
    (sum, item) => sum + parseFloat(item.value || 0),
    0
  );

  const [animatedTotalValue, setAnimatedTotalValue] = useState(totalBalance);
  const totalCountAnim = useRef(new Animated.Value(Number(totalBalance ?? 0))).current;

  useEffect(() => {
    const listenerId = totalCountAnim.addListener(({ value }) => {
      if (typeof value === 'number') {
        setAnimatedTotalValue(value);
      }
    });
    return () => totalCountAnim.removeListener(listenerId);
  }, []);

  useEffect(() => {
    Animated.timing(totalCountAnim, {
      toValue: Number(totalBalance ?? 0),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [totalBalance]);
  // --------------------------------------------

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

  const toggleCard = () => {
    Animated.timing(animation, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  const cardHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 195],
  });

  const arrowRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

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
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      Alert.sheet('Copied!', 'Account details copied to clipboard.', [{ text: 'OK' }], { cancelable: true });
    } catch (error) {
      Alert.sheet('Error', 'Failed to copy. Please try again.');
    }
  };

  const displayAccountNumber = primaryAccount?.accountNumber || '';
  const displayAccountName = primaryAccount?.accountName || (loading ? 'Loading Account Details..' : 'User');
  const displayBankName = primaryAccount?.bankName || 'Bank account';

  return (
    <View style={[styles.container, { marginVertical: 10 * scale, }]}>
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
              activeOpacity={0.8} 
              onPress={() => navigation.navigate('WalletScreen')}
            >
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'left', alignItems: 'center', }}>
              <Text style={[styles.balanceLabel, { fontSize: 11 * scale }]}>Total Balance</Text>
              <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/271/271228.png' }}
                style={styles.seeAllIcon}
              />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                {isBalanceVisible ? (
                  <>
                    <Text style={[styles.balanceAmount, { letterSpacing: 0.7, }]}>₦{formatNumber(animatedTotalValue)}</Text>
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
                onPress={() => navigation.navigate('TransactionHistoryScreen')}
              >
                <Text style={[styles.buttonText, { fontSize: 10, padding: 1, }]}>View History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>

      <Animated.View
        style={[
          styles.newCard,
          {
            height: cardHeight,
            backgroundColor: 'rgba(56, 183, 110, 0.20)',
          },
        ]}
      >
        {expanded && (
          <View style={styles.newCardContent}>
            {balances.map((item, index) => (
              <React.Fragment key={index}>
                <TouchableOpacity
                  style={styles.balanceRow}
                  onPress={() => item.navigateTo && navigation.navigate(item.navigateTo)}
                  disabled={!item.navigateTo}
                  activeOpacity={0.7}
                >
                  <View style={styles.balancePartLeft}>
                    <Text style={styles.balanceLabelExpanded}>{item.name}</Text>
                  </View>
                  <View style={styles.balancePartCenter}>
                    <Text style={styles.balanceValueExpanded}>
                        {isBalanceVisible ? `₦${formatNumber(item.value)}` : '****'}
                    </Text>
                  </View>
                  <View style={styles.balancePartRight}>
                    {item.navigateTo && <Ionicons name="chevron-forward-outline" size={13} color="#444" />}
                  </View>
                </TouchableOpacity>
                {index < balances.length - 1 && <View style={styles.dashedSeparator} />}
              </React.Fragment>
            ))}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={toggleCard}
          style={styles.newCardHeader}
        >
          <Animated.View style={{ transform: [{ rotate: arrowRotation }] }}>
            <Ionicons name="chevron-down-outline" size={15} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default BalanceCardWithNewCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -37,
    zIndex: 5,
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
    backgroundColor: '#ECF6F3',
    flex: 1,
  },
  avatar: {
    backgroundColor: '#022c22',
    justifyContent: 'center',
    alignItems: 'center',
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
    height: 38,
    overflow: 'hidden',
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
    zIndex: 10,
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
  newCard: {
    width: '100%',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -20,
    overflow: 'hidden',
    zIndex: 1,
    justifyContent: 'flex-end',
  },
  newCardHeader: {
    width: '100%',
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newCardContent: {
    padding: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  balancePartLeft: {
    flex: 1.2,
    justifyContent: 'center',
  },
  balancePartCenter: {
    flex: 1.5,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  balancePartRight: {
    flex: 0.3,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  balanceLabelExpanded: {
    color: '#444',
    opacity: 0.8,
    fontSize: 11,
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  balanceValueExpanded: {
    color: '#444',
    fontSize: 11,
    letterSpacing: 0.2,
    fontWeight: '700',
    textAlign: 'left',
  },
  dashedSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    borderStyle: 'dashed',
    marginVertical: 5,
    opacity: 0.3,
  },
});