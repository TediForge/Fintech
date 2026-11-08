import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import useApiClient from '@hooks/apiClient';
import DashboardHeader from '@components/headers/DashboardHeader';
import MeFeaturesUnified from './utilities/MeFeaturesUnified';
import AdvertSlider from '@components/ads/AdvertSlider';
import { useTheme } from '@providers/ThemeProvider';

import { normalize } from '@lib/utils/normalize';

const StaticAdvertPlaceholder = ({ isDark }) => (
  <View style={[styles.advertPlaceholderShell, isDark && styles.placeholderDark]} />
);

const StaticFeaturesPlaceholder = React.memo(({ isDark }) => (
  <View style={[styles.featuresPlaceholderShell, isDark && styles.placeholderContainerDark]}>
    {[1, 2, 3].map((id) => (
      <View key={`me_static_row_${id}`} style={[styles.placeholderRow, isDark && styles.separatorDark]}>
        <View style={[styles.placeholderIconShape, isDark && styles.placeholderDark]} />
        <View style={styles.placeholderTextStack}>
          <View style={[styles.placeholderBaseLine, isDark && styles.placeholderDark, { width: '40%', height: 12 }]} />
          <View style={[styles.placeholderBaseLine, isDark && styles.placeholderDark, { width: '70%', height: 8, marginTop: 6 }]} />
        </View>
        <View style={[styles.placeholderBaseLine, isDark && styles.placeholderDark, { width: 16, height: 12 }]} />
      </View>
    ))}
  </View>
));

const MeScreen = () => {
  const navigation = useNavigation(),
    { isDark, colors } = useTheme(),
    { headerText, user, profileImage, tier, loading } = useApiClient(),
    [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!loading) setMounted(true);
  }, [loading]);

  const isScreenLoading = loading && !mounted;

  const sections = useMemo(() => [
    { id: 'advert' },
    { id: 'features' },
  ], []);

  const renderItem = useCallback(({ item }) => {
    switch (item.id) {
      case 'advert':
        return isScreenLoading ? <StaticAdvertPlaceholder isDark={isDark} /> : <AdvertSlider />;
      case 'features':
        return isScreenLoading ? <StaticFeaturesPlaceholder isDark={isDark} /> : <MeFeaturesUnified />;
      default:
        return null;
    }
  }, [isScreenLoading, isDark]);

  return (
    <LinearGradient
      colors={isDark ? [colors.background, colors.background] : [colors.surfaceAlt, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent={true}
      />

      <View style={{ flex: 1 }}>
        <DashboardHeader
          type={2}
        />

        <FlatList
          data={sections}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          overScrollMode="never"
          scrollEventThrottle={16}
          decelerationRate="normal"
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </View>

    </LinearGradient>
  );
};

export default MeScreen;

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: normalize(150),
  },
  horizontalDivider: { 
    height: 1, 
    width: '100%', 
    marginBottom: 10 
  },
  advertPlaceholderShell: {
    width: '100%',
    height: 100,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    marginBottom: 12,
  },
  placeholderDark: {
    backgroundColor: '#1E1E1E',
    borderWidth: 0,
  },
  featuresPlaceholderShell: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginVertical: 12,
  },
  placeholderContainerDark: {
    backgroundColor: '#1E1E1E',
    borderWidth: 0,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderColor: '#F1F5F9',
  },
  separatorDark: {
    borderColor: '#242424',
  },
  placeholderIconShape: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  placeholderIconDark: {
    backgroundColor: '#242424',
  },
  placeholderTextStack: {
    flex: 1,
    marginLeft: 12,
  },
  placeholderBaseLine: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
});