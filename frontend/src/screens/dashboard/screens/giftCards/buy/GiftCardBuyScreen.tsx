import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity,
  Image, Platform, Dimensions,
  ActivityIndicator, Animated, FlatList, ScrollView
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import SearchBar from '@components/common/SearchBar';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';
import GiftCardBrandList from '../utilities/GiftCardBrandList';
import ScreenHeader from '@components/headers/ScreenHeader';
import GiftCardBuyDetails from './utilities/GiftCardBuyDetails';
import { CUSTOM_FLAGS, PRIORITY_COUNTRIES } from './utilities/giftCardConfig';
import DebitTransactionReviewScreen from '../../transactions/review/DebitTransactionReviewScreen';
import { useVisualDelay } from '@hooks/useVisualDelay';
import CountryOptionCard, { CountryOptionCardSkeleton } from '../utilities/CountryOptionCard';

const api = apiConfig.baseUrl;
const { width } = Dimensions.get('window');
const BRAND_DARK = "#0E3C2E"; 
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";

const numColumns = 2;
const gap = 12;
const totalPadding = 32;
const availableWidth = width - totalPadding - (gap * (numColumns - 1));
const cardWidth = availableWidth / numColumns;

const BUY_GIFT_CARDS_ENDPOINT = `${apiConfig.baseUrl}/v1/banking/giftCards/buy/fetching/`;

const buildBuyEndpoint = (action, sessionToken, params = {}) => {
  const query = new URLSearchParams({
    action,
    [config.sessionToken]: sessionToken,
    ...params,
  });
  return `${BUY_GIFT_CARDS_ENDPOINT}?${query.toString()}`;
};

// --- Skeleton Components ---
const CountryListSkeleton = () => {
  const shimmerValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(shimmerValue, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  return (
    <View style={styles.skeletonSection}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Animated.View key={`country-skeleton-${index}`} style={{ opacity: shimmerValue }}>
          <CountryOptionCardSkeleton />
        </Animated.View>
      ))}
    </View>
  );
};

const getFlagCdnUrl = (isoCode) => {
  if (!isoCode || typeof isoCode !== 'string') return null;
  return `https://flagcdn.com/w80/${isoCode.toLowerCase()}.png`;
};

// --- Screen Components ---

