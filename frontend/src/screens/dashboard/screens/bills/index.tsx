import React, { useMemo, useState } from 'react';
import {
  LinearGradient,
} from 'expo-linear-gradient';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@providers/ThemeProvider';
import ScreenHeader from '@components/headers/ScreenHeader';
import SearchBar from '@components/common/SearchBar';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';
import UnifiedServiceSection from '@components/extra/UnifiedServiceSection';

export const billServices = [
  {
    id: 'airtime',
    title: 'Buy Airtime',
    subtitle: 'Instant airtime recharge',
    route: 'AirtimeScreen',
    icon: 'phone-portrait-outline',
  },
  {
    id: 'data',
    title: 'Buy Data',
    subtitle: 'Affordable data bundles',
    route: 'DataScreen',
    icon: 'wifi-outline',
  },
  {
    id: 'electricity',
    title: 'Electricity',
    subtitle: 'Pay electricity bills easily',
    route: 'ElectricityScreen',
    icon: 'flash-outline',
  },
  {
    id: 'cable',
    title: 'Cable TV',
    subtitle: 'Renew cable TV subscriptions',
    route: 'CableTvScreen',
    icon: 'tv-outline',
  },
  {
    id: 'betting',
    title: 'Betting',
    subtitle: 'Fund betting wallets instantly',
    route: 'BettingScreen',
    icon: 'cash-outline',
  },
  {
    id: 'education',
    title: 'Education',
    subtitle: 'Pay for examination services',
    route: 'EducationScreen',
    icon: 'school-outline',
  },
];

const moreOptions = [
  {
    id: 'scheduled-bills',
    title: 'Scheduled Bills',
    subtitle: 'Manage recurring payments',
    route: 'ScheduledBills',
    icon: 'calendar-outline',
  },
];

export default function BillsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return billServices;

    return billServices.filter((service) =>
      `${service.title} ${service.subtitle}`.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const backgroundColors = isDark
    ? [colors.background, colors.background]
    : [colors.surfaceAlt, colors.background];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient colors={backgroundColors} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader
            title="Bills"
            backgroundColor={colors.surface}
            textColor={colors.textPrimary}
            iconColor={colors.textPrimary}
          />

          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder="Search bills"
            containerStyle={styles.searchBar}
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <FeatureCardGrid
              items={filteredServices.map((service) => ({
                ...service,
                desc: service.subtitle,
              }))}
              onPress={(service) => navigation.navigate(service.route)}
              delayMs={0}
            />

            <UnifiedServiceSection
              title="More"
              items={moreOptions}
              rowMode="chevron"
              marginVertical={10}
              onItemPress={(item) => navigation.navigate(item.route)}
            />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    marginTop: 20,
    paddingBottom: 32,
  },
});
