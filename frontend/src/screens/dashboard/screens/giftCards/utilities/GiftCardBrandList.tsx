import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  FlatList,
  Platform,
} from 'react-native';
import { useAuthState } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';

const { width } = Dimensions.get('window');
const scale = width / 410;

const numColumns = 2;
const gap = 14 * scale;
const totalPadding = 32;
const availableWidth = width - totalPadding - (gap * (numColumns - 1));
const cardWidth = availableWidth / numColumns;

const bookmarkActiveImg = 'https://cdn-icons-png.flaticon.com/128/10421/10421432.png';
const bookmarkInactiveImg = 'https://cdn-icons-png.flaticon.com/128/10421/10421470.png';
const placeholderImage = 'https://cdn-icons-png.flaticon.com/128/1243/1243929.png';
const sellGiftCardsEndpoint = `${apiConfig.baseUrl}/v1/banking/giftCards/sell/fetching/`;

const normalizeCardType = (value) => {
  const normalized = getDisplayText(value, '').toLowerCase();

  if (!normalized) {
    return 'eCode';
  }

  if (normalized === 'e_code' || normalized === 'ecode') {
    return 'eCode';
  }

  if (normalized === 'physical' || normalized === 'physical_card' || normalized === 'physicalcard') {
    return 'physical';
  }

  return normalized;
};

const normalizeDisplayMode = (value) => {
  const normalized = getDisplayText(value, '').toLowerCase();

  if (!normalized) {
    return 'cover';
  }

  if (normalized === 'symbol' || normalized === 'symbol_mode' || normalized === 'symbol-mode') {
    return 'symbol';
  }

  if (normalized === 'cover' || normalized === 'cover_mode' || normalized === 'cover-mode') {
    return 'cover';
  }

  return normalized;
};

const getDisplayText = (value, fallback = '') => {
  if (value == null) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    const candidates = [value.name, value.brandName, value.productName, value.title, value.displayName, value.value];

    for (const candidate of candidates) {
      const text = getDisplayText(candidate, '');
      if (text) {
        return text;
      }
    }
  }

  return fallback;
};

const buildBuySelectionPayload = (brand) => {
  const rawBrand = brand?.source ?? brand;
  const productName = getDisplayText(
    rawBrand?.productName,
    getDisplayText(rawBrand?.name, getDisplayText(rawBrand?.brandName, getDisplayText(rawBrand?.brand, 'Gift Card')))
  );

  return {
    ...rawBrand,
    productId: rawBrand?.productId ?? rawBrand?.id,
    productName,
    brand: rawBrand?.brand && typeof rawBrand.brand === 'object'
      ? rawBrand.brand
      : { name: getDisplayText(rawBrand?.brandName, getDisplayText(rawBrand?.brand, 'Gift Card')) },
    logoUrls: Array.isArray(rawBrand?.logoUrls) && rawBrand.logoUrls.length > 0
      ? rawBrand.logoUrls
      : rawBrand?.logoUrl
        ? [rawBrand.logoUrl]
        : [],
    logo: rawBrand?.logoUrl ?? rawBrand?.image?.url ?? rawBrand?.image ?? rawBrand?.logoUrls?.[0] ?? '',
  };
};

