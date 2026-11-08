import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Modal,
  Dimensions,
  Image,
  FlatList,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from '@react-navigation/native';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { useTheme } from '@providers/ThemeProvider';

import ScreenHeader from '@components/headers/ScreenHeader';
import SearchBar from '@components/common/SearchBar'; // Your newly extracted component
import Tabs from '@components/extra/Tabs';

// Import your list and details components
import GiftCardBrandList, { fetchGiftCardBrands } from '../utilities/GiftCardBrandList';
import SellGiftCardDetails from './utilities/SellGiftCardDetails';
import { useVisualDelay } from '@hooks/useVisualDelay';
import CountryOptionCard, { CountryOptionCardSkeleton } from '../utilities/CountryOptionCard';
import { getSessionToken } from '@hooks/useAuth';

const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;
const BRAND_DARK = "#0E3C2E";
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";
const submissionsEndpoint = `${apiConfig.baseUrl}/v1/banking/giftCards/sell/fetching/`;
const submissionSyncInterval = 15000;

const getCurrencySymbol = (currencyCode, locale = 'en-US') => {
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    });
    const symbolPart = formatter
      .formatToParts(0)
      .find((part) => part.type === 'currency');

    return symbolPart ? symbolPart.value : currencyCode;
  } catch (error) {
    return currencyCode;
  }
};

