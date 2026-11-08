import { Alert } from '@components/common/Alert';
import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Easing, 
  ScrollView, 
  SafeAreaView, 
  Platform, 
  StatusBar 
} from 'react-native';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '@config/app';
import { apiConfig } from '@config/api';
import LoadingScreen from '@components/Loading/LoadingScreen';
import { getSessionToken } from '@hooks/useAuth';
import GridButton from './utilities/DebitTransaction/GridButton';
import TransactionStatusCard from './utilities/DebitTransaction/TransactionStatusCard';
import AdvertSlider from '@components/ads/AdvertSlider';
import ExtraServices from '@components/extra/ExtraServices';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = `${apiConfig.baseUrl}/v1/user/transactions/history.php`;

// Calculate structural top safe distance based on status bar heights
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 0;

export default function DebitTransactionResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { reference } = route.params || {};

  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true); 
  const pollRef = useRef(null);

  const [transaction, setTransaction] = useState({
    amount: 0,
    status: 'pending',
    message: 'Processing...',
    transaction_type: '',
    bonus_earned: 0,
    new_balance: '0.00',
    created_at: ''
  });

  const rotateAnim = useRef(new Animated.Value(0)).current;

  const fetchTransaction = async () => {
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
        );
        return;
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionReference: reference, [config.sessionToken]: sessionToken })
      });

      const result = await response.json();

      if (result.status === 'success' && result.details) {
        const txn = result.details;
        const statusNormalized = (txn.status || '').toLowerCase();

        let displayMessage = capitalize(statusNormalized);
        if (statusNormalized === 'success' || statusNormalized === 'successful') {
          displayMessage = 'Success';
        } else if (statusNormalized === 'failed') {
          displayMessage = 'Oops';
        } else if (statusNormalized === 'pending' || statusNormalized === 'processing') {
          displayMessage = 'Processing';
        }

        setTransaction({
          amount: parseFloat(txn.amount) || 0,
          status: statusNormalized,
          message: displayMessage,
          transaction_type: txn.transaction_type,
          bonus_earned: parseFloat(txn.bonus_earned) || 0,
          new_balance: txn.balance_after || '0.00',
          created_at: txn.created_at || ''
        });
      }
    } catch (err) {
      console.error("❌ Silent sync error:", err);
    } finally {
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  };

  useEffect(() => {
    if (!reference) {
      Alert.sheet("Error", "Invalid transaction reference");
      navigation.goBack();
      return;
    }
    fetchTransaction();
  }, [reference]);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchTransaction();
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []); 

  useEffect(() => {
    const isProcessing = ['pending', 'processing'].includes(transaction.status);

    let rotateAnimation;
    if (isProcessing) {
      rotateAnim.setValue(0);
      rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();
    }

    return () => {
      if (rotateAnimation) rotateAnimation.stop();
    };
  }, [transaction.status]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

  const handleGoHome = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
    );
  };

  if (loading)
    return <LoadingScreen visible={true} message="Verifying Status..." />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      
      {/* Structural Header Area, cleanly offsetting the device status bar boundary */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.closeIconBtn} onPress={handleGoHome} activeOpacity={0.7}>
          <View style={styles.vectorXIconContainer}>
            <View style={[styles.vectorLine, styles.lineRotationLeft]} />
            <View style={[styles.vectorLine, styles.lineRotationRight]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Primary Scroll Container */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <TransactionStatusCard transaction={transaction} rotate={rotate} />
        <GridButton transaction={transaction} reference={reference} />
        <ExtraServices discover={true} />
        
        <AdvertSlider />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#eff7f4',
  },
  headerBar: {
    width: '100%',
    paddingTop: STATUS_BAR_HEIGHT + 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 20,
  },
  closeIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26, 40, 34, 0.05)',
  },
  vectorXIconContainer: {
    width: 10,
    height: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vectorLine: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: '#1c2824',
    borderRadius: 1,
  },
  lineRotationLeft: {
    transform: [{ rotate: '45deg' }],
  },
  lineRotationRight: {
    transform: [{ rotate: '-45deg' }],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 290, // Calculated padding guarantees content clears the absolute sticky layout completely
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 12,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
});