import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  Platform, 
  StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

// Importing Components
import useApiClient from '@hooks/apiClient';
import StaticHeader from '@components/headers/StaticHeader';
import SmartSavingsOptions from './utilities/FinanceOptions';
import FinanceAccess from './utilities/FinanceAccess';
import BalanceCard from './utilities/FinanceBalance';
import AdvertSlider from '@components/ads/AdvertSlider';

export default function FinanceScreen() {
  const navigation = useNavigation(),
    { loading } = useApiClient(),
    [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!loading) {
      setMounted(true);
    }
  }, [loading]);

  const isScreenLoading = loading && !mounted;

  const sections = useMemo(() => [
    { id: 'balance' },
    { id: 'access' },
    { id: 'advert' },
    { id: 'options' },
  ], []);

  const renderItem = useCallback(({ item }) => {
    switch (item.id) {
      case 'balance': return <BalanceCard isLoading={isScreenLoading} />;
      case 'access': return <FinanceAccess isLoading={isScreenLoading} />;
      case 'advert': return <AdvertSlider isLoading={isScreenLoading} />;
      case 'options': return <SmartSavingsOptions isLoading={isScreenLoading} />;
      default: return null;
    }
  }, [isScreenLoading]);

  const renderSeparator = useCallback(() => <View style={styles.divider} />, []);

  const handleHeaderPress = useCallback(() => {
    navigation.navigate('Settings', { page: 'reusable', category: 'finance' });
  }, [navigation]);

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <LinearGradient
        colors={['#D1EAE0', '#f5f8f7']}
        style={styles.gradientBackground}
      >
        <View style={styles.container}>
          {/* Reusable Fixed Header Layout component structure layer */}
          <StaticHeader 
            title="Finance"
            onRightIconPress={handleHeaderPress}
            rightIconUri="https://cdn-icons-png.flaticon.com/128/16327/16327901.png"
          />

          {/* Scrollable content */}
          <FlatList
            data={sections}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            ItemSeparatorComponent={renderSeparator}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            overScrollMode="never"
            bounces={true}
            decelerationRate="normal"
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
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  divider: { 
    height: 1, 
    width: '100%', 
    marginBottom: 10,
  },
});