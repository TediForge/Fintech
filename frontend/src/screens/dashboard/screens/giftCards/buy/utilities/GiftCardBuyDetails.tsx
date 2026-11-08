import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import LoadingScreen from '@components/Loading/LoadingScreen';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';

const { width } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';
const FALLBACK_CARD_IMAGE = 'https://cdn-icons-png.flaticon.com/128/1170/1170678.png';

const BUY_GIFT_CARDS_ENDPOINT = `${apiConfig.baseUrl}/v1/banking/giftCards/buy/fetching/`;

const buildBuyEndpoint = (action, sessionToken, params = {}) => {
  const query = new URLSearchParams({
    action,
    [config.sessionToken]: sessionToken,
    ...params,
  });
  return `${BUY_GIFT_CARDS_ENDPOINT}?${query.toString()}`;
};

const GiftCardBuyDetails = ({ route, navigation, card: cardProp, country: countryProp, onBack, onConfirm }) => {
  const routeParams = route?.params || {};
  const card = cardProp || routeParams.card;
  const country = countryProp || routeParams.country;

  const [fullProduct, setFullProduct] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(true);
  const [nairaAmount, setNairaAmount] = useState(null);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Fetch full product details
  useEffect(() => {
    if (!card?.productId) {
      setFetchingDetails(false);
      return;
    }

    const fetchFullProduct = async () => {
      try {
        const sessionToken = await getSessionToken();
        const res = await fetch(buildBuyEndpoint('details', sessionToken, { productId: card.productId }));
        const data = await res.json();

        console.log("Debug - Full Product Response (raw):", JSON.stringify(data, null, 2));

        if (data.status === 'success' && data.data) {
          setFullProduct(data.data);
        } else {
          Alert.sheet("Error", "Could not load card details");
        }
      } catch (err) {
        console.log("Product Detail Fetch Error:", err);
        Alert.sheet("Error", "Network error while loading card details");
      } finally {
        setFetchingDetails(false);
      }
    };

    fetchFullProduct();
  }, [card?.productId]);

  const recipientDenominations = fullProduct?.fixedRecipientDenominations?.length > 0 
    ? fullProduct.fixedRecipientDenominations 
    : [];

  const isFixedType = recipientDenominations.length > 0;
  const isRangeType = fullProduct?.denominationType === "RANGE" && 
                      fullProduct?.minRecipientDenomination && 
                      fullProduct?.maxRecipientDenomination;

  const recipientCurrency = fullProduct?.recipientCurrencyCode || country?.currencyCode || 'USD';
  const cardLogo = card?.logoUrls?.[0]
    || card?.brand?.logoUrl
    || fullProduct?.logoUrls?.[0]
    || fullProduct?.brand?.logoUrl
    || FALLBACK_CARD_IMAGE;

  const selectedRecipientAmount = isFixedType
    ? selectedIndex === null ? null : recipientDenominations[selectedIndex]
    : Number(customAmount);

  useEffect(() => {
    if (!Number.isFinite(selectedRecipientAmount) || selectedRecipientAmount <= 0 || !card?.productId) {
      setNairaAmount(null);
      setFetchingRate(false);
      return undefined;
    }

    let isMounted = true;
    const fetchPreviewRate = async () => {
      setFetchingRate(true);
      try {
        const sessionToken = await getSessionToken();
        const rateRes = await fetch(buildBuyEndpoint('nairaRate', sessionToken, {
          productId: card.productId,
          recipientAmount: selectedRecipientAmount,
          recipientCurrency,
        }));
        const rateData = await rateRes.json();

        if (isMounted && rateData.status === 'success' && Number.isFinite(Number(rateData.ourNairaAmount))) {
          setNairaAmount(Number(rateData.ourNairaAmount));
        } else if (isMounted) {
          setNairaAmount(null);
        }
      } catch (error) {
        if (isMounted) {
          setNairaAmount(null);
        }
        console.log('Rate Preview Error:', error);
      } finally {
        if (isMounted) {
          setFetchingRate(false);
        }
      }
    };

    fetchPreviewRate();
    return () => {
      isMounted = false;
    };
  }, [card?.productId, recipientCurrency, selectedRecipientAmount]);

  const handleDenominationSelect = (index) => {
    setSelectedIndex(index);
    setCustomAmount('');
  };

  const handleBuyNow = async () => {
    let recipientAmount = 0;

    if (isFixedType) {
      if (selectedIndex === null) {
        return Alert.sheet('Error', 'Please select a denomination');
      }
      recipientAmount = recipientDenominations[selectedIndex];
    } else if (isRangeType) {
      const entered = parseFloat(customAmount);
      if (!entered || entered < fullProduct.minRecipientDenomination || entered > fullProduct.maxRecipientDenomination) {
        return Alert.sheet('Error', `Amount must be between ${fullProduct.minRecipientDenomination} and ${fullProduct.maxRecipientDenomination} ${recipientCurrency}`);
      }
      recipientAmount = entered;
    } else {
      return Alert.sheet('Error', 'This product has no valid denomination options');
    }

    setProcessing(true);
    try {
      const sessionToken = await getSessionToken();
      const rateRes = await fetch(buildBuyEndpoint('nairaRate', sessionToken, {
        productId: card.productId,
        recipientAmount,
        recipientCurrency,
      }));
      const rateData = await rateRes.json();

      console.log("Debug - Naira Rate Response (raw):", JSON.stringify(rateData, null, 2));

      if (rateData.status !== 'success') {
        throw new Error(rateData.message || 'Failed to calculate rate');
      }

      const finalNairaAmount = rateData.ourNairaAmount;

      const dataPayload = {
        request: 'giftcard',
        payload: {
          productId: card.productId,
          quantity: 1,
          unitPrice: recipientAmount,
        },
        productId: card.productId,
        productName: card.productName,
        brand: card.brand?.name || fullProduct?.brand?.name || 'Gift Card',
        countryCode: country.isoName,
        countryName: country.name,
        recipientDenomination: recipientAmount,
        amount: finalNairaAmount,
        fee: 0,
        logo: cardLogo,
        recipientCurrencyCode: recipientCurrency,
        denominationType: fullProduct?.denominationType || 'FIXED',
        baseCost: rateData.baseCost,
        discountAmount: rateData.discountAmount,
        convertedNgnCost: rateData.convertedNgnCost,
        markupAmount: rateData.markupAmount,
        senderCurrency: rateData.senderCurrency,
        ngnRateUsed: rateData.ngnRateUsed,
        reloadlySenderAmount: rateData.reloadlySenderAmount,
      };

      onConfirm(dataPayload);
    } catch (err) {
      console.log("Rate Calculation Error:", err);
      Alert.sheet("Error", "Could not calculate Naira rate. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (fetchingDetails) {
    return <LoadingScreen visible={true} message="Loading card details..." />;
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.cardPreview}>
          <View style={styles.cardLogoContainer}>
            <Image 
              source={{ uri: cardLogo }}
              style={styles.cardLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.productName}>{card.productName}</Text>
          <Text style={styles.brandName}>{card.brand?.name || card.brand?.brandName || fullProduct?.brand?.name || fullProduct?.brand?.brandName || 'Gift Card'}</Text>
          <Text style={styles.countryText}>{country.name} • {recipientCurrency}</Text>
        </View>

        <View style={styles.amountContainer}>
          <Text style={styles.label}>
            {isFixedType ? "Available Denominations" : "Enter Amount"}
          </Text>

          {isFixedType ? (
            <View style={styles.denominationGrid}>
              {recipientDenominations.map((denom, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.denominationTile,
                    selectedIndex === index && styles.activeDenominationTile
                  ]}
                  onPress={() => handleDenominationSelect(index)}
                >
                  <Text style={[
                    styles.denominationText,
                    selectedIndex === index && styles.activeDenominationText
                  ]}>
                    {denom} {recipientCurrency}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : isRangeType ? (
            <View>
              <Text style={styles.rangeInfo}>
                Between {fullProduct.minRecipientDenomination} — {fullProduct.maxRecipientDenomination} {recipientCurrency}
              </Text>
              <View style={styles.customInputRow}>
                <Text style={styles.currencySymbol}>{recipientCurrency}</Text>
                <TextInput
                  style={styles.customAmountInput}
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                />
              </View>
            </View>
          ) : null}

          {selectedRecipientAmount > 0 && (
            <View style={styles.ratePreview}>
              <Text style={styles.ratePreviewLabel}>You pay</Text>
              {fetchingRate ? (
                <ActivityIndicator size="small" color={BRAND_COLOR} />
              ) : (
                <Text style={styles.ratePreviewValue}>
                  {nairaAmount === null
                    ? 'Rate unavailable'
                    : `₦${nairaAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </Text>
              )}
            </View>
          )}

          {(isFixedType && selectedIndex !== null) || (!isFixedType && customAmount) ? (
            <TouchableOpacity 
              style={styles.buyButton} 
              onPress={handleBuyNow} 
              activeOpacity={0.9}
            >
              <Text style={styles.buyButtonText}>Buy Now</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <LoadingScreen visible={processing} message="Calculating Naira rate..." />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: 20 * scale, 
    paddingTop: 20, 
    paddingBottom: 40
  },

  cardPreview: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(232, 240, 237, 0.8)',
  },
  cardLogoContainer: {
    width: 90,
    height: 90,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardLogo: { width: 70, height: 70 },
  productName: { fontSize: 18, fontWeight: '800', color: '#0E3C2E', textAlign: 'center', marginBottom: 4 },
  brandName: { fontSize: 13, color: '#666', marginBottom: 8 },
  countryText: { fontSize: 12, color: '#888' },

  amountContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(232, 240, 237, 0.8)',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 15,
  },
  denominationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  denominationTile: {
    width: '48%',
    paddingVertical: 18,
    backgroundColor: 'rgba(209, 228, 221, 0.3)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDenominationTile: {
    backgroundColor: 'rgba(209, 228, 221, 0.8)',
    borderWidth: 2,
    borderColor: BRAND_COLOR,
  },
  denominationText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  activeDenominationText: {
    color: BRAND_COLOR,
  },

  rangeInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },

  buyButton: {
    backgroundColor: BRAND_COLOR,
    height: 52,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  ratePreview: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 60, 46, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratePreviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  ratePreviewValue: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND_COLOR,
  },
});

export default GiftCardBuyDetails;
