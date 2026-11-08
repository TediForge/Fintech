import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  Platform, 
  StatusBar,
  Image,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import StaticHeader from '@components/headers/StaticHeader';
import { useTheme } from '@providers/ThemeProvider';
import useApiClient from '@hooks/apiClient';
import ExtraServices from '@components/extra/ExtraServices';
import AdvertSlider from '@components/ads/AdvertSlider';
import RewardAccess from './utilities/RewardAccess';
import BalanceCard from '@dashboard/screens/wallet/utilities/BalanceCard';
import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;

const BRAND_COLOR = '#0E3C2E';

export default function EarnScreen() {
  const navigation = useNavigation(),
    { isDark } = useTheme(),
    { loading } = useApiClient(),
    [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!loading) {
      setMounted(true);
    }
  }, [loading]);

  const isScreenLoading = loading && !mounted;

  const sections = useMemo(() => [
    { id: 'rewardCard' },
    { id: 'rewardAccess' },
    { id: 'divider' },
    { id: 'extraServices' },
    { id: 'advert' },
  ], []);

  const renderItem = useCallback(({ item }) => {
    switch (item.id) {
      case 'rewardCard':
        return (
          <BalanceCard
            name="Cashback balance"
            walletType="CASHBACK"
            marginVertical={10}
          />
        );
      case 'rewardAccess':
        return <RewardAccess isLoading={isScreenLoading} isDark={isDark} />;
      case 'divider':
        return <View style={[styles.divider, isDark && styles.dividerDark]} />;
      case 'extraServices':
        return <ExtraServices displayTask={true} isLoading={isScreenLoading} isDark={isDark} />;
      case 'advert':
        return (
          <View style={styles.advertWrapper}>
            <AdvertSlider isLoading={isScreenLoading} isDark={isDark} />
          </View> 
        );
      default:
        return null;
    }
  }, [isScreenLoading, isDark]);

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent={true} />
      <LinearGradient 
        colors={isDark ? ['#121212', '#121212'] : ['#FFFBE6', '#f5f8f7']} 
        style={styles.gradientBackground}
      >
        <View style={styles.container}> 
          
          <StaticHeader 
            title="Earn & Rewards"
            onRightIconPress={() => navigation.navigate('Settings', { page: 'reusable', category: 'earn' })}
            rightIconUri="https://cdn-icons-png.flaticon.com/128/16327/16327901.png"
            textColor={isDark ? "#E4E4E4" : "#000"}
            iconColor={isDark ? "#E4E4E4" : "#000"}
          />

          <FlatList
            data={sections}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            bounces={true}
            overScrollMode="never"
            decelerationRate="normal"
            contentContainerStyle={styles.scrollContent}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={10}
            scrollEventThrottle={16}
          />
        </View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  gradientBackground: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 25 },
  divider: { 
    height: 2, 
    width: '100%', 
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  dividerDark: {
    backgroundColor: 'transparent',
  },
  advertWrapper: { 
    marginBottom: 12, 
    marginTop: 10, 
  },
});