const normalizeGiftCardBrand = (brand) => {
  const normalizedCountries = Array.isArray(brand?.countries)
    ? brand.countries.map((country) => {
        const currency = country?.currency && typeof country.currency === 'object'
          ? country.currency
          : {};
        const requirements = country?.requirements && typeof country.requirements === 'object'
          ? country.requirements
          : {};
        const denominations = country?.denominations && typeof country.denominations === 'object'
          ? country.denominations
          : {};
        const currencyCode = getDisplayText(country?.currencyCode, getDisplayText(currency.code, ''));

        return {
          ...country,
          name: getDisplayText(country?.name, getDisplayText(country?.countryName, '')),
          country: getDisplayText(country?.country, getDisplayText(country?.countryName, '')),
          isoName: getDisplayText(country?.isoName, getDisplayText(country?.countryCode, '')),
          currency,
          currencyCode,
          currencyName: getDisplayText(country?.currencyName, getDisplayText(currency.name, currencyCode)),
          currencySymbol: getDisplayText(country?.currencySymbol, getDisplayText(currency.symbol, '')),
          receiptRequired: country?.receiptRequired ?? requirements.receiptRequired ?? false,
          requiresUpload: country?.requiresUpload ?? requirements.requiresUpload ?? false,
          maxImageUpload: country?.maxImageUpload ?? requirements.maxImageUpload ?? 0,
          denominationType: getDisplayText(country?.denominationType, getDisplayText(denominations.type, '')),
          denominations: Array.isArray(country?.denominations)
            ? country.denominations
            : Array.isArray(denominations.values) ? denominations.values : [],
          minimumAmount: country?.minimumAmount ?? denominations.minimumAmount,
          maximumAmount: country?.maximumAmount ?? denominations.maximumAmount,
          cardType: normalizeCardType(country?.cardType),
          isActive: country?.isActive ?? true,
        };
      })
    : [{ isActive: true, cardType: 'eCode' }];

  const brandName = getDisplayText(
    brand?.brandName,
    getDisplayText(brand?.brand, getDisplayText(brand?.productName, getDisplayText(brand?.name, 'Gift Card')))
  );

  const brandImage = getDisplayText(
    brand?.logoUrl,
    getDisplayText(
      brand?.image?.url,
      getDisplayText(brand?.image, getDisplayText(brand?.logoUrls?.[0], getDisplayText(brand?.brand?.logoUrl, '')))
    )
  );

  return {
    id: getDisplayText(brand?.id ?? brand?.productId, `${brandName}-${Math.random()}`),
    brand: brandName,
    image: brandImage,
    imageMetadata: brand?.image && typeof brand.image === 'object' ? brand.image : null,
    slug: getDisplayText(brand?.slug),
    sortOrder: brand?.sortOrder,
    displayMode: normalizeDisplayMode(brand?.displayMode),
    isActive: brand?.isActive ?? true,
    countries: normalizedCountries,
    source: brand,
  };
};

export const fetchGiftCardBrands = async (mode = 'sell') => {
  if (mode !== 'sell') {
    return { status: 'success', data: [] };
  }

  const response = await fetch(sellGiftCardsEndpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await response.json();
  const giftCards = Array.isArray(payload?.giftCards)
    ? payload.giftCards
    : Array.isArray(payload?.data?.giftCards)
      ? payload.data.giftCards
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return {
    status: payload?.status === 'success' ? 'success' : 'error',
    data: giftCards,
    message: payload?.message,
  };
};

export const GiftCardSkeletonLoader = () => {
  const shimmerValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(shimmerValue, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmerValue]);

  return (
    <View style={styles.gridContainer}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={`skeleton-${index}`} style={styles.card}>
          <Animated.View style={[styles.imageCoverBlock, { opacity: shimmerValue, backgroundColor: '#E2E8F0' }]} />

          <View style={styles.infoSectionRow}>
            <View style={{ flex: 1 }}>
              <Animated.View style={[styles.skeletonLineLong, { opacity: shimmerValue }]} />
              <Animated.View style={[styles.skeletonLineShort, { opacity: shimmerValue }]} />
            </View>
            <View style={styles.skeletonFavCircle} />
          </View>

          <View style={styles.skeletonButtonFrame} />
        </View>
      ))}
    </View>
  );
};

export const GiftCardBrandCard = ({ brand, onPress, selectedType, mode }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const normalizedBrand = useMemo(() => normalizeGiftCardBrand(brand), [brand]);
  const isCover = normalizedBrand.displayMode === 'cover';
  const hasActiveTradeRoute = useMemo(() => {
    return normalizedBrand.countries?.some((country) => normalizeCardType(country.cardType) === normalizeCardType(selectedType) && country.isActive);
  }, [normalizedBrand.countries, selectedType]);
  const isOffline = !normalizedBrand.isActive || !hasActiveTradeRoute;
  const actionLabel = mode === 'buy' ? 'Buy' : 'Sell';

  const handlePress = () => {
    if (mode === 'buy') {
      onPress?.(buildBuySelectionPayload(normalizedBrand));
      return;
    }

    onPress?.(normalizedBrand);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={styles.imageCoverBlock}>
        <Image source={{ uri: normalizedBrand.image || placeholderImage }} style={isCover ? styles.coverBrandLogo : styles.centerBrandLogo} />
      </View>

      <View style={styles.infoSectionRow}>
        <View style={styles.textContainerWrapper}>
          <Text style={styles.brandNameText} numberOfLines={1}>{normalizedBrand.brand}</Text>
          <Text style={styles.subtextLabel} numberOfLines={1}>
            Trading
          </Text>
        </View>

        <TouchableOpacity
          style={styles.favoriteButtonTap}
          onPress={() => setIsFavorite(!isFavorite)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: isFavorite ? bookmarkActiveImg : bookmarkInactiveImg }} style={styles.bookmarkImageStyle} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtonContainer}> 
        <Text style={styles.actionButtonText}>{actionLabel}</Text>
      </View>
    </TouchableOpacity>
  );
};