export const InProgressGiftCardSubmissions = () => {
  const isFocused = useIsFocused();
  const { colors, isDark } = useTheme();
  const [submissions, setSubmissions] = useState([]);
  const syncInFlight = useRef(false);

  const loadSubmissions = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;

    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        setSubmissions([]);
        return;
      }

      const query = new URLSearchParams({
        action: 'submissions',
        [config.sessionToken]: sessionToken,
      });
      const response = await fetch(`${submissionsEndpoint}?${query.toString()}`);
      const result = await response.json();
      if (!response.ok || result?.status !== 'success') {
        throw new Error(result?.message || `Submission sync failed with HTTP ${response.status}`);
      }

      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recentPending = Array.isArray(result?.data)
        ? result.data.filter((submission) => {
            const createdAt = new Date(String(submission.createdAt || '').replace(' ', 'T')).getTime();
            return String(submission.status || '').toLowerCase() === 'pending'
              && Number.isFinite(createdAt)
              && createdAt >= cutoff;
          })
        : [];

      setSubmissions(recentPending);
    } catch (error) {
      console.error('[InProgressGiftCardSubmissions] load failed:', error);
    } finally {
      syncInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return undefined;

    loadSubmissions();
    const syncTimer = setInterval(loadSubmissions, submissionSyncInterval);

    return () => clearInterval(syncTimer);
  }, [isFocused, loadSubmissions]);

  if (!submissions.length) return null;

  return (
    <View style={inProgressStyles.wrapper}>
      <Text style={[inProgressStyles.title, { color: colors.textSecondary }]}>In Progress</Text>
      {submissions.map((submission) => (
        <View
          key={submission.id || submission.transactionId}
          style={[inProgressStyles.item, { backgroundColor: isDark ? colors.surface : colors.card }]}
        >
          <View style={[inProgressStyles.iconWrapper, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="time-outline" size={20} color={colors.accent} />
          </View>
          <View style={inProgressStyles.copy}>
            <Text style={[inProgressStyles.itemTitle, { color: colors.textPrimary }]}>
              {submission.brandName || 'Gift Card'}
            </Text>
            <Text style={[inProgressStyles.itemDescription, { color: colors.textSecondary }]}>
              Submission is pending review
            </Text>
          </View>
          <TouchableOpacity
            style={[inProgressStyles.actionButton, { backgroundColor: colors.accent }]}
            activeOpacity={0.8}
            onPress={() => console.log('View submission', submission.id || submission.transactionId)}
          >
            <Text style={inProgressStyles.actionButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const getFlagCdnUrl = (isoCode) => {
  if (!isoCode || typeof isoCode !== 'string') return null;
  return `https://flagcdn.com/w80/${isoCode.toLowerCase()}.png`;
};

const getCardTypeLabel = (type) => {
  if (!type) {
    return 'Card';
  }

  const normalized = String(type).toLowerCase();
  if (normalized === 'ecode') return 'E-Code';
  if (normalized === 'physical') return 'Physical';
  return normalized.replace(/_/g, ' ');
};

const SellGiftCard = ({ route, navigation }) => {
  const pageTitle = "Sell Gift Card";
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState(null); 
  const [brandsData, setBrandsData] = useState([]);
  const [step, setStep] = useState(0); // 0: List, 1: Details
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);

  // Add a visual delay to ensure the skeleton is visible for at least a moment
  const showSkeleton = useVisualDelay(!loading, 350);
 
  // Bottom Sheet States
  const [isCountrySheetVisible, setIsCountrySheetVisible] = useState(false);
  const [selectedBrandForSheet, setSelectedBrandForSheet] = useState(null);
  const sheetAnim = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          pan.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          closeCountrySheet();
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const loadBrands = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchGiftCardBrands('sell');
      if (response.status === 'success') {
        setBrandsData(response.data);
  
        const types = new Set();
        response.data.forEach(brand => {
          brand.countries?.forEach(c => {
            if (c.cardType) types.add(String(c.cardType).toLowerCase());
          });
        });
        const typeArray = Array.from(types);
        if (typeArray.includes('physical')) {
          setSelectedType('physical');
        } else if (typeArray.length > 0) {
          setSelectedType(typeArray.sort()[0]);
        }
      } else {
        Alert.sheet("Error", response.message || "Failed to load brands.", [
          { text: "Dismiss", style: "cancel" },
          { text: "Try Again", onPress: loadBrands }
        ]);
      }
    } catch (error) {
      console.log("Failed to load cards", error);
      Alert.sheet("Error", "A network error occurred. Please check your connection.", [
        { text: "Dismiss", style: "cancel" },
        { text: "Try Again", onPress: loadBrands }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, []);

  const availableTypes = useMemo(() => {
    const types = new Set();
    brandsData.forEach(brand => {
      brand.countries?.forEach(c => {
        if (c.cardType) types.add(String(c.cardType).toLowerCase());
      });
    });

    const sorted = Array.from(types).sort((a, b) => (
      a === 'physical' ? -1 : b === 'physical' ? 1 : a.localeCompare(b)
    ));

    return sorted.map(type => ({
      label: getCardTypeLabel(type),
      value: type,
    }));
  }, [brandsData]);

  const emptyMessage = useMemo(() => {
    if (searchQuery.length > 0) {
      return `No brands found for "${searchQuery}"`;
    }
    return "No gift card brands available.";
  }, [searchQuery]);

  const openCountrySheet = (brand) => {
    setSelectedBrandForSheet(brand);
    setIsCountrySheetVisible(true);
    pan.setValue(0);
    Animated.parallel([
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeCountrySheet = () => {
    Animated.parallel([
      Animated.timing(sheetAnim, {
        toValue: screenHeight,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pan, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsCountrySheetVisible(false);
      setSelectedBrandForSheet(null);
    });
  };

  const handleBack = () => {
    if (step === 1) {
      Alert.sheet('Discard changes?', 'Your progress will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', onPress: () => setStep(0) }
      ]);
    } else {
      navigation.goBack();
    }
  };

  const handleBrandSelection = (selectedBrand) => {
    openCountrySheet(selectedBrand);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      <ScreenHeader 
        title={step === 1 ? `Sell ${selectedBrand?.brand}` : pageTitle} 
        backgroundColor="#eff7f4" 
        textColor="#000" 
        iconColor="#000" 
        onBack={handleBack}
      />

      {step === 0 ? (
        <View style={styles.mainWrapper}>
          <View style={styles.listContainer}>
            <View style={styles.topSection}>
              <SearchBar 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                placeholder="Search for a brand"
                containerStyle={{ marginBottom: 15 }}
              />

              <Tabs 
                tabs={availableTypes} 
                activeTab={selectedType} 
                onTabChange={setSelectedType} 
                loading={loading || showSkeleton} 
              />
            </View>

            <GiftCardBrandList 
              data={brandsData}
              searchQuery={searchQuery} 
              selectedType={selectedType}
              loading={loading || showSkeleton}
              onBrandPress={handleBrandSelection}
              mode="sell"
              emptyMessage={emptyMessage}
            />
          </View>
        </View>
      ) : (
        <SellGiftCardDetails 
          brand={selectedBrand} 
          country={selectedCountry}
          getCurrencySymbol={getCurrencySymbol}
        />
      )}

      {/* Country Selection Sheet */}
      <Modal
        visible={isCountrySheetVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeCountrySheet}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeCountrySheet} />
          </Animated.View>

          <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.dragIndicator} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetMainTitle}>Select Country</Text>
              <Text style={styles.sheetSubTitle}>Available regions for {selectedBrandForSheet?.brand}</Text>
            </View>

            <FlatList
              data={selectedBrandForSheet?.countries?.filter(c => String(c.cardType).toLowerCase() === String(selectedType).toLowerCase() && c.isActive)}
              keyExtractor={(item) => item.countryId}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="never"
              decelerationRate="normal"
              contentContainerStyle={styles.sheetScrollContent}
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={10}
              scrollEventThrottle={16}
              renderItem={({ item: country }) => (
                <CountryOptionCard
                  item={{
                    ...country,
                    name: country.country,
                    currencyName: country.currencyName,
                    flagUrl: getFlagCdnUrl(country.isoName) || country.flagUrl,
                  }}
                  onPress={() => {
                    closeCountrySheet();
                    setSelectedBrand(selectedBrandForSheet);
                    setSelectedCountry(country);
                    setStep(1);
                  }}
                  titleKey="name"
                  subtitleKey="currencyName"
                  imageKey="flagUrl"
                  showRadio={true}
                />
              )}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

export default SellGiftCard;
 
const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  topSection: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  // Notice the old searchSection, searchContainer, searchIcon, and searchInput styles are completely gone from here
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    maxHeight: screenHeight * 0.7,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  dragIndicator: { 
    width: 40 * scale,   
    height: 5 * scale, 
    backgroundColor: '#E0E0E0', 
    borderRadius: 3, 
    alignSelf: 'center', 
    marginTop: 15 * scale 
  },
  sheetHeader: { paddingHorizontal: 24, paddingTop: 20, marginBottom: 15 },
  sheetMainTitle: { fontSize: 18 * scale, fontWeight: '800', color: BRAND_DARK },
  sheetSubTitle: { fontSize: 12 * scale, color: TEXT_MUTED, marginTop: 4 },
  sheetScrollContent: { 
    paddingHorizontal: 16, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 20 
  },
  permissionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  cardInternalWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  leftInfoSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  flagIcon: {
    width: '50%',
    height: '50%',
  },
  textMetadataContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_DARK,
    marginBottom: 2,
  },
  permissionDesc: {
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: BRAND_DARK,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND_DARK,
  },
});

const inProgressStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 5,
  },
  item: {
    minHeight: 64,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },
  actionButton: {
    minWidth: 68,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  itemTitle: {
    fontWeight: '700',
    fontSize: 12,
  },
  itemDescription: {
    fontSize: 10,
    marginTop: 3,
  },
});