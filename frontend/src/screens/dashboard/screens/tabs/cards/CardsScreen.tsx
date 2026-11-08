import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import useApiClient from '@hooks/apiClient';
import Tabs from '@components/extra/Tabs';
import StaticHeader from '@components/headers/StaticHeader';

// Importing Separate Components
import VirtualCardPage from './components/VirtualCardPage';
import PhysicalCardPage from './components/PhysicalCardPage';

const TABS = [
  { label: 'Virtual Card', value: 'virtual' },
  { label: 'Physical Card', value: 'physical' },
];

export default function CardsScreen() {
  const [activeTab, setActiveTab] = useState('virtual'),
    navigation = useNavigation(),
    { loading } = useApiClient(),
    [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!loading) {
      setMounted(true);
    }
  }, [loading]);

  const isScreenLoading = loading && !mounted;
  const pageAvailability = {
    virtual: true,
    physical: false,
  };
  const isCurrentPageActive = pageAvailability[activeTab];

  const renderComingSoon = () => (
    <View style={styles.comingSoonContainer}>
      <Text style={styles.comingSoonTitle}>Coming Soon</Text>
      <Text style={styles.comingSoonText}>
        {activeTab === 'virtual'
          ? 'Virtual card ordering is not available yet. Check back soon for the full experience.'
          : 'Physical card ordering is not available yet. Check back soon for the full experience.'}
      </Text>
    </View>
  );

  return (
    <> 
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <LinearGradient 
        colors={['#e6f2ed', '#f5f8f7']} 
        style={styles.gradientBackground}
      >
        <View style={styles.container}>
          {/* Header Area using the standardized StaticHeader component */}
          <StaticHeader 
            title="Cards"
            onRightIconPress={() => navigation.navigate('Settings', { page: 'reusable', category: 'cards' })}
            rightIconUri="https://cdn-icons-png.flaticon.com/128/16327/16327901.png"
          />

          <View style={styles.tabWrapper}>
            <Tabs 
              tabs={TABS} 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              loading={isScreenLoading} 
            />
          </View>
          {/* Content Area */}
          <View style={styles.contentContainer}>
            {isCurrentPageActive ? (
              activeTab === 'virtual' ? (
                <VirtualCardPage />
              ) : (
                <PhysicalCardPage />
              )
            ) : (
              renderComingSoon()
            )}
          </View>
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
  contentContainer: {
    flex: 1,
  },
  tabWrapper: {
    paddingHorizontal: 16,
  },
  comingSoonContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});