const GiftCardBrandList = ({
  searchQuery = '',
  selectedType,
  onBrandPress,
  mode,
  fetchBrands = fetchGiftCardBrands,
  initialData = null,
  data = null,
  emptyMessage,
  contentPaddingHorizontal = 16,
  contentPaddingTop = 0,
  contentPaddingBottom = 40,
  loading: controlledLoading,
}) => {
  const resolvedData = Array.isArray(data) ? data : Array.isArray(initialData) ? initialData : null;
  const { isAuthLoading } = useAuthState();
  const [brandsData, setBrandsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const isModeResolved = mode !== undefined;
  const isSelectionResolved = selectedType !== undefined && selectedType !== null;
  const isBootReady = !isAuthLoading && isModeResolved && isSelectionResolved;

  useEffect(() => {
    let isMounted = true;
    let activeRequest = 0;

    const nextData = Array.isArray(data) ? data : Array.isArray(initialData) ? initialData : null;

    if (!isBootReady) {
      setBrandsData([]);
      setLoading(true);
      return () => {
        isMounted = false;
      };
    }

    if (nextData !== null) {
      setBrandsData(nextData);
      setLoading(controlledLoading !== undefined ? controlledLoading : false);
      return () => {
        isMounted = false;
      };
    }

    if (controlledLoading !== undefined) {
      setBrandsData([]);
      setLoading(controlledLoading);
      return () => {
        isMounted = false;
      };
    }

    setBrandsData([]);
    setLoading(true);

    const loadBrands = async () => {
      const requestId = ++activeRequest;

      try {
        console.log(`[GiftCardBrandList] ${mode} fetch response`, fetchBrands);
        const response = await fetchBrands(mode);

        if (!isMounted || requestId !== activeRequest) {
          return;
        }

        console.log(`[GiftCardBrandList] ${mode} response payload`, response);

        const payload = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
            ? response
            : [];

        if (!isMounted || requestId !== activeRequest) {
          return;
        }

        setBrandsData(payload);
      } catch (error) {
        if (!isMounted || requestId !== activeRequest) {
          return;
        }
        console.log(`[GiftCardBrandList] ${mode} fetch failed`, error);
        setBrandsData([]);
      } finally {
        if (isMounted && requestId === activeRequest) {
          setLoading(false);
        }
      }
    };

    loadBrands();

    return () => {
      isMounted = false;
      activeRequest += 1;
    };
  }, [data, initialData, controlledLoading, fetchBrands, mode, isAuthLoading, isBootReady, selectedType]);

  const filteredBrands = useMemo(() => {
    if (!isBootReady) {
      return [];
    }

    const query = searchQuery.toLowerCase().trim();

    return brandsData
      .map((brand) => normalizeGiftCardBrand(brand))
      .filter((brand) => {
        const hasActiveTradeRoute = brand.countries?.some((country) => normalizeCardType(country.cardType) === normalizeCardType(selectedType) && country.isActive);
        const isActive = brand.isActive !== false && (!selectedType || hasActiveTradeRoute);
        const matchesSearch = !query || brand.brand.toLowerCase().includes(query);
        const matchesType = mode === 'buy' || !selectedType || hasActiveTradeRoute;
        return isActive && matchesSearch && matchesType;
      });
  }, [searchQuery, brandsData, selectedType, mode, isBootReady]);

  if (!isBootReady) {
    return (
      <View
        style={[
          styles.listContent,
          {
            paddingHorizontal: contentPaddingHorizontal,
            paddingTop: contentPaddingTop,
            paddingBottom: contentPaddingBottom,
          },
        ]}
      >
        <View style={styles.authPendingContainer}>
          <Text style={styles.emptyText}>Preparing gift cards…</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <FlatList
        key="skeleton-view"
        data={[{ id: 'skeleton' }]}
        keyExtractor={(item) => item.id}
        renderItem={() => <GiftCardSkeletonLoader />}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        decelerationRate="normal"
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: contentPaddingHorizontal,
            paddingTop: contentPaddingTop,
            paddingBottom: contentPaddingBottom,
          },
        ]}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        scrollEventThrottle={16}
      />
    );
  }

  if (filteredBrands.length === 0) {
    return (
      <FlatList
        key="empty-view"
        data={[{ id: 'empty' }]}
        keyExtractor={(item) => item.id}
        renderItem={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{emptyMessage || `No gift cards found matching "${searchQuery}"`}</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        decelerationRate="normal"
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: contentPaddingHorizontal,
            paddingTop: contentPaddingTop,
            paddingBottom: contentPaddingBottom,
          },
        ]}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        scrollEventThrottle={16}
      />
    );
  }

  return (
    <FlatList
      key={`grid-${numColumns}`}
      data={filteredBrands}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={[
        styles.listContent,
        {
          paddingHorizontal: contentPaddingHorizontal,
          paddingTop: contentPaddingTop,
          paddingBottom: contentPaddingBottom,
        },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={true}
      overScrollMode="never"
      decelerationRate="normal"
      removeClippedSubviews={Platform.OS === 'android'}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={10}
      scrollEventThrottle={16}
      renderItem={({ item }) => (
        <GiftCardBrandCard brand={item} onPress={onBrandPress} selectedType={selectedType} mode={mode} />
      )}
    />
  );
};

export default GiftCardBrandList;

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    gap,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: 40,
    gap,
  },
  card: {
    backgroundColor: '#FFFFFF',
    width: cardWidth,
    borderRadius: 18 * scale,
    padding: 10 * scale,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  imageCoverBlock: {
    width: '100%',
    height: 112 * scale,
    backgroundColor: '#F8FAFC',
    borderRadius: 14 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  centerBrandLogo: {
    width: 38 * scale,
    height: 38 * scale,
    resizeMode: 'contain',
  },
  coverBrandLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  infoSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10 * scale,
    paddingHorizontal: 2 * scale,
  },
  textContainerWrapper: {
    flex: 1,
    paddingRight: 4 * scale,
    justifyContent: 'center',
  },
  brandNameText: {
    fontSize: 13 * scale,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 1 * scale,
  },
  subtextLabel: {
    fontSize: 10 * scale,
    color: '#94A3B8',
    fontWeight: '500',
  },
  favoriteButtonTap: {
    width: 26 * scale,
    height: 26 * scale,
    borderRadius: 13 * scale,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bookmarkImageStyle: {
    width: 14 * scale,
    height: 14 * scale,
    resizeMode: 'contain',
  },
  actionButtonContainer: {
    width: '100%',
    height: 36 * scale,
    borderRadius: 12 * scale,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 2 * scale,
  },
  actionButtonText: {
    fontSize: 11.5 * scale,
    color: '#0F172A',
    fontWeight: '700',
  },
  skeletonCenterIcon: {
    width: 34 * scale,
    height: 34 * scale,
    borderRadius: 10 * scale,
    backgroundColor: '#CBD5E1',
  },
  skeletonLineLong: {
    width: '80%',
    height: 11 * scale,
    backgroundColor: '#F1F5F9',
    borderRadius: 4 * scale,
    marginBottom: 6 * scale,
  },
  skeletonLineShort: {
    width: '45%',
    height: 9 * scale,
    backgroundColor: '#F1F5F9',
    borderRadius: 4 * scale,
  },
  skeletonFavCircle: {
    width: 26 * scale,
    height: 26 * scale,
    borderRadius: 13 * scale,
    backgroundColor: '#F1F5F9',
  },
  skeletonButtonFrame: {
    width: '100%',
    height: 36 * scale,
    borderRadius: 12 * scale,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyContainer: {
    padding: 40 * scale,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13 * scale,
    color: '#64748B',
    textAlign: 'center',
  },
  authPendingContainer: {
    minHeight: 140 * scale,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24 * scale,
  },
});
