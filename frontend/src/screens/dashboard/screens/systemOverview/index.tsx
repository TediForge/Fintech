// Copyright (c) 2026 Tediwave, all rights reserved, subject to the proprietary license located in the root directory
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useTheme } from '@providers/ThemeProvider';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';
import config from '@config/app';
import { brandConfig } from '@config/brand';
import Browser from '@components/common/Browser';

const servicesData = [
  { id: 1, title: "Gift Card", icon: "card-outline", desc: "Trade and redeem global cards." },
  { id: 2, title: "Bill Payment", icon: "receipt-outline", desc: "Airtime, Data, and Utility bills." },
  { id: 3, title: "Virtual Cards", icon: "globe-outline", desc: "USD cards for global shopping." },
  { id: 4, title: "Peer Payment", icon: "people-outline", desc: "Send money to friends instantly." },
  { id: 5, title: "Fixed Savings", icon: "lock-closed-outline", desc: "Earn interest on locked funds." },
];

const legalLinks = [
  { id: 'privacy', label: 'Privacy Policy', icon: 'shield-outline', url: 'https://cardglade.com/legal/privacy' },
  { id: 'terms', label: 'Terms of Service', icon: 'document-text-outline', url: 'https://cardglade.com/legal/terms' },
  { id: 'data', label: 'Data Collection Policy', icon: 'server-outline', url: 'https://cardglade.com/legal/data-collection' },
  { id: 'aml', label: 'AML & KYC Policy', icon: 'finger-print-outline', url: 'https://cardglade.com/legal/aml-kyc' },
  { id: 'risk', label: 'Risk Disclosure', icon: 'alert-circle-outline', url: 'https://cardglade.com/legal/risk-disclosure' },
  { id: 'cookies', label: 'Cookie Policy', icon: 'construct-outline', url: 'https://cardglade.com/legal/cookie' },
];

const SystemOverviewScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const [loading, setLoading] = useState(true);
  const [browserDetails, setBrowserDetails] = useState(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  const currentYear = new Date().getFullYear();

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Platform.select({
    ios: Constants.expoConfig?.ios?.buildNumber,
    android: Constants.expoConfig?.android?.versionCode,
  }) || '1';
  const osVersion = Platform.Version;

  const handleLink = (item) => {
    setBrowserDetails({ url: item.url, title: item.label });
  };

  const renderContent = () => (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}></Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 15 }}>
        <View style={styles.heroSection}>
          <Text style={styles.heroSubtitle}>Platform Overview</Text>
          <Text style={styles.heroTitle}>A New Standard for Digital Finance</Text>
          <Text style={styles.heroDesc}>
            Explore the tools designed to help you manage your digital assets and daily payments with institutional-grade security.
          </Text>
        </View>
      </View>

      <FlatList
        data={[{ id: 'system-content' }]}
        keyExtractor={(item) => item.id}
        renderItem={() => (
          <>
            <FeatureCardGrid
              items={servicesData}
              navigationEnabled={false}
              isLoading={loading}
              delayMs={350}
            />

            <View style={styles.infoSection}>
              <Text style={styles.sectionLabel}>Legal & Compliance</Text>
              {legalLinks.map((link, index) => (
                <TouchableOpacity
                  key={link.id}
                  style={[
                    styles.infoRow,
                    index === legalLinks.length - 1 && { borderBottomWidth: 0 }
                  ]}
                  onPress={() => handleLink(link)}
                >
                  <View style={styles.infoIconLabel}>
                    <Ionicons name={link.icon} size={15} color={colors.textSecondary} />
                    <Text style={styles.infoText}>{link.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.footerContainer}>
              <Text style={styles.footerCopy}>
                © {currentYear} {brandConfig.brandName}
              </Text>
              <Text style={styles.parentCompany}>
                Your gateway to global payments
              </Text>
            </View>
          </>
        )}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
        alwaysBounceVertical={false}
        overScrollMode="never"
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      {isDark ? (
        <View style={[styles.gradientBackground, { backgroundColor: colors.background }]}>
          {renderContent()}
        </View>
      ) : (
        <LinearGradient colors={[colors.accentSoft, colors.background]} style={styles.gradientBackground}>
          {renderContent()}
      </LinearGradient>
      )}
      {browserDetails && (
        <Browser
          visible
          url={browserDetails.url}
          title={browserDetails.title}
          onClose={() => setBrowserDetails(null)}
        />
      )}
    </View>
  );
};

export default SystemOverviewScreen;

const { width } = Dimensions.get('window');

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  gradientBackground: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 5 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 50,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 12, fontWeight: '700', color: colors.accent },
  scrollContent: { 
    paddingHorizontal: 16, 
    paddingBottom: 60 
  },
  heroSection: { 
    marginBottom: 20 
  },
  heroSubtitle: { fontSize: 10, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', marginBottom: 4 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, lineHeight: 24, marginBottom: 6 },
  heroDesc: { fontSize: 11, color: colors.textSecondary, lineHeight: 17 },
  infoSection: {
    marginTop: 15,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 15,
  },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: colors.textPrimary, marginBottom: 10, letterSpacing: 0.5 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  infoRowStatic: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoIconLabel: { flexDirection: 'row', alignItems: 'center' },
  infoText: { fontSize: 11, color: colors.textPrimary, marginLeft: 10 },
  infoTextStatic: { fontSize: 11, color: colors.textPrimary },
  versionValue: { fontSize: 11, color: colors.textSecondary },
  footerContainer: { marginTop: 40, alignItems: 'center' },
  footerCopy: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  parentCompany: { fontSize: 9, color: colors.textSecondary, marginTop: 2.5 },
});