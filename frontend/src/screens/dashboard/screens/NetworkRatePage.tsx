import React from 'react';
import {
  View, Text, TouchableOpacity, Platform, StatusBar, ScrollView, StyleSheet, 
  Linking, Alert, Image, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import AdvertSlider from '@components/ads/AdvertSlider';

const { width } = Dimensions.get('window');
const BRAND_DARK = '#0E3C2E';
const BORDER_COLOR = '#E2E8F0';
const TEXT_MUTED = '#64748B';

// Mock data (replace with real backend later)
const RATE_DATA = [
  {
    network: 'Airtime',
    color: '#FFCC00',
    logo: 'https://paysmart.com.ng/assets/images/mtn-logo.png',
    codes: [
      { title: 'MTN Airtime', code: '99.8%', icon: 'https://paysmart.com.ng/assets/images/mtn-logo.png', rate: 99.8 },
      { title: 'Airtel Airtime', code: '98.5%', icon: 'https://paysmart.com.ng/assets/images/airtel-logo.png', rate: 98.5 },
      { title: 'Glo Airtime', code: '100%', icon: 'https://paysmart.com.ng/assets/images/glo-logo.png', rate: 97.2 },
      { title: '9mobile Airtime', code: '96.1%', icon: 'https://paysmart.com.ng/assets/images/9mobile-logo.png', rate: 96.1 },
    ]
  },
  {
    network: 'Electricity',
    color: '#0067A5',
    logo: 'https://paysmart.com.ng/assets/images/electricity-icon.png',
    codes: [
      { title: 'IKEDC', code: '99.4%', icon: 'https://paysmart.com.ng/assets/images/ikedc-logo.png', rate: 99.4 },
      { title: 'EKEDC', code: '98.9%', icon: 'https://paysmart.com.ng/assets/images/ekedc-logo.png', rate: 98.9 },
      { title: 'KAEDCO', code: '95.3%', icon: 'https://paysmart.com.ng/assets/images/kaedco-logo.png', rate: 95.3 },
      { title: 'AEDC', code: '94.7%', icon: 'https://paysmart.com.ng/assets/images/aedc-logo.png', rate: 94.7 },
    ]
  },
  {
    network: 'Cable TV',
    color: '#0067A5',
    logo: 'https://paysmart.com.ng/assets/images/dstv-logo.png',
    codes: [
      { title: 'DStv', code: '98.7%', icon: 'https://paysmart.com.ng/assets/images/dstv-logo.png', rate: 98.7 },
      { title: 'GOtv', code: '97.9%', icon: 'https://paysmart.com.ng/assets/images/gotv-logo.png', rate: 97.9 },
      { title: 'Startimes', code: '96.5%', icon: 'https://paysmart.com.ng/assets/images/startimes-logo.png', rate: 96.5 },
      { title: 'Showmax', code: '95.8%', icon: 'https://paysmart.com.ng/assets/images/showmax-logo.png', rate: 95.8 },
    ]
  },
  {
    network: 'Betting',
    color: '#ED1C24',
    logo: 'https://paysmart.com.ng/assets/images/betting-icon.png',
    codes: [
      { title: 'Bet9ja', code: '99.2%', icon: 'https://paysmart.com.ng/assets/images/bet9ja-logo.png', rate: 99.2 },
      { title: 'SportyBet', code: '98.6%', icon: 'https://paysmart.com.ng/assets/images/sportybet-logo.png', rate: 98.6 },
      { title: '1xBet', code: '0%', icon: 'https://paysmart.com.ng/assets/images/1xbet-logo.png', rate: 0 },
      { title: 'BetKing', code: '80%', icon: 'https://paysmart.com.ng/assets/images/betking-logo.png', rate: 80 },
    ]
  },
];

export default function NetworkRatePage() {

const getRateStyle = (rate) => {
  if (rate >= 81) return { backgroundColor: 'rgba(47, 184, 109, 0.8)', color: '#2FB86D' }; // 100% to 81% (Soft Green)
  if (rate >= 51) return { backgroundColor: 'rgba(240, 173, 78, 0.8)', color: '#F0AD4E' }; // 80% to 51% (Soft Yellow)
  return { backgroundColor: 'rgba(217, 83, 79, 0.8)', color: '#D9534F' }; // 50% to 0% (Soft Red)
};

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader 
        title="Network Success Rates" 
        backgroundColor="#eff7f4" 
        textColor="#000"
        iconColor="#000" 
      />

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <AdvertSlider />
        {RATE_DATA.map((section, sIndex) => (
          <View key={sIndex} style={styles.networkSection}>
            <View style={styles.headingRow}>
              <Text style={styles.networkTitle}>{section.network}</Text>
            </View>

            <View style={styles.grid}>
              {section.codes.map((item, cIndex) => (
                <TouchableOpacity 
                  key={cIndex} 
                  style={styles.card} 
                  activeOpacity={0.7}
                >
                  <View style={styles.iconBox}>
                    <Image source={{ uri: item.icon }} style={styles.productIcon} resizeMode="contain" />
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.rateBadge, getRateStyle(item.rate)]}>
                    <Text style={styles.rateText}>{item.code}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.notice}>
          <Text style={styles.noticeText}>Success rates updated in real-time</Text>
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
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 60 : 110 
  },
  networkSection: { marginTop: 20 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  networkTitle: { fontSize: 13, fontWeight: '800', color: '#333', letterSpacing: 0.1, marginLeft: 4 },
  
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
  productIcon: {
    width: 24,
    height: 24,
    borderRadius: 8, 
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: BRAND_DARK, marginBottom: 2 },
  rateBadge: {
    width: 50,
    alignContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  rateText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  notice: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    opacity: 0.5,
    marginTop: 20
  },
  noticeText: { fontSize: 11, color: '#666' }
});