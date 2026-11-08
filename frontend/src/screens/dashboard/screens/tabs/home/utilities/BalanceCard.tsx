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
import { useAuthState } from '@hooks/useAuth';
import { useVisualDelay } from '@hooks/useVisualDelay';

const { width: screenWidth } = Dimensions.get('window');
const baseWidth = 410;
const scale = screenWidth / baseWidth;

const BRAND_COLOR = '#0c5b3f';
const INACTIVE_COLOR = '#D1E4DD';

// ============================================
// SKELETON COMPONENTS
// ============================================

/**
 * Skeleton that matches the final BalanceCard layout
 */
const BalanceCardSkeleton = () => (
  <View style={[styles.container, styles.fixedHeight, { marginVertical: 10 * scale, marginHorizontal: 16 * scale }]}>
    <ImageBackground
      source={{ uri: 'https://paysmart.com.ng/assets/images/pattern.jpeg' }}
      style={[styles.balanceBox, { padding: 16 * scale, borderRadius: 16 * scale }]}
      imageStyle={{ borderRadius: 16 * scale }}
    >
      <View style={styles.overlay} />
      <View style={styles.balanceContent}>
        {/* Top section with eye icon - static, no skeleton needed */}
        <View style={[styles.balanceContentBottom2, { marginBottom: 20 * scale }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons 
              name="eye-off-outline" 
              size={20 * scale} 
              color="#fff" 
              style={{ opacity: 0.8 }}
            />
          </View>
          <Text style={[styles.balanceLabel, { fontSize: 11 * scale, marginLeft: 5 }]}>
            {"Protected by NLL\u00AE"}
          </Text>
        </View>

          <View style={styles.balanceContentBottom}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'left', alignItems: 'center', marginBottom: 8 * scale }}>
              <Text style={[styles.balanceLabel, { fontSize: 11 * scale }]}>Available Balance</Text>
              <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/271/271228.png' }}
                style={styles.seeAllIcon}
              />
            </View>
            <View style={{ height: 24 * scale, width: 120 * scale, borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
          </View>
          <View style={[styles.ring22, { borderRadius: 30 * scale, padding: 3 * scale }]}>
            <View style={[styles.button22, { paddingVertical: 4 * scale, paddingHorizontal: 14 * scale, borderRadius: 30 * scale }]}>
              <Text style={[styles.buttonText, { fontSize: 10, padding: 1, }]}>View History</Text>
            </View>
          </View>
        </View>
      </View>
    </ImageBackground>

    {/* Bottom account card - values skeleton only */}
    <View style={styles.topSection}>
      <View style={[styles.nameWrapper, { borderRadius: 15 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{ width: 24 * scale, height: 24 * scale, borderRadius: 12 * scale, backgroundColor: '#999' }} />
          <View style={styles.nameSection}>
            <View style={{ height: 9 * scale, width: '70%', borderRadius: 4, backgroundColor: '#E0E0E0', marginBottom: 4 }} />
            <View style={{ height: 8 * scale, width: '85%', borderRadius: 4, backgroundColor: '#E0E0E0' }} />
          </View>
        </View>
        <View style={{ width: 24 * scale, height: 24 * scale, borderRadius: 12 * scale, backgroundColor: '#999' }} />
      </View>
    </View>
  </View>
);

/**
 * Skeleton for guest state
 */
const GuestCardSkeleton = () => (
  <View style={[styles.container, styles.fixedHeight, { marginVertical: 10 * scale, marginHorizontal: 16 * scale }]}>
    <View style={[styles.guestBox, { padding: 16 * scale, borderRadius: 16 * scale }]}>
      <View style={styles.guestContent}>
        {/* Values only - static labels are shown in real content */}
        <View style={{ height: 24 * scale, width: '60%', borderRadius: 6, backgroundColor: '#E0E0E0', marginBottom: 12 * scale }} />
        <View style={{ height: 12 * scale, width: '85%', borderRadius: 4, backgroundColor: '#E0E0E0', marginBottom: 8 * scale }} />
        <View style={{ height: 12 * scale, width: '75%', borderRadius: 4, backgroundColor: '#E0E0E0', marginBottom: 16 * scale }} />
        <View style={{ height: 40 * scale, width: '50%', borderRadius: 8 * scale, backgroundColor: '#E0E0E0' }} />
      </View>
    </View>
  </View>
);

// ============================================
// PROGRESSIVE SECTIONS
// ============================================

/**
 * Balance section with independent loading state
 */
const BalanceSection = ({ isBalanceVisible, setIsBalanceVisible, animatedValue, user, handleBalancePress, handleViewHistory, showPlaceholder }) => {
  const formatNumber = (num) => {
    const n = parseFloat(num || 0).toFixed(2);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <>
      <View style={[styles.balanceContentBottom2, { marginBottom: 20 * scale }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setIsBalanceVisible(!isBalanceVisible)}>
            <Ionicons 
              name={isBalanceVisible ? 'eye-outline' : 'eye-off-outline'} 
              size={20 * scale} 
              color="#fff" 
              style={{ opacity: 0.8 }}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.balanceLabel, { fontSize: 11 * scale, marginLeft: 5 }]}>
          {"Protected by NLL\u00AE"}
        </Text>
      </View>

      <View style={styles.balanceContentBottom}>
        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={handleBalancePress}
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
              {showPlaceholder ? (
                <View style={{ height: 24 * scale, width: 120 * scale, borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
              ) : (
                isBalanceVisible ? (
                  <Text style={[styles.balanceAmount, { letterSpacing: 0.7 }]}>₦{formatNumber(animatedValue)}</Text>
                ) : (
                  <Text style={[styles.balanceAmount, { fontSize: 10, textTransform: 'uppercase', lineHeight: 14, marginTop: 3, opacity: 0.8, }]}>
                    Confidential
                  </Text>
                )
              )}
            </View>
          </View>
        </TouchableOpacity>

        <View style={[styles.ring22, { borderRadius: 30 * scale, padding: 3 * scale }]}>
          <TouchableOpacity activeOpacity={0.9}
            style={[styles.button22, { paddingVertical: 4 * scale, paddingHorizontal: 14 * scale, borderRadius: 30 * scale }]}
            onPress={handleViewHistory}
          >
            <Text style={[styles.buttonText, { fontSize: 10, padding: 1, }]}>View History</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

/**
 * Account information section with independent loading
 */
const AccountSection = ({ account, copyToClipboard, showPlaceholder }) => {
  const displayAccountNumber = account?.accountNumber || '';
  const displayAccountName = account?.accountName || 'User';
  const displayBankName = account?.bankName || 'Bank account';

  return (
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
          </View>

          <View style={styles.nameSection}>
            {showPlaceholder ? (
              <>
                <View style={{ height: 9 * scale, width: '70%', borderRadius: 4, backgroundColor: '#E0E0E0', marginBottom: 4 }} />
                <View style={{ height: 8 * scale, width: '85%', borderRadius: 4, backgroundColor: '#E0E0E0' }} />
              </>
            ) : (
              <>
                <Text style={[styles.nameText, { fontSize: 9.5 }]} numberOfLines={1}>
                  {displayAccountName}
                </Text>
                <Text style={[styles.bankText, { fontSize: 8.5 }]}>
                  {displayBankName} - {displayAccountNumber}
                </Text>
              </>
            )}
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
  );
};

/**
 * Guest content section with progressive loading
 */
const GuestContent = ({ requireLogin, showPlaceholder }) => {
  return (
    <View style={[styles.guestBox, { padding: 16 * scale, borderRadius: 16 * scale }]}>
      <View style={styles.guestContent}>
        {showPlaceholder ? (
          <>
            <View style={{ height: 24 * scale, width: '60%', borderRadius: 6, backgroundColor: '#E0E0E0', marginBottom: 12 * scale }} />
            <View style={{ height: 12 * scale, width: '85%', borderRadius: 4, backgroundColor: '#E0E0E0', marginBottom: 8 * scale }} />
            <View style={{ height: 12 * scale, width: '75%', borderRadius: 4, backgroundColor: '#E0E0E0', marginBottom: 16 * scale }} />
            <View style={{ height: 40 * scale, width: '50%', borderRadius: 8 * scale, backgroundColor: '#E0E0E0' }} />
          </>
        ) : (
          <>
            <Text style={styles.guestTitle}>Unlock Your Wallet</Text>
            <Text style={styles.guestSubtitle}>Sign in to view your balance and manage your account</Text>
            <TouchableOpacity 
              style={styles.guestButton}
              onPress={requireLogin}
            >
              <Text style={styles.guestButtonText}>Sign In Now</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const BalanceCard = ({ requireLogin, isAuthResolved = true }) => {
  const { user, accounts, balances = {}, loading: globalLoading } = useApiClient();
  const primaryAccount = accounts?.find((entry) => entry.isPrimary)?.account;
  const navigation = useNavigation();
  const { sessionToken, isAuthenticated, isAuthLoading } = useAuthState();

  const [copied, setCopied] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [showToday, setShowToday] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const iconOpacityAnim = useRef(new Animated.Value(1)).current;

  // Safe numeric conversion for the animation logic
  const mainBalance = balances.MAIN || {};
  const safeBalance = Number(mainBalance.availableBalance ?? 0);
  
  const [animatedValue, setAnimatedValue] = useState(safeBalance);
  const countAnim = useRef(new Animated.Value(safeBalance)).current;

  // ============================================
  // PROGRESSIVE LOADING - Section delays
  // ============================================
  
  // Determine if data is available for each section
  // Check both isAuthLoading and isAuthResolved like DashboardHeader does
  const isAuthReady = !isAuthLoading && isAuthResolved;
  const isBalanceReady = !isAuthLoading && !globalLoading && mainBalance.availableBalance !== undefined;
  const isAccountReady = !isAuthLoading && !globalLoading && primaryAccount?.accountNumber;
  
  // Apply visual delays to each section independently
  // Pass TRUE when data IS ready (hook expects isReady=true for ready state)
  const showBalancePlaceholder = useVisualDelay(isBalanceReady, 80);
  const showAccountPlaceholder = useVisualDelay(isAccountReady, 140);
  const showGuestPlaceholder = useVisualDelay(isAuthReady, 100);

  useEffect(() => {
    const listenerId = countAnim.addListener(({ value }) => {
      if (typeof value === 'number') {
        setAnimatedValue(value);
      }
    });
    return () => countAnim.removeListener(listenerId);
  }, []);

  useEffect(() => {
    Animated.timing(countAnim, {
      toValue: Number(mainBalance.availableBalance ?? 0),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [mainBalance.availableBalance]);

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

  const handleBalancePress = () => {
    if (!requireLogin()) return;
    navigation.navigate('WalletScreen');
  };

  const handleViewHistory = () => {
    if (!requireLogin()) return;
    navigation.navigate('TransactionHistoryScreen');
  };

  const copyToClipboard = async () => {
    if (!requireLogin()) return;
    
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

  // ============================================
  // RENDER LOGIC
  // ============================================

  // Show real component structure from the start - avoid layout shifts
  // During auth loading, all sections show placeholders
  // As auth completes and data loads, sections transition with staggered delays
  
  const showBalancePlaceholderDuringAuth = isAuthLoading || showBalancePlaceholder;
  const showAccountPlaceholderDuringAuth = isAuthLoading || showAccountPlaceholder;
  const showGuestPlaceholderDuringAuth = isAuthLoading || showGuestPlaceholder;

  // Not authenticated - show guest state with skeleton
  if (!isAuthLoading && !sessionToken) {
    return (
      <View style={[styles.container, styles.fixedHeight, { marginVertical: 10 * scale, marginHorizontal: 16 * scale }]}>
        <GuestContent 
          requireLogin={requireLogin}
          showPlaceholder={showGuestPlaceholderDuringAuth}
        />
      </View>
    );
  }

  // Authenticated - show wallet card with progressive loading
  // Uses real component structure throughout (no layout shifts)
  return (
    <View style={[styles.container, styles.fixedHeight, { marginVertical: 10 * scale, marginHorizontal: 16 * scale }]}>
      <ImageBackground
        source={{ uri: 'https://paysmart.com.ng/assets/images/pattern.jpeg' }}
        style={[styles.balanceBox, { padding: 16 * scale, borderRadius: 16 * scale }]}
        imageStyle={{ borderRadius: 16 * scale }}
      >
        <View style={styles.overlay} />
        <View style={styles.balanceContent}>
          <BalanceSection 
            isBalanceVisible={isBalanceVisible}
            setIsBalanceVisible={setIsBalanceVisible}
            animatedValue={animatedValue}
            user={user}
            handleBalancePress={handleBalancePress}
            handleViewHistory={handleViewHistory}
            showPlaceholder={showBalancePlaceholderDuringAuth}
          />
        </View>
      </ImageBackground>

      <AccountSection 
        account={primaryAccount}
        copyToClipboard={copyToClipboard}
        showPlaceholder={showAccountPlaceholderDuringAuth}
      />
    </View>
  );
};

export default BalanceCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
  },
  fixedHeight: {
    height: 158 * scale,
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
    borderColor: 'rgba(204, 204, 204, 0.30)',
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
    marginTop: 0.5,
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
  guestBox: {
    backgroundColor: '#F0F9F7',
    borderWidth: 1,
    borderColor: '#0c5b3f20',
    justifyContent: 'center',
    flex: 1,
    alignItems: 'center',
  },
  guestContent: {
    alignItems: 'center',
    paddingVertical: 20 * scale,
  },
  guestTitle: {
    fontSize: 18 * scale,
    fontWeight: '600',
    color: '#022c22',
    marginBottom: 8 * scale,
  },
  guestSubtitle: {
    fontSize: 13 * scale,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16 * scale,
    maxWidth: '85%',
  },
  guestButton: {
    backgroundColor: '#0c5b3f',
    paddingVertical: 12 * scale,
    paddingHorizontal: 24 * scale,
    borderRadius: 8 * scale,
    marginTop: 8 * scale,
  },
  guestButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14 * scale,
  },
});