const CountrySelection = memo(({ onCountrySelect, isVisible }) => {
  const [countries, setCountries] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(null); // For radio button state

  // Add a visual delay to ensure the skeleton is visible for at least a moment
  const showSkeleton = useVisualDelay(!fetching, 350);

  // Fetch countries only once when the component mounts
  const fetchCountries = async () => {
    try {
      setFetching(true);
      const sessionToken = await getSessionToken();
      const res = await fetch(buildBuyEndpoint('countries', sessionToken));
      const data = await res.json();
      console.log("Debug - Countries API Response:", data);
      if (data.status === 'success') {
        const rawCountries = Array.isArray(data.data) ? data.data : [];
        const validCountries = rawCountries.filter(c => c && c.isoName);
        const uniqueCountries = Array.from(new Map(validCountries.map(item => [item.isoName, item])).values());
       
        const countriesWithCustomFlags = uniqueCountries.map(item => ({
          ...item,
          flagUrl: CUSTOM_FLAGS[item.isoName] || getFlagCdnUrl(item.isoName) || item.flagUrl
        }));

        const sortedCountries = countriesWithCustomFlags.sort((a, b) => {
          const indexA = PRIORITY_COUNTRIES.indexOf(a.isoName);
          const indexB = PRIORITY_COUNTRIES.indexOf(b.isoName);
          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
          }
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
       
        setCountries(sortedCountries);
      } else {
        Alert.sheet("Error", data.message || "Failed to load countries", [
          { text: "Dismiss", style: "cancel" },
          { text: "Try Again", onPress: () => fetchCountries() }
        ]);
      }
    } catch (err) {
      console.log("Country Fetch Error:", err);
      Alert.sheet("Error", "Network error while fetching countries", [
        { text: "Dismiss", style: "cancel" },
        { text: "Try Again", onPress: () => fetchCountries() }
      ]);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  const filteredCountries = useMemo(() => {
    return countries.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.isoName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [countries, searchQuery]);

  const handleSelect = (country) => {
    setSelectedCountry(country);
    onCountrySelect(country);
  };

  // The component is now always rendered, visibility is controlled by parent.

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.searchContainer}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Search for a country"
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showSkeleton || (fetching && countries.length === 0) ? (
          <CountryListSkeleton />
        ) : (
          <>
            {filteredCountries.map((item) => (
              <CountryOptionCard
                key={`country-${item.isoName}`}
                item={{
                  ...item,
                  name: item.name,
                  currencyName: item.currencyName,
                  flagUrl: item.flagUrl,
                }}
                onPress={() => handleSelect(item)}
                selected={selectedCountry?.isoName === item.isoName}
                titleKey="name"
                subtitleKey="currencyName"
                imageKey="flagUrl"
                disabled={fetching}
              />
            ))}

            {filteredCountries.length === 0 && searchQuery.length > 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No results found for "{searchQuery}"</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
});

const GiftCardSelection = memo(({ country, onCardSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGiftCards = useCallback(async () => {
    if (!country?.isoName) {
      return [];
    }

    try {
      const sessionToken = await getSessionToken();
      const res = await fetch(buildBuyEndpoint('products', sessionToken, { countryCode: country.isoName }));
      const data = await res.json();
      console.log('[GiftCardBuyScreen] buy endpoint response', JSON.stringify(data, null, 2));

      if (data.status === 'success') {
        const cardList = Array.isArray(data.data?.content)
          ? data.data.content
          : Array.isArray(data.data)
            ? data.data
            : [];
        const validCards = cardList.filter((card) => card && card.productId);
        const uniqueCards = Array.from(new Map(validCards.map((item) => [item.productId, item])).values());

        return uniqueCards.sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));
      }

      Alert.sheet("Notice", data.message || "No gift cards available for this country", [
        { text: "Dismiss", style: "cancel" }
      ]);
      return [];
    } catch (err) {
      console.log("GiftCard Fetch Error:", err);
      Alert.sheet("Error", "Network error while fetching gift cards", [
        { text: "Dismiss", style: "cancel" },
        { text: "Try Again", onPress: () => fetchGiftCards() }
      ]);
      return [];
    }
  }, [country?.isoName]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.searchContainer}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Search for a gift card"
        />
      </View>

      <GiftCardBrandList
        searchQuery={searchQuery}
        selectedType="eCode"
        onBrandPress={(item) => onCardSelect(item)}
        mode="buy"
        fetchBrands={fetchGiftCards}
        emptyMessage={`No gift cards found for ${country?.name || 'this country'}`}
      />
    </View>
  );
});

const GiftCardBuyScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1: Country, 2: Cards, 3: Details
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  
  // State for the confirmation modal, lifted from GiftCardBuyDetails
  const [confirmData, setConfirmData] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmReviewData, setConfirmReviewData] = useState(null);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={["#e8f0ec", "#f5faf8"]} style={styles.gradientBackground} pointerEvents="box-none">
        <View style={styles.container}>
          <ScreenHeader
            title={
              step === 3 ? "Gift Card Purchase" : 
              step === 2 ? `Choose ${selectedCountry?.name} Card` : 
              "Select Country"
            }
            onBack={() => {
              if (step > 1) {
                if (step === 3) { // When on the details page
                  Alert.sheet('Discard changes?', 'Your progress will be lost.', [
                    { text: 'Keep Editing', style: 'cancel' },
                    { text: 'Discard', onPress: () => setStep(2) } // Go back to card selection
                  ]);
                } else {
                  setStep(step - 1);
                }
              } else {
                navigation.goBack();
              }
            }}
            backgroundColor="#e8f0ec"
            textColor={BRAND_DARK}
            iconColor={BRAND_DARK}
          />

          <View style={{ flex: 1 }}>
            <View style={[StyleSheet.absoluteFill, { opacity: step === 1 ? 1 : 0, zIndex: step === 1 ? 1 : 0 }]} pointerEvents={step === 1 ? 'auto' : 'none'}>
              <CountrySelection isVisible={step === 1} onCountrySelect={(country) => {
                setSelectedCountry(country);
                setStep(2);
              }} />
            </View>

            <View style={[StyleSheet.absoluteFill, { opacity: step === 2 ? 1 : 0, zIndex: step === 2 ? 1 : 0 }]} pointerEvents={step === 2 ? 'auto' : 'none'}>
              <GiftCardSelection isVisible={step === 2} country={selectedCountry} onCardSelect={(card) => {
                setSelectedCard(card);
                setStep(3);
              }} />
            </View>

            {step === 3 && (
              <GiftCardBuyDetails
                card={selectedCard}
                country={selectedCountry}
                navigation={navigation}
                showHeader={false}
                onBack={() => setStep(2)} // Go back to card selection
                onConfirm={(data) => {
                  setConfirmData(data);
                  setConfirmReviewData([
                    { label: 'Brand', value: data.brand || 'Gift Card', icon: data.logo || undefined },
                    { label: 'Country', value: data.countryName || data.countryCode || 'Unknown' },
                    { label: 'Card Type', value: data.denominationType === 'RANGE' ? 'Range' : 'Fixed' },
                    { label: 'Amount', value: `₦${Number(data.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                    { label: 'Recipient Currency', value: data.recipientCurrencyCode || '' },
                  ]);
                  setConfirmVisible(true);
                }}
              />
            )}
          </View>
        </View>
        
        {confirmData && (
          <DebitTransactionReviewScreen 
            visible={confirmVisible} 
            data={confirmData} 
            reviewData={confirmReviewData}
            onClose={() => setConfirmVisible(false)} 
          />
        )}
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 4,
  },
  skeletonSection: {
    width: '100%',
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flagIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
  gridContainer: {
    justifyContent: 'space-between',
    gap: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
  }
});

export default GiftCardBuyScreen;
