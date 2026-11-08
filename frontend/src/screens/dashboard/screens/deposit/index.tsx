import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '@components/headers/ScreenHeader';
import AdvertSlider from '@components/ads/AdvertSlider';
import BankCard from './bank/bankDeposit';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';
import { LinearGradient } from 'expo-linear-gradient';
import useApiClient from '@hooks/apiClient';

const { width } = Dimensions.get('window');
const baseWidth = 410; // Baseline for scaling (smallest common device width)
const scale = width / baseWidth;

const addMethods = [
  {
    title: 'Cash Deposit',
    desc: 'Deposit cash at bank or agent',
    icon: 'cash-outline',
    icon1: { uri: 'https://cdn-icons-png.flaticon.com/128/7928/7928274.png' },
    icon2: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    navigateTo: 'CashDepositScreen',
    isActive: true,
  },
  {
    title: 'Online Deposit',
    desc: 'Create an invoice and choose how to pay',
    icon: 'globe-outline',
    icon1: { uri: 'https://cdn-icons-png.flaticon.com/128/3916/3916663.png' },
    icon2: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    navigateTo: 'OnlineDepositScreen',
    isActive: true,
  },
];

const AddMoneyScreen = () => {
  const navigation = useNavigation();
  const { accounts } = useApiClient();
  const [hasBankAccounts, setHasBankAccounts] = useState((accounts || []).length > 0);

  useEffect(() => {
    setHasBankAccounts((accounts || []).length > 0);
  }, [accounts?.length]);

  const showBalanceCard = hasBankAccounts;

  return (
    <>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
          <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={styles.gradientBackground}>
            <View style={styles.wrapper}>
          <ScreenHeader
            title="Add Money"
            backgroundColor="#eff7f4"
            textColor="#000"
            iconColor="#000"
          />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        
        {showBalanceCard && (
          <>
            <BankCard onAccountsAvailable={setHasBankAccounts} />
            <Text style={styles.orText}>Other method</Text>
          </>
        )}

        {/* Method list */}
        <View style={styles.methodsWrap}>
          <FeatureCardGrid
            items={addMethods.filter((method) => method.isActive)}
            onPress={(method) => navigation.navigate(method.navigateTo)}
            delayMs={0}
          />
        </View>

        {/* Image Slider */}
        <View>
          <AdvertSlider />
        </View>
      </ScrollView>
              </View>
            </LinearGradient>
          </>
  );
};

export default AddMoneyScreen;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  scrollContent: {
      paddingTop: 20,
      paddingHorizontal: 20 * scale,
      paddingBottom: 40,
    },

  /** Separator **/
  orText: {
    fontSize: 10,
    textAlign: 'center',
    color: '#888',
    marginVertical: 10,
  },

  /** Deposit methods **/
  methodsWrap: {
    marginVertical: 10,
  },
});