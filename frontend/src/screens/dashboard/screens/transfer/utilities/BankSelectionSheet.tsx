import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '@components/common/SearchBar';
import config from '@config/app';
import { apiConfig } from '@config/api';

const { height: screenHeight } = Dimensions.get('window');
const BRAND_COLOR = '#0E3C2E';
const BANK_RENDER_LIMIT = 40;
const BANK_PREFETCH_DISTANCE = 1200;
const transferFetchingUrl = `${apiConfig.baseUrl}/v1/banking/transfers/fetching/`;
const transferBanksCacheKey = 'transferBanksCache';
const cacheExpiry = 4 * 60 * 60 * 1000; // 4 hours

const BankLogo = React.memo(({ sourceUri }) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {isLoading && (
        <Image
          source={{ uri: 'https://cdn-icons-png.flaticon.com/128/3914/3914398.png' }}
          style={styles.placeholderLogo}
          cachePolicy="memory-disk"
        />
      )}
      <Image
        source={{ uri: sourceUri }}
        style={styles.logo}
        cachePolicy="memory-disk"
        onLoadEnd={() => setIsLoading(false)}
      />
    </>
  );
});

const BankRow = React.memo(({ item, onSelect }) => {
  const handlePress = useCallback(() => onSelect(item), [item, onSelect]);

  return (
    <TouchableOpacity style={styles.bankItem} onPress={handlePress}>
      <View style={styles.logoContainer}>
        <BankLogo sourceUri={item.logoImage} />
      </View>
      <Text style={styles.bankName}>{item.bankName}</Text>
    </TouchableOpacity>
  );
});

const getBankSortLetter = (bankName) => bankName.match(/[A-Za-z]/)?.[0]?.toUpperCase() || '#';

const compareBanks = (firstBank, secondBank) => {
  const firstName = firstBank.bankName.trim();
  const secondName = secondBank.bankName.trim();
  const firstLetter = getBankSortLetter(firstName);
  const secondLetter = getBankSortLetter(secondName);
  if (firstLetter !== secondLetter) {
    if (firstLetter === '#') return 1;
    if (secondLetter === '#') return -1;
    return firstLetter.localeCompare(secondLetter);
  }
  return firstName.localeCompare(secondName);
};

