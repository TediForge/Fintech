import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StatusBar,
  Platform,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useApiClient from '@hooks/apiClient';
import { useTheme } from '@providers/ThemeProvider';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuthState, refreshAuthState } from '@hooks/useAuth';
import DashboardHeader from '@components/headers/DashboardHeader';
import AdvertSlider from '@components/ads/AdvertSlider';
import { openLoginSheet } from '@hooks/useAuth';
import SmallSizeImage from './utilities/SmallSizeImage';
import GrowthCards from './utilities/GrowthCards';
import BalanceCard from './utilities/BalanceCard';
import HomeQuickActions from './utilities/HomeQuickActions';
import KycUpgradeCard from './utilities/KycUpgradeCard';
import { QuickAccess } from './screens/services';
import ProfileTodoSection from '../../profile/utilities/ProfileTodoSection';
import { InProgressGiftCardSubmissions } from '../../giftCards/sell/SellGiftCard';

import { normalize } from '@lib/utils/normalize';

export default function HomeScreen({ renderTab }) {
  const navigation = useNavigation(),
    { isDark, colors } = useTheme(),
    {
      headerText,
      user,
      notificationCount,
      profileImage,
      tier,
      supportActive,
      sessionValid,
      loading,
    } = useApiClient();

  const { sessionToken } = useAuthState();
  const [refreshing, setRefreshing] = useState(false),
    [mounted, setMounted] = useState(false),
    [isProcessingNavigation, setIsProcessingNavigation] = useState(false);
  const isAuthResolved = !loading;

  // Require login helper function
  const requireLogin = useCallback(() => {
    if (!sessionToken) {
      openLoginSheet();
      return false;
    }
    return true;
  }, [sessionToken]);

  // Handle logged out state - show guest dashboard instead of navigating away
  useEffect(() => {
    if (!loading && sessionValid === false && sessionToken === null && !isProcessingNavigation) {
      // User is not authenticated - display guest dashboard
      setIsProcessingNavigation(false);
    }
  }, [loading, sessionValid, sessionToken, isProcessingNavigation]);

  useEffect(() => {
    if (!loading && !mounted) {
      setMounted(true);
    }
  }, [loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAuthState();
    } catch (err) {
      console.log('Error refreshing session:', err);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setRefreshing(false);
  };

  const sections = useMemo(() => [
    { id: 'balance' },
    { id: 'quickActions' },
    { id: 'kyc' },
    { id: 'smallImage' },
    { id: 'quickAccess' },
    { id: 'todoList' },
    { id: 'giftCardInProgress' },
    { id: 'growth' },
    { id: 'advert' },
  ], []);

  const renderSection = useCallback(({ item }) => {
    switch (item.id) {
      case 'balance':
        return (
          <BalanceCard
            requireLogin={requireLogin}
            isAuthResolved={isAuthResolved}
          />
        );
      case 'quickActions': return <HomeQuickActions renderTab={renderTab} requireLogin={requireLogin} isAuthResolved={isAuthResolved} />;
      case 'kyc': return isAuthResolved && tier < 3 ? <KycUpgradeCard requireLogin={requireLogin} isAuthResolved={isAuthResolved} /> : null;
      case 'smallImage': return <SmallSizeImage isAuthResolved={isAuthResolved} />;
      case 'quickAccess': return <QuickAccess renderTab={renderTab} requireLogin={requireLogin} isAuthResolved={isAuthResolved} />;
      case 'todoList': return <View style={styles.todoSection}><ProfileTodoSection /></View>;
      case 'giftCardInProgress': return <InProgressGiftCardSubmissions />;
      case 'growth': return <GrowthCards renderTab={renderTab} isAuthResolved={isAuthResolved} />;
      case 'advert': return <AdvertSlider renderTab={renderTab} />;
      default: return null;
    }
  }, [renderTab, requireLogin, isAuthResolved]);

  return (
    <LinearGradient
      colors={isDark ? [colors.background, colors.background] : [colors.surfaceAlt, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{
        flex: 1,
      }}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />

      <View style={{ flex: 1 }}>
        <DashboardHeader
          type={1}
        />

        <FlatList
          data={sections}
          renderItem={renderSection}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          bounces={true}
          overScrollMode="never"
          decelerationRate="normal"
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollArea}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
        />
      </View>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  todoSection: {
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  scrollArea: {
    paddingBottom: normalize(120),
    paddingTop: normalize(6),
  },
});