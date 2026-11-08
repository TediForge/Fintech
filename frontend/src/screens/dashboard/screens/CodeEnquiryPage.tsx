import { Alert } from '@components/common/Alert';
import React from 'react';
import {
  View, Text, TouchableOpacity, Platform, StatusBar, ScrollView, StyleSheet, 
  Linking, Image, Clipboard, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import config from '@config/app';
import { apiConfig } from '@config/api';
import ScreenHeader from '@components/headers/ScreenHeader';

const api = apiConfig.baseUrl;

const { width } = Dimensions.get('window');
const BRAND_DARK = '#0E3C2E';
const BORDER_COLOR = '#E2E8F0';
const TEXT_MUTED = '#64748B';

const FULL_CODES_DATA = [
  {
    network: 'MTN',
    color: '#FFCC00',
    logo: 'https://paysmart.com.ng/assets/images/mtn-logo.png',
    codes: [
      { title: 'Check Number', code: '*123*1*1#', icon: 'person-outline' },
      { title: 'Account Balance', code: '*310#', icon: 'wallet-outline' },
      { title: 'Data Balance', code: '*323#', icon: 'cellular-outline' },
      { title: 'Borrow Airtime', code: '*303#', icon: 'refresh-circle-outline' },
    ]
  },
  {
    network: 'Airtel',
    color: '#ED1C24',
    logo: 'https://paysmart.com.ng/assets/images/airtel-logo.png',
    codes: [
      { title: 'Check Number', code: '*121*3*4#', icon: 'person-outline' },
      { title: 'Account Balance', code: '*310#', icon: 'wallet-outline' },
      { title: 'Data Balance', code: '*323#', icon: 'cellular-outline' },
      { title: 'Borrow Airtime', code: '*303#', icon: 'refresh-circle-outline' },
    ]
  },
  {
    network: 'GLO',
    color: '#00833E',
    logo: 'https://paysmart.com.ng/assets/images/glo-logo.png',
    codes: [
      { title: 'Check Number', code: '*135*8#', icon: 'person-outline' },
      { title: 'Account Balance', code: '*310#', icon: 'wallet-outline' },
      { title: 'Data Balance', code: '*323#', icon: 'cellular-outline' },
      { title: 'Borrow Airtime', code: '*303#', icon: 'refresh-circle-outline' },
    ]
  },
  {
    network: '9mobile',
    color: '#006341',
    logo: 'https://paysmart.com.ng/assets/images/9mobile-logo.png',
    codes: [
      { title: 'Check Number', code: '*248#', icon: 'person-outline' },
      { title: 'Account Balance', code: '*310#', icon: 'wallet-outline' },
      { title: 'Data Balance', code: '*323#', icon: 'cellular-outline' },
      { title: 'Borrow Airtime', code: '*303#', icon: 'refresh-circle-outline' },
    ]
  },
  {
    network: 'DStv & GOtv',
    color: '#0067A5',
    logo: 'https://yt3.googleusercontent.com/t5tj2_aVphUlbgLG4VVxmTEmgF4x2wGhL3DuTvTpC4wTJlFu1zW714Z1ZFQ14OUYWAMh5UPd=s900-c-k-c0x00ffffff-no-rj',
    codes: [
      { title: 'Manage Account', code: '*288#', icon: 'tv-outline' },
      { title: 'Clear Errors', code: '*288*2#', icon: 'refresh-circle-outline' },
      { title: 'Check Balance', code: '*288*4#', icon: 'wallet-outline' },
      { title: 'Self Service', code: '*121#', icon: 'construct-outline' },
    ]
  },
  {
    network: 'StarTimes',
    color: '#E02020',
    logo: 'https://pbs.twimg.com/profile_images/3192794606/b40f3fd4fac95344aea9c047fa97a816_400x400.png',
    codes: [
      { title: 'Main Menu', code: '*858#', icon: 'menu-outline' },
      { title: 'Check Balance', code: '*858*1#', icon: 'wallet-outline' },
      { title: 'Recharge', code: '*858*2#', icon: 'card-outline' },
      { title: 'Change Bouquet', code: '*858*3#', icon: 'layers-outline' },
    ]
  }
];

export default function CodeEnquiryPage() {

  const handleAction = async (code) => {
    // 1. Copy to clipboard first
    Clipboard.setString(code);

    // 2. Prepare dial string
    const dialStr = `tel:${code.replace('#', '%23')}`;
    
    try {
      const supported = await Linking.canOpenURL(dialStr);
      if (supported) {
        await Linking.openURL(dialStr);
      } else {
        Alert.sheet("Copied", `${code} copied to clipboard (Dialer not available).`);
      }
    } catch (err) {
      console.error(err);
      Alert.sheet("Copied", `${code} copied to clipboard.`);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader 
        title="Network Shortcodes" 
        backgroundColor="#eff7f4" 
        textColor="#000"
        iconColor="#000" 
      />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {FULL_CODES_DATA.map((section, sIndex) => (
          <View key={sIndex} style={styles.networkSection}>
            <View style={styles.headingRow}>
              <Image source={{ uri: section.logo }} style={styles.networkLogo} />
              <Text style={styles.networkTitle}>{section.network}</Text>
            </View>

            <View style={styles.grid}>
              {section.codes.map((item, cIndex) => (
                <TouchableOpacity 
                  key={cIndex} 
                  style={styles.card} 
                  onPress={() => handleAction(item.code)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name={item.icon} size={16} color={BRAND_DARK} />
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDesc}>{item.code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.notice}>
          <Image 
            source={{ uri: 'https://cdn.brandfetch.io/idRXw3Bi0A/w/141/h/47/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1770092258107' }} 
            style={styles.nccLogo}
            resizeMode="contain"
          />
          <Text style={styles.noticeText}>Harmonized codes approved by NCC</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: 16, 
    paddingBottom: 140,
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 70 : 110 
  },
  networkSection: { marginBottom: 20 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  networkLogo: { width: 28, height: 28, borderRadius: 6, marginRight: 10,},
  networkTitle: { fontSize: 16, fontWeight: '800', color: '#333', letterSpacing: 0.5 },
  
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  card: {
    width: (width - 50) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f0f9f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: BRAND_DARK, marginBottom: 2 },
  cardDesc: { fontSize: 10, color: TEXT_MUTED, lineHeight: 14 },
  
  notice: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    opacity: 0.5,
  },
  nccLogo: {
    width: 36,
    height: 12,
    marginRight: 6,
  },
  noticeText: { fontSize: 11, color: '#666', marginBottom: 1.2, }
});