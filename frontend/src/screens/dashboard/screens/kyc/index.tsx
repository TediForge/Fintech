import React from 'react';
import {
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@providers/ThemeProvider';
import ScreenHeader from '@components/headers/ScreenHeader';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import { brandConfig } from '@config/brand';
import NigeriaKycComponent from './components/NG';
import KenyaKycComponent from './components/KE';
import GhanaKycComponent from './components/GH';

const countryComponentMap = {
  NG: NigeriaKycComponent,
  KE: KenyaKycComponent,
  GH: GhanaKycComponent,
};

const getKycCountryComponent = (countryCode) => {
  const normalizedCode = String(countryCode || '').trim().toUpperCase();
  return countryComponentMap[normalizedCode] || NigeriaKycComponent;
};

const KycCountryContent = ({ countryCode, upgrade, ...props }) => {
  const CountryComponent = getKycCountryComponent(countryCode);
  return <CountryComponent {...props} upgrade={upgrade} />;
};

const { width } = Dimensions.get('window');
const scale = width / 410;

const KycScreen = ({ navigation, route }) => {
  const { isDark, colors } = useTheme();
  const { user } = useApiClient();
  const brandName = brandConfig.brandName || 'PaySmart';
  const countryCode = String(user?.countryCode || user?.country_code || 'NG').trim().toUpperCase();
  const isUpgradeFlow = Boolean(route?.params?.upgrade);

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent={true} />
      <LinearGradient colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]} style={styles.gradientBackground}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader
            title="KYC"
            backgroundColor={colors.surface}
            onBack={() => navigation?.goBack?.()}
            textColor={colors.textPrimary}
            iconColor={colors.textPrimary}
          />

          <KycCountryContent
            countryCode={countryCode}
            user={user}
            brandName={brandName}
            colors={colors}
            isDark={isDark}
            upgrade={isUpgradeFlow}
          />
        </SafeAreaView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20 * scale,
    paddingBottom: 40,
    paddingTop: 20,
  },
  unifiedCard: {
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    marginTop: 10,
    borderWidth: 0.1,
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  labelRow: { marginBottom: 12 },
  cardLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 11,
    lineHeight: 17,
  },
  metaText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  rowDesc: {
    fontSize: 11,
    lineHeight: 17,
  },
});

export default KycScreen;
