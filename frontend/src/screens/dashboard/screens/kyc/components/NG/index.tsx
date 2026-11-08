import { Alert } from '@components/common/Alert';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import KycLimitsCard from './utilities/kycLimits';
import LinkedIdentity from './utilities/LinkedIdentity';
import { handleProfile, kycProfile } from './handlers/handleProfile';
import SearchBar from '@components/common/SearchBar';
import Browser from '@components/common/Browser';

const { width } = Dimensions.get('window');
const scale = width / 410;

const normalizeTier = (value) => String(value || '').trim().toLowerCase();

const NigeriaKycComponent = ({ upgrade = false }) => {
  const navigation = useNavigation();
  const [nextTier, setNextTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openingCompliance, setOpeningCompliance] = useState(false);
  const [browserUrl, setBrowserUrl] = useState(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await handleProfile();
      setNextTier(result?.success && result?.data
        ? result.data?.next || result.data?.nextLevel || null
        : null);
    } finally {
      setRefreshing(false);
    }
  };

  const openCompliance = async () => {
    setOpeningCompliance(true);
    try {
      const result = await kycProfile.getComplianceAccess();
      setBrowserUrl(result.data.url);
    } catch (error) {
      Alert.sheet('Unable to open compliance', error?.message || 'Please try again');
    } finally {
      setOpeningCompliance(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadTierInfo = async () => {
      try {
        const result = await handleProfile();

        if (!isMounted) return;

        if (result?.success && result?.data) {
          const resolvedNextTier = result.data?.next || result.data?.nextLevel || null;
          setNextTier(resolvedNextTier);

        } else {
          setNextTier(null);
        }
      } catch (error) {
        if (isMounted) {
          setNextTier(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTierInfo();

    return () => {
      isMounted = false;
    };
  }, [upgrade, navigation]);

  const shouldShowUpgradeButton = !loading && (Boolean(nextTier) || upgrade);

  return (
    <>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#0E3C2E"
          colors={['#0E3C2E']}
        />
      )}
    >
      <View style={styles.verticalSpacing}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Search KYC options"
        />
      </View>

      <LinkedIdentity containerStyle={styles.verticalSpacing} />
      <KycLimitsCard />

      {shouldShowUpgradeButton && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={openCompliance}
          disabled={openingCompliance}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>{openingCompliance ? 'Opening Compliance...' : 'Continue to Compliance'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
    {browserUrl && (
      <Browser
        visible
        url={browserUrl}
        title="Tediwave Compliance"
        onClose={() => setBrowserUrl(null)}
      />
    )}
    </>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20 * scale,
    paddingBottom: 40,
    paddingTop: 20,
  },
  verticalSpacing: {
    marginVertical: 10,
  },
  container: {
    paddingVertical: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0E3C2E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  primaryButton: {
    backgroundColor: '#0E3C2E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default NigeriaKycComponent;
