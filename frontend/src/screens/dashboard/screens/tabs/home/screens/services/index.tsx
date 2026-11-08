import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  FlatList,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '@components/headers/ScreenHeader';
import SearchBar from '@components/common/SearchBar';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import AdvertSlider from '@components/ads/AdvertSlider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@providers/ThemeProvider';
import { openLoginSheet } from '@hooks/useAuth';
import { useAuthState } from '@hooks/useAuth';
const { width } = Dimensions.get('window');
const baseWidth = 410;
const scale = width / baseWidth;
const BRAND_COLOR = '#0c5b3f';
const INACTIVE_COLOR = '#D1E4DD';
const DEFAULT_GIF_PLACEHOLDER = { uri: 'https://paysmart.com.ng/assets/images/bitmap-trans2.png' };
const recentServicesKey = 'recentServices';

const saveRecentService = async (service) => {
  try {
    const stored = await AsyncStorage.getItem(recentServicesKey);
    let recent = stored ? JSON.parse(stored) : [];
    recent = recent.filter(item => item.id !== service.id);
    recent.unshift(service);
    await AsyncStorage.setItem(recentServicesKey, JSON.stringify(recent.slice(0, 5)));
  } catch (error) {
    console.log('Error saving recent service:', error);
  }
};
const serviceSections = [
  {
    category: 'Bill Payments',
    data: [
      {
        id: 'airtime',
        title: 'Buy Airtime',
        description: 'Instant airtime recharge now',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/17720/17720298.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'AirtimeScreen',
        isFeatured: true,
        badge: {
          status: true,
          text: 'Hot',
          color: 'red',
          textColor: '#fff',
        },
      },
      {
        id: 'data',
        title: 'Buy Data',
        description: 'Affordable data bundles here',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/17697/17697847.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'DataScreen',
        isFeatured: true,
      },
      {
        id: 'electricity',
        title: 'Electricity',
        description: 'Pay electricity bills easily',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/15355/15355024.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'ElectricityScreen',
        isFeatured: true,
        badge: {
          status: true,
          text: 'Hot',
          color: 'red',
          textColor: '#fff',
        },
      },
      {
        id: 'education',
        title: 'Education',
        description: 'Pay school fees and exams now',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/3914/3914110.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'EducationScreen',
        isFeatured: true,
      },
      {
        id: 'cabletv',
        title: 'Cable TV',
        description: 'Renew cable TV subscriptions',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/18997/18997814.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'CableTvScreen',
        isFeatured: true,
      },
      {
        id: 'betting',
        title: 'Betting',
        description: 'Fund betting wallets instantly',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/3914/3914184.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'BettingScreen',
        isFeatured: true,
      },
    ],
  },
  {
    category: 'Finance',
    data: [
      {
        id: 'smartwealth',
        title: 'SmartWealth',
        description: 'Save and grow wealth with ease',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/7653/7653246.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'SmartWealth',
      },
      {
        id: 'smartlock',
        title: 'SmartLock',
        description: 'Lock funds securely earn interest',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/14897/14897296.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'PayCable',
      },
      {
        id: 'spendsave',
        title: 'Spend & Save',
        description: 'Spend and save toward your goals',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/18855/18855297.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'PayCable',
        badge: {
          status: true,
          text: 'Hot',
          color: 'red',
          textColor: '#fff',
        },
      },
      {
        id: 'insurance',
        title: 'Insurance',
        description: 'Protect life assets with coverage',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/16448/16448701.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'ProfilePhotoUploa',
        badge: {
          status: true,
          text: 'New',
          color: '#C2E887',
          textColor: '#0e3c2e',
        },
      },
      {
        id: 'Targets',
        title: 'Targets',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/18675/18675145.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        description: 'Set savings targets and grow ',
        page: 'FacialVerification',
      },
      {
        id: 'smartloan',
        title: 'Loans',
        description: 'Access quick flexible loan offers',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/19020/19020855.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'FacialVerification',
      },
    ],
  },
  {
    category: 'Transfer',
    data: [
      {
        id: 'qrcode',
        title: 'QR Code',
        description: 'Scan QR code to pay instantly',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/8778/8778048.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'Scanner',
      },
      {
        id: 'merchant',
        title: 'Merchant',
        description: 'Pay only Tediwave merchants',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/3916/3916657.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'PayAMerchan',
      },
      {
        id: 'network',
        title: 'Network',
        description: 'Check network success rates',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/15865/15865136.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'NetworkRatePage',
      },
    ],
  },
  {
    category: 'Account & Settings',
    data: [
      {
        id: 'statement',
        title: 'Statement',
        description: 'Download your account statement',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/3914/3914193.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'AccountStatementScreen',
      },
      {
        id: 'limits',
        title: 'Limits',
        description: 'Manage your daily spending limits',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/6955/6955886.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'AccountLimitsScreen',
      },
      {
        id: 'settings',
        title: 'Settings',
        description: 'Customize app and account settings',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/16327/16327901.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'Settings',
      },
    ],
  },
  {
    category: 'Others',
    data: [
      {
        id: 'giftcards',
        title: 'Gift Cards',
        description: 'Buy and sell gift cards instantly',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/3916/3916663.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'GiftCardBuyScreen',
        badge: {
          status: true,
          text: 'Hot',
          color: 'red',
          textColor: '#fff',
        },
      },
      {
        id: 'physicalcard',
        title: 'ATM Card',
        description: 'Request physical ATM cards easily',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/3916/3916663.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'BettingScree',
      },
      {
        id: 'virtualcard',
        title: 'Virtual Card',
        description: 'Create virtual cards instantly now',
        image: { uri: 'https://cdn-icons-png.flaticon.com/128/3916/3916663.png' },
        iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
        type: 'navigate',
        page: 'Dashboard',
        params: { tab: 'Cards' },
        badge: {
          status: true,
          text: 'New',
          color: '#C2E887',
          textColor: '#0e3c2e',
        },
      },
    ],
  },
];
const AllService = () => {
  const navigation = useNavigation();
  const [gifLoaded, setGifLoaded] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const allServices = serviceSections.flatMap(section => section.data);
  const filteredServices = searchQuery.trim() === ''
    ? []
    : allServices.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
  const handleAction = (item) => {
    const navParams = item.params || {};
    if (item.page === 'Dashboard') {
      navigation.replace(item.page, navParams);
      return;
    }

    navigation.navigate(item.page, navParams);
  };
  const renderService = ({ item }) => {
    const isGif = item.isGif || false;
    const shouldTint = item.useTint !== false;
    return (
      <TouchableOpacity style={styles.serviceBox} onPress={() => handleAction(item)}>
        <View style={styles.iconBox}>
          <Image source={item.iconBottom} style={styles.iconBottom} />
          <Image
            source={isGif && !gifLoaded[item.id] ? DEFAULT_GIF_PLACEHOLDER : item.image}
            style={[styles.iconTop, shouldTint && { tintColor: BRAND_COLOR }]}
            onLoadEnd={() => isGif && setGifLoaded(prev => ({ ...prev, [item.id]: true }))}
          />
          {item.badge?.status && (
            <View style={[styles.badge, { backgroundColor: item.badge.color || 'red' }]}>
              <Text style={[styles.badgeText, { color: item.badge.textColor || '#fff' }]}>
                {item.badge.text}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.label}>{item.title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      </TouchableOpacity>
    );
  };
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={styles.gradientBackground}>
        <View style={styles.wrapper}>
          <ScreenHeader title="All Services" backgroundColor="#eff7f4" textColor="#000" iconColor="#000" />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <AdvertSlider /> 
            
            <SearchBar 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery} 
              placeholder="Search services..."
              containerStyle={{ marginBottom: 10 }}
            />
            
            {/* During search: all services together in one flat grid (no section headers) */}
            {searchQuery.trim() !== '' ? (
              <FlatList
                style={{ paddingHorizontal: 16 * scale }}
                data={filteredServices}
                renderItem={renderService}
                keyExtractor={item => item.id}
                numColumns={3}
                columnWrapperStyle={styles.row}
                scrollEnabled={false}
              />
            ) : (
              /* Normal grouped view when search is empty */
              serviceSections.map((section, idx) => (
                <View key={idx} style={[styles.sectionContainer, { paddingHorizontal: 16 * scale }]}>
                  <Text style={styles.sectionHeader}>{section.category}</Text>
                  <FlatList
                    data={section.data}
                    renderItem={renderService}
                    keyExtractor={item => item.id}
                    numColumns={3}
                    columnWrapperStyle={styles.row}
                    scrollEnabled={false}
                  />
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </LinearGradient>
    </>
  );
};
const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  gradientBackground: { flex: 1 },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 16 * scale,
    paddingBottom: 50,
  },
  sectionContainer: { marginTop: 10 },
  sectionHeader: {
    fontSize: 12 * scale,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 10 * scale,
    paddingHorizontal: 5,
  },
  row: {
    justifyContent: 'space-between',
  },
  recentList: {
    paddingBottom: 5 * scale
  },
  serviceBox: {
    width: (width - 50) / 3,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
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
  iconBottom: {
    width: 30,
    height: 30,
    tintColor: INACTIVE_COLOR,
  },
  iconTop: {
    width: 16,
    height: 16,
    position: 'absolute',
    resizeMode: 'contain',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E3C2E',
    marginBottom: 2,
    textAlign: 'left',
  },
  description: {
    fontSize: 9,
    color: '#64748B',
    lineHeight: 14,
    textAlign: 'left',
  },
  recentBox: {
    width: (width - 50) / 3,
    height: 45 * scale,
    backgroundColor: '#fff',
    marginBottom: 7 * scale,
    marginRight: 10 * scale,
    borderRadius: 10 * scale,
    borderWidth: 1,
    borderColor: '#f2f2f2',
    justifyContent: 'center',
    paddingLeft: 10 * scale,
  },
  recentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4 * scale,
  },
  iconWrapper: {
    width: 26 * scale,
    height: 26 * scale,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBottomQA: {
    width: 26 * scale,
    height: 26 * scale,
    tintColor: INACTIVE_COLOR,
  },
  mainIconQA: {
    width: 16 * scale,
    height: 16 * scale,
    position: 'absolute',
    resizeMode: 'contain',
  },
  recentLabel: {
    color: '#111',
    fontWeight: '500',
    fontSize: 10 * scale,
    marginLeft: 2 * scale,
  },
  badge: {
    position: 'absolute',
    top: -5.5 * scale,
    right: -5 * scale,
    borderRadius: 8 * scale,
    paddingHorizontal: 4,
    paddingVertical: 1 * scale,
    minWidth: 16 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 6,
  },
  // Search styles added exactly from the provided BuyAirtimeScreen code (no other styles touched)
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: BRAND_COLOR,
    height: "100%",
  }
});

const QuickAccess = ({ renderTab, isAuthResolved = true }) => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuthState();

  const filteredServices = serviceSections
    .flatMap(section => section.data)
    .filter(service => service.isFeatured);

  const handleAction = (item) => {
    // DO NOT REMOVE: quick-access actions on the first dashboard screen must require auth.
    if (!isAuthenticated) {
      openLoginSheet();
      return;
    }

    if (item.type === 'navigate') {
      saveRecentService(item);
      navigation.navigate(item.page);
    } else if (item.type === 'render') {
      renderTab(item.page);
    }
  };

  const renderService = ({ item }) => {
    const isGif = item.isGif || false;
    const shouldTint = item.useTint !== false;

    return (
      <TouchableOpacity
      style={[quickAccessStyles.serviceBox, { backgroundColor: isDark ? colors.surface : colors.card }]}
        onPress={() => handleAction(item)}
      >
        <View style={quickAccessStyles.serviceContent}>
          <View style={quickAccessStyles.iconWrapper}>
            <Image
              source={item.iconBottom}
              style={[quickAccessStyles.iconBottom, { tintColor: colors.accentSoft }]}
            />
            <Image
              source={item.image}
              style={[quickAccessStyles.mainIcon, shouldTint && { tintColor: colors.accent }]}
            />
            {item.badge?.status && (
              <View style={[quickAccessStyles.badge, { backgroundColor: item.badge.color }]}>
                <Text style={[quickAccessStyles.badgeText, { color: item.badge.textColor }]}>
                  {item.badge.text}
                </Text>
              </View>
            )}
          </View>
          <Text style={[quickAccessStyles.label, { color: colors.textPrimary }]}>{item.title}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!isAuthResolved) {
    return (
      <View style={quickAccessStyles.placeholderWrapper}>
        <View style={quickAccessStyles.placeholderHeader} />
        <View style={quickAccessStyles.placeholderGrid}>
          {[1,2,3,4,5,6].map((item) => (
            <View key={`quick_access_placeholder_${item}`} style={quickAccessStyles.placeholderBox} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={quickAccessStyles.wrapper}>
      <View style={quickAccessStyles.topRow}>
        <Text style={[quickAccessStyles.title, { color: colors.textSecondary }]}>Services</Text>
        <TouchableOpacity
          style={quickAccessStyles.seeAllContainer}
          onPress={() => navigation.navigate('AllServic')}
        >
          <Text style={[quickAccessStyles.seeAll, { color: colors.accent }]}>More</Text>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/128/271/271228.png' }}
            style={[quickAccessStyles.seeAllIcon, { tintColor: colors.accent }]}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredServices}
        renderItem={renderService}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={quickAccessStyles.row}
        contentContainerStyle={quickAccessStyles.servicesGrid}
        scrollEnabled={false}
      />
    </View>
  );
};


const quickAccessStyles = StyleSheet.create({
  placeholderWrapper: {
    paddingHorizontal: 20 * scale,
    marginBottom: 3 * scale,
  },
  placeholderHeader: {
    height: 14 * scale,
    width: '40%',
    backgroundColor: '#EAF2ED',
    borderRadius: 6 * scale,
    marginBottom: 10 * scale,
  },
  placeholderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  placeholderBox: {
    width: (width - 50) / 3,
    height: 47 * scale,
    marginBottom: 7 * scale,
    borderRadius: 10 * scale,
    backgroundColor: '#F2F7F4',
  },
  wrapper: {
    paddingHorizontal: 20 * scale,
    marginBottom: 3 * scale,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8 * scale,
    marginBottom: 8 * scale,
    paddingHorizontal: 5 * scale,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  seeAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAll: {
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    lineHeight: 11,
  },
  seeAllIcon: {
    width: 8,
    height: 8,
    marginLeft: 3,
  },
  servicesGrid: {},
  row: {
    justifyContent: 'space-between',
  },
  serviceBox: {
    width: (width - 50) / 3,
    height: 47 * scale,
    marginBottom: 7 * scale,
    borderRadius: 10 * scale,
    justifyContent: 'center',
    paddingLeft: 10 * scale,
  },
  serviceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7 * scale,
  },
  iconWrapper: {
    width: 28 * scale,
    height: 28 * scale,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBottom: {
    width: 28 * scale,
    height: 28 * scale,
  },
  mainIcon: {
    width: 16 * scale,
    height: 16 * scale,
    position: 'absolute',
    resizeMode: 'contain',
  },
  label: {
    fontWeight: '600',
    fontSize: 10 * scale,
    marginLeft: 2 * scale,
  },
  badge: {
    position: 'absolute',
    top: -5.5 * scale,
    right: -5 * scale,
    borderRadius: 8 * scale,
    paddingHorizontal: 4,
    paddingVertical: 1 * scale,
    minWidth: 16 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 6,
  },
});

export { AllService, QuickAccess };