const BankSelectionSheet = ({ isVisible, onClose, onSelect, sessionToken }) => {
  const diagnosticsStartedAtRef = useRef(Date.now());
  const openTriggerAtRef = useRef(null);
  const lastScrollLogAtRef = useRef(0);
  const logDiagnostic = useCallback((event, details = {}) => {
    const elapsedMs = Date.now() - diagnosticsStartedAtRef.current;
    console.log(`[BankSelectionSheet][${event}]`, {
      elapsedMs,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [banks, setBanks] = useState([]);
  const [fetchError, setFetchError] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(BANK_RENDER_LIMIT);
  const [sheetMounted, setSheetMounted] = useState(false);
  const previousVisibilityRef = useRef(isVisible);
  const scrollRef = useRef(null);
  const cachedBanksRef = useRef([]);
  const sheetTranslate = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const lastPaginationDiagnosticAtRef = useRef(0);
  const postOpenWorkRef = useRef(null);
  const postOpenStartedRef = useRef(false);

  useEffect(() => {
    logDiagnostic('mounted', { isVisible });
    return () => {
      logDiagnostic('unmounted');
    };
  }, [logDiagnostic]);

  useEffect(() => {
    let cancelled = false;

    const preloadCachedBanks = async () => {
      try {
        const cached = await AsyncStorage.getItem(transferBanksCacheKey);
        if (!cached || cancelled) return;

        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheExpiry && Array.isArray(data) && data.length > 0) {
          cachedBanksRef.current = normalizeBankList(data);
          logDiagnostic('cache-preloaded-before-open', {
            bankCount: cachedBanksRef.current.length,
            cacheAgeMs: Date.now() - timestamp,
          });
        }
      } catch (error) {
        logDiagnostic('cache-preload-error', { message: error?.message });
      }
    };

    preloadCachedBanks();
    return () => {
      cancelled = true;
    };
  }, [logDiagnostic]);

  const animateOpen = useCallback(() => {
    const openedAt = Date.now();
    logDiagnostic('open-animation-start', {
      screenHeight,
      currentTranslateY: sheetTranslate.__getValue(),
      timeSinceOpenTriggerMs: openTriggerAtRef.current ? Date.now() - openTriggerAtRef.current : null,
    });
    isClosingRef.current = false;
    sheetTranslate.stopAnimation();
    backdropOpacity.stopAnimation();
    sheetTranslate.setValue(screenHeight);
    backdropOpacity.setValue(1);
    sheetTranslate.setValue(0);
    logDiagnostic('open-animation-end', {
      finished: true,
      animationDurationMs: Date.now() - openedAt,
      timeSinceOpenTriggerMs: openTriggerAtRef.current ? Date.now() - openTriggerAtRef.current : null,
    });
  }, [backdropOpacity, logDiagnostic, sheetTranslate]);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) {
      logDiagnostic('close-ignored-already-closing');
      return;
    }
    logDiagnostic('close-requested', { currentTranslateY: sheetTranslate.__getValue() });
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true, 
      }),
      Animated.timing(sheetTranslate, {
        toValue: screenHeight,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      logDiagnostic('close-animation-end', { finished });
      isClosingRef.current = false;
      onClose?.();
    });
  }, [backdropOpacity, logDiagnostic, onClose, sheetTranslate]);

  async function safeParseResponse(resp) {
    try {
      return await resp.clone().json();
    } catch (e) {
      try {
        const txt = await resp.text();
        return JSON.parse(txt);
      } catch (ee) {
        return null;
      }
    }
  }

  const normalizeBankList = (list) => {
    return (Array.isArray(list) ? list : []).map((bank) => ({
      bankName: (bank.bankName || bank.name || '').toString().trim(),
      bankCode: (bank.bankCode || bank.routingKey || bank.code || '').toString().trim(),
      logoImage: bank.logoImage || null,
    })).filter((bank) => bank.bankCode).sort(compareBanks);
  };

  const fetchBanks = useCallback(async () => {
    const fetchStartedAt = Date.now();
    logDiagnostic('fetch-start', { cacheKey: transferBanksCacheKey });
    setFetchError(false);
    let cachedBanks = cachedBanksRef.current;

    if (cachedBanks.length > 0) {
      logDiagnostic('cache-ref-hit', { bankCount: cachedBanks.length });
      setBanks(cachedBanks);
    } else {
      try {
        const cached = await AsyncStorage.getItem(transferBanksCacheKey);
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheExpiry && Array.isArray(data) && data.length > 0) {
            cachedBanks = normalizeBankList(data);
            cachedBanksRef.current = cachedBanks;
            logDiagnostic('cache-hit', {
              bankCount: cachedBanks.length,
              cacheAgeMs: Date.now() - timestamp,
            });
            setBanks(cachedBanks);
          } else {
            logDiagnostic('cache-miss-expired-or-empty');
          }
        } else {
          logDiagnostic('cache-miss-none');
        }
      } catch (cacheError) {
        logDiagnostic('cache-read-error', { message: cacheError?.message });
        console.error('BankSelectionSheet: cache load failed', cacheError);
      }
    }

    try {
      const requestStartedAt = Date.now();
      const token = sessionToken || '';
      logDiagnostic('network-request-start', { tokenAvailable: Boolean(token), source: 'parent-prop' });
      const response = await fetch(`${transferFetchingUrl}?${new URLSearchParams({ action: 'banks', [config.sessionToken]: token || '', country: 'NG' })}`);
      logDiagnostic('network-response-received', {
        ok: response.ok,
        status: response.status,
        requestDurationMs: Date.now() - requestStartedAt,
      });
      const res = await safeParseResponse(response);
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      const normalized = normalizeBankList(list);
      const seen = new Set();
      const uniqueBanks = [];
      for (const bank of normalized) {
        if (bank.bankCode && !seen.has(bank.bankCode)) {
          seen.add(bank.bankCode);
          uniqueBanks.push(bank);
        }
      }

      logDiagnostic('network-data-normalized', {
        rawCount: list.length,
        normalizedCount: normalized.length,
        uniqueCount: uniqueBanks.length,
      });

      if (uniqueBanks.length > 0) {
        cachedBanksRef.current = uniqueBanks;
        setBanks((currentBanks) => {
          const unchanged = currentBanks.length === uniqueBanks.length
            && currentBanks.every((bank, index) => (
              bank.bankCode === uniqueBanks[index]?.bankCode
              && bank.bankName === uniqueBanks[index]?.bankName
              && bank.logoImage === uniqueBanks[index]?.logoImage
            ));
          if (unchanged) {
            logDiagnostic('network-list-unchanged-state-retained', { bankCount: currentBanks.length });
            return currentBanks;
          }
          return uniqueBanks;
        });
        await AsyncStorage.setItem(transferBanksCacheKey, JSON.stringify({ timestamp: Date.now(), data: uniqueBanks }));
        logDiagnostic('fetch-complete', {
          source: 'network',
          bankCount: uniqueBanks.length,
          totalDurationMs: Date.now() - fetchStartedAt,
        });
      } else if (cachedBanks.length === 0) { // Only set error if no cached banks and no fresh banks
        setFetchError(true);
        logDiagnostic('fetch-empty-error', { totalDurationMs: Date.now() - fetchStartedAt });
      } else {
        logDiagnostic('fetch-complete-cache-retained', {
          bankCount: cachedBanks.length,
          totalDurationMs: Date.now() - fetchStartedAt,
        });
      }
    } catch (error) {
      console.error('BankSelectionSheet: fetchBanks error', error);
      logDiagnostic('fetch-error', {
        message: error?.message,
        usedCachedBanks: cachedBanks.length > 0,
        totalDurationMs: Date.now() - fetchStartedAt,
      });
      if (cachedBanks.length === 0) { // Only set error if no cached banks
        setFetchError(true);
      }
    }
  }, [logDiagnostic, sessionToken]);

  useEffect(() => {
    postOpenWorkRef.current = () => {
      logDiagnostic('post-open-fetch-start');
      fetchBanks();
    };
  }, [fetchBanks, logDiagnostic]);

  const startPostOpenWork = useCallback(() => {
    if (postOpenStartedRef.current) return;
    postOpenStartedRef.current = true;
    logDiagnostic('sheet-fully-open-post-open-work-start');
    postOpenWorkRef.current?.();
  }, [logDiagnostic]);

  useEffect(() => {
    if (!sheetMounted) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });

    return () => subscription.remove();
  }, [handleClose, sheetMounted]);

  useEffect(() => {
    logDiagnostic('visibility-change', { isVisible });
    previousVisibilityRef.current = isVisible;
    if (!isVisible) {
      setSheetMounted(false);
      setVisibleLimit(BANK_RENDER_LIMIT);
      loadingMoreRef.current = false;
      sheetTranslate.setValue(screenHeight);
      backdropOpacity.setValue(0);
      return;
    }

    logDiagnostic('open-trigger-received', {
      visibleLimit: BANK_RENDER_LIMIT,
      hasCachedBanksInState: banks.length > 0,
    });
    openTriggerAtRef.current = Date.now();
    setVisibleLimit(BANK_RENDER_LIMIT);
    loadingMoreRef.current = false;
    postOpenStartedRef.current = false;
    setSheetMounted(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    animateOpen();
  }, [animateOpen, backdropOpacity, isVisible, logDiagnostic, sheetTranslate]);

  useEffect(() => {
    logDiagnostic('render-state', {
      isVisible,
      bankCount: banks.length,
      visibleLimit,
      searchQueryLength: searchQuery.length,
      fetchError,
    });
  }, [banks.length, fetchError, isVisible, logDiagnostic, searchQuery.length, visibleLimit]);

  const normalizedBanks = useMemo(() => {
    return banks.filter((bank) => bank.bankCode);
  }, [banks]);

  const filteredBanks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return normalizedBanks;
    return normalizedBanks.filter((bank) => (bank.bankName || '').toLowerCase().includes(query));
  }, [searchQuery, normalizedBanks]);

  useEffect(() => {
    setVisibleLimit(BANK_RENDER_LIMIT);
  }, [searchQuery]);

  const isOpening = isVisible && !previousVisibilityRef.current;
  const renderLimit = isOpening ? BANK_RENDER_LIMIT : visibleLimit;
  const visibleBanks = useMemo(() => filteredBanks.slice(0, renderLimit), [filteredBanks, renderLimit]);

  const sectionedBanks = useMemo(() => {
    const grouped = visibleBanks.reduce((acc, bank) => {
      const firstLetter = getBankSortLetter(bank.bankName);
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(bank);
      return acc;
    }, {});

    const alphaKeys = Object.keys(grouped).filter(key => key !== '#').sort();
    const hashKey = Object.keys(grouped).includes('#') ? ['#'] : [];

    return [...alphaKeys, ...hashKey].map(letter => ({
      title: letter,
      data: grouped[letter].sort((a, b) => a.bankName.localeCompare(b.bankName)),
    }));
  }, [visibleBanks]);

  useEffect(() => {
    logDiagnostic('rendered-batch', {
      visibleBankCount: visibleBanks.length,
      sectionCount: sectionedBanks.length,
      sectionTitles: sectionedBanks.map((section) => section.title),
      visibleLimit: renderLimit,
      totalBanks: filteredBanks.length,
    });
  }, [filteredBanks.length, logDiagnostic, renderLimit, sectionedBanks, visibleBanks.length]);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
  const hasMoreBanks = filteredBanks.length > renderLimit;

  const loadMoreBanks = useCallback((distanceFromEnd = BANK_PREFETCH_DISTANCE) => {
    if (!hasMoreBanks) {
      if (Date.now() - lastPaginationDiagnosticAtRef.current > 500) {
        lastPaginationDiagnosticAtRef.current = Date.now();
        logDiagnostic('pagination-skipped-no-more-banks', { visibleLimit, totalBanks: filteredBanks.length });
      }
      return;
    }
    if (loadingMoreRef.current) {
      if (Date.now() - lastPaginationDiagnosticAtRef.current > 500) {
        lastPaginationDiagnosticAtRef.current = Date.now();
        logDiagnostic('pagination-skipped-already-loading', { visibleLimit, totalBanks: filteredBanks.length });
      }
      return;
    }

    loadingMoreRef.current = true;
    const batchSize = distanceFromEnd < 0 ? BANK_RENDER_LIMIT * 2 : BANK_RENDER_LIMIT;
    logDiagnostic('pagination-start', {
      distanceFromEnd,
      visibleLimitBefore: visibleLimit,
      requestedBatchSize: batchSize,
      totalBanks: filteredBanks.length,
    });
    setVisibleLimit((currentLimit) => Math.min(currentLimit + batchSize, filteredBanks.length));
    setTimeout(() => {
      loadingMoreRef.current = false;
      logDiagnostic('pagination-lock-released');
    }, 100);
  }, [filteredBanks.length, hasMoreBanks, logDiagnostic, visibleLimit]);

  const handleListScroll = useCallback((event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromEnd = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    const now = Date.now();
    if (now - lastScrollLogAtRef.current >= 250 || distanceFromEnd < BANK_PREFETCH_DISTANCE) {
      lastScrollLogAtRef.current = now;
      logDiagnostic('scroll', {
        offsetY: Math.round(contentOffset.y),
        viewportHeight: Math.round(layoutMeasurement.height),
        contentHeight: Math.round(contentSize.height),
        distanceFromEnd: Math.round(distanceFromEnd),
        visibleLimit,
        totalBanks: filteredBanks.length,
        hasMoreBanks,
        loadingMore: loadingMoreRef.current,
      });
    }
    if (distanceFromEnd < BANK_PREFETCH_DISTANCE) {
      loadMoreBanks(distanceFromEnd);
    }
  }, [filteredBanks.length, hasMoreBanks, loadMoreBanks, logDiagnostic, visibleLimit]);

  const handleMomentumScrollBegin = useCallback(() => {
    logDiagnostic('momentum-scroll-start', { visibleLimit, totalBanks: filteredBanks.length });
  }, [filteredBanks.length, logDiagnostic, visibleLimit]);

  const handleMomentumScrollEnd = useCallback((event) => {
    logDiagnostic('momentum-scroll-end');
    handleListScroll(event);
  }, [handleListScroll, logDiagnostic]);

  const handleContentSizeChange = useCallback((contentWidth, contentHeight) => {
    logDiagnostic('content-size-change', {
      contentWidth: Math.round(contentWidth),
      contentHeight: Math.round(contentHeight),
      visibleLimit,
      totalBanks: filteredBanks.length,
    });
  }, [filteredBanks.length, logDiagnostic, visibleLimit]);

  const handleSheetLayout = useCallback(({ nativeEvent: { layout } }) => {
    logDiagnostic('sheet-layout', {
      width: Math.round(layout.width),
      height: Math.round(layout.height),
    });
    startPostOpenWork();
  }, [logDiagnostic, startPostOpenWork]);

  if (!sheetMounted) return null;

  return (
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />
        </Animated.View>
        <Animated.View
          onLayout={handleSheetLayout}
          style={[styles.sheetContainer, { transform: [{ translateY: sheetTranslate }] }]}
        >
          <SafeAreaView style={styles.sheetContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select a Bank</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close-circle" size={24} color="#ccc" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrapper}>
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              placeholder="Search for a bank..."
            />
          </View>

          <View
            style={styles.listContainer}
            onLayout={({ nativeEvent: { layout } }) => logDiagnostic('list-layout', {
              width: Math.round(layout.width),
              height: Math.round(layout.height),
            })}
          >
            {fetchError && banks.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Unable to load banks. Pull down to retry.</Text>
                <TouchableOpacity onPress={fetchBanks} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                onScroll={handleListScroll}
                onMomentumScrollBegin={handleMomentumScrollBegin}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                onContentSizeChange={handleContentSizeChange}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
              >
                {sectionedBanks.map((section) => (
                  <View key={section.title}>
                    <Text style={styles.sectionHeader}>{section.title}</Text>
                    {section.data.map((bank) => (
                      <View key={bank.bankCode || bank.bankName}>
                        <BankRow item={bank} onSelect={onSelect} />
                        <View style={styles.separator} />
                      </View>
                    ))}
                  </View>
                ))}

              </ScrollView>
            )}
            <View style={styles.alphabetSidebar}>
              {alphabet.map((letter) => (
                <TouchableOpacity
                  key={letter}
                  onPress={() => {
                    const sectionIndex = sectionedBanks.findIndex((section) => section.title === letter);
                    if (sectionIndex !== -1) {
                      scrollRef.current?.scrollTo({ y: sectionIndex * 240, animated: true });
                    }
                  }}
                >
                  <Text style={styles.alphabetText}>{letter}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          </SafeAreaView>
        </Animated.View>
      </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'flex-end',
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetContainer: {
    height: screenHeight * 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetContent: {
    flex: 1,
    backgroundColor: '#f5f8f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: BRAND_COLOR },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  listContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: BRAND_COLOR,
    backgroundColor: '#f5f8f7',
    paddingVertical: 14,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  placeholderLogo: {
    width: 15,
    height: 15,
    tintColor: '#CBD5E1',
    position: 'absolute',
  },
  bankName: { fontSize: 15, color: '#333' },
  separator: { height: 1, backgroundColor: '#eef2f1' },
  alphabetSidebar: { justifyContent: 'center', paddingHorizontal: 8 },
  alphabetText: { fontSize: 8, color: BRAND_COLOR, paddingVertical: 2, fontWeight: 'bold' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#4B5563',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default React.memo(BankSelectionSheet);