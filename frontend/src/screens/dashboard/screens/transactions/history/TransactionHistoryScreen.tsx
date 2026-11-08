import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  SectionList,
  RefreshControl,
  StyleSheet,
  Platform,
  StatusBar,
  Image,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import { useVisualDelay } from '@hooks/useVisualDelay';
import { formatDateTime } from '@lib/utils/format';
import Constants from 'expo-constants';
import AdvertSlider from '@components/ads/AdvertSlider';
import DatePickerSheet from '@components/common/DatePicker';
import FilterSheet from './utilities/FilterSheet';
import TransactionCard from './utilities/TransactionCard';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { Alert } from '@components/common/Alert';

const api = apiConfig.baseUrl;

const { width, height } = Dimensions.get('window');
const BRAND_COLOR = '#0E3C2E';

const API_URL = `${api}/v1/user/transactions/history.php`;

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
const VALID_CATEGORIES = ['All Categories', 'Airtime', 'Data', 'Betting', 'Electricity', 'Cashback', 'Referral Bonus'];

const TransactionHistoryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  const [category, setCategory] = useState('All Categories');
  const [selectedMonth, setSelectedMonth] = useState(months[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const walletType = route.params?.walletType || null;
  const showTransactionSkeleton = useVisualDelay(!loading, 350);

  useEffect(() => {
    if (route.params?.category) {
      const incomingCategory = route.params.category;
      const isValid = VALID_CATEGORIES.some(
        (cat) => cat.toLowerCase() === incomingCategory.toLowerCase()
      );

      if (isValid) {
        const matchedCategory = VALID_CATEGORIES.find(
          (cat) => cat.toLowerCase() === incomingCategory.toLowerCase()
        );
        setCategory(matchedCategory);
      }
    }
  }, [route.params?.category]);

  useEffect(() => {
    const getToken = async () => {
      try {
        const token = await getSessionToken();
        setSessionToken(token);
      } catch (error) {
        console.error('Error loading session token:', error);
      }
    };
    getToken();
  }, []);

  const toggleFilterSheet = (show) => {
    // utility FilterSheet handles animation; just toggle visibility state immediately
    setShowFilterSheet(!!show);
  };

  const toggleDateSheet = (show) => {
    // utility DatePickerSheet handles animation; just toggle visibility state immediately
    setShowDateSheet(!!show);
  };

  const fetchTransactions = useCallback(async (isSilent = false) => {
    if (!sessionToken) return;
    try {
      if (!isSilent) {
        setLoading(true);
        setTransactions([]);
      }

      const mIndex = months.indexOf(selectedMonth);
      const startDateStr = `${selectedYear}-${(mIndex + 1).toString().padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(selectedYear), mIndex + 1, 0).getDate();
      const endDateStr = `${selectedYear}-${(mIndex + 1).toString().padStart(2, '0')}-${lastDay}`;

      const requestCategory = category === 'All Categories'
        ? null
        : category === 'Cashback'
        ? ['Bonus', 'Cashback Debit']
        : category;

      const payload = {
        [config.sessionToken]: sessionToken,
        category: requestCategory,
        ...(walletType ? { wallet_type: walletType } : {}),
        startDate: startDateStr,
        endDate: endDateStr,
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.status === 'success') {
        const newTransactions = data.transactions || [];
        const sortedData = [...newTransactions].sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        setTransactions(sortedData);
      }
    } catch (error) {
      console.error('Fetch Error:', error); // Keep console log for debugging
      Alert.sheet("Error", "Failed to load transactions. Please check your internet connection.", [
        { text: "Dismiss", style: "cancel" },
        { text: "Try Again", onPress: () => fetchTransactions(false) }]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, category, selectedMonth, selectedYear, walletType]);

  useEffect(() => {
    if (!sessionToken) return;
    fetchTransactions(false);
    const interval = setInterval(() => {
      fetchTransactions(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTransactions, sessionToken, category, selectedMonth, selectedYear, walletType]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions(false);
  };

  const formatDate = (dateString) => {
    return formatDateTime(dateString);
  };

  const groupTransactionsByMonth = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
      return [{ title: `${selectedMonth} ${selectedYear}`, data: [], totalIn: 0, totalOut: 0 }];
    }

    const groups = {};
    data.forEach((item) => {
      const date = new Date(item.created_at);
      const m = months[date.getMonth()];
      const y = date.getFullYear();
      const title = `${m} ${y}`;

      if (!groups[title]) {
        groups[title] = { data: [], totalIn: 0, totalOut: 0 };
      }

      const statusStr = item.status?.toLowerCase();
      const isValid = ['success', 'successful', 'completed'].includes(statusStr);
      const amount = Math.abs(parseFloat(item.amount)) || 0;

      if (isValid) {
        if (item.transaction_direction?.toLowerCase() === 'credit') {
          groups[title].totalIn += amount;
        } else {
          groups[title].totalOut += amount;
        }
      }
      groups[title].data.push(item);
    });

    return Object.keys(groups).map(title => ({
      title,
      ...groups[title]
    })).sort((a, b) => {
      const dateA = new Date(a.title.split(' ')[1], months.indexOf(a.title.split(' ')[0]));
      const dateB = new Date(b.title.split(' ')[1], months.indexOf(b.title.split(' ')[0]));
      return dateB - dateA;
    });
  };

  const getStatusColors = (status) => {
    switch (status?.toLowerCase()) {
      case 'successful':
      case 'success':
      case 'completed':
        return { textColor: '#2FB86D', bgColor: 'rgba(47,184,109,0.15)' };
      case 'reversed':
      case 'refunded':
        return { textColor: '#007BFF', bgColor: 'rgba(0,123,255,0.15)' };
      case 'processing':
      case 'pending':
        return { textColor: '#F0AD4E', bgColor: 'rgba(240,173,78,0.15)' };
      case 'failed':
      case 'declined':
        return { textColor: '#D9534F', bgColor: 'rgba(217,83,79,0.15)' };
      default:
        return { textColor: '#F0AD4E', bgColor: 'rgba(240,173,78,0.15)' };
    }
  };

  const renderItem = ({ item }) => {
    return <TransactionCard item={item} loading={showTransactionSkeleton} />;
  };

  const sections = showTransactionSkeleton
    ? [{
        title: `${selectedMonth} ${selectedYear}`,
        data: [1, 2, 3, 4, 5].map((placeholder) => ({
          ps_ref: `transaction_placeholder_${placeholder}`,
        })),
        totalIn: 0,
        totalOut: 0,
      }]
    : groupTransactionsByMonth(transactions);

  return (
    <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={styles.mainScreenContainer}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader 
          title="Transactions" 
          backgroundColor="#eff7f4" 
          textColor="#000" 
          iconColor="#000" 
          rightImages={[
            {
              url: 'https://cdn-icons-png.flaticon.com/128/3914/3914366.png',
              onPress: () => toggleFilterSheet(true)
            }
          ]}
        />

        <View style={styles.bodyWrapper}>

          <AdvertSlider />

          <SectionList
            contentContainerStyle={styles.listScrollingContainer}
            sections={sections}
            renderSectionFooter={({ section }) => (
              !showTransactionSkeleton && section.data.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#999', fontSize: 12 }}>No transactions for this period</Text>
                </View>
              ) : null
            )}
            keyExtractor={(item, index) => `${item.ps_ref || 'transaction'}_${index}`}
            renderItem={renderItem}
            stickySectionHeadersEnabled={true}
            renderSectionHeader={({ section }) => {
              const { title } = section;
              const [month, year] = title.split(' ');

              return (
                <View style={styles.stickyHeaderWrapper}> 
                  <View style={styles.sectionHeaderContainer}>
                    <View style={styles.headerLeftColumn}>
                      <TouchableOpacity onPress={() => toggleDateSheet(true)}>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <Text style={styles.sectionHeaderText}>{title}</Text>
                          <Ionicons name="chevron-down" size={14} color="#0E3C2E" />
                        </View>
                      </TouchableOpacity>
                      <View style={styles.monthlySummaryRow}>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>In: </Text>
                          <Text style={styles.summaryValueIn}>
                            ₦{section.totalIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <View style={[styles.summaryItem, { marginLeft: 12 }]}>
                          <Text style={styles.summaryLabel}>Out: </Text>
                          <Text style={styles.summaryValueOut}>
                            ₦{section.totalOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.analyzeButton}
                      onPress={() => navigation.navigate('AccountStatementScreen')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.analyzeButtonText}>Download</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2FB86D']} />
            }
          />
        </View>
      </SafeAreaView>

      <DatePickerSheet
        visible={showDateSheet}
        onClose={() => toggleDateSheet(false)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onConfirm={(m, y) => { setSelectedMonth(m); setSelectedYear(y); toggleDateSheet(false); }}
        months={months}
        years={years}
      />
      <FilterSheet
        visible={showFilterSheet}
        onClose={() => toggleFilterSheet(false)}
        categories={VALID_CATEGORIES}
        selectedCategory={category}
        onApply={(c) => { setCategory(c); toggleFilterSheet(false); }}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  mainScreenContainer: { flex: 1 },
  safeArea: { flex: 1 },
  bodyWrapper: {
    paddingTop: 10,
    flex: 1,
  },
  listScrollingContainer: { paddingHorizontal: 16, paddingBottom: 40},
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 5,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  sectionHeaderContainer: {
    backgroundColor: '#eff7f4', 
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(14, 60, 46, 0.05)',
  },
  headerLeftColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0E3C2E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthlySummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#666',
  },
  summaryValueIn: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2FB86D',
  },
  summaryValueOut: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D9534F',
  },
  analyzeButton: {
    backgroundColor: '#2FB86D',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  analyzeButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  cardInternalWrapper: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    width: '100%' 
  },
  leftInfoSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1, 
    flexShrink: 1,
    marginRight: 12 
  },
  iconCircleBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  typeIconImage: { width: 16, height: 16 },
  textMetadataContainer: { 
    marginLeft: 10, 
    flex: 1, 
    width: 0 
  },
  transactionMainTitle: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#0E3C2E'
  },
  transactionDateSubtitle: { fontSize: 10, color: '#999', marginTop: 2 },
  rightFinancialSection: { 
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 80,
  },
  transactionAmountText: { fontSize: 12, fontWeight: '800' },
  statusBadgeContainer: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  statusLabelText: { fontSize: 8, fontWeight: '700' },
  faqWrapper: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  faqText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0E3C2E',
  },
  newFeatureWrapper: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  
  filterTrigger: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginHorizontal: 16,
    marginVertical: 5, borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  filterTriggerContent: { flexDirection: 'row', alignItems: 'center' },
  filterTriggerText: { marginLeft: 10, fontSize: 12, fontWeight: '700', color: BRAND_COLOR },

  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000, justifyContent: 'flex-end' },
  sheetContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 25, paddingBottom: 40 },
  dragIndicator: { width: 40, height: 5, backgroundColor: '#DDD', borderRadius: 3, alignSelf: 'center', marginVertical: 15 },
  sheetTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 20, color: BRAND_COLOR },
  sheetSubLabel: { fontSize: 12, fontWeight: '800', color: '#999', marginBottom: 12, marginTop: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  selectionItem: { width: '48%', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F5F8F7', alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  activeSelectionItem: { backgroundColor: BRAND_COLOR, borderColor: BRAND_COLOR },
  activeSelectionItemGreen: { backgroundColor: '#2FB86D', borderColor: '#2FB86D' },
  selectionItemText: { fontSize: 13, fontWeight: '700', color: '#555' },
  activeTabText: { color: '#FFF' },
  activeTabText2: { color: '#FFF' },
  closeSheetBtn: { backgroundColor: BRAND_COLOR, width: '100%', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  closeSheetBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  dateSheetContainer: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 25, paddingBottom: 40, width: '100%' },
  dateSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 10 },
  dateSheetTitle: { fontSize: 16, fontWeight: '800', color: '#0E3C2E' },
  dateOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  dateOptionActive: { backgroundColor: '#f9f9f9' },
  dateOptionText: { fontSize: 16, color: '#333' },
  dateOptionTextActive: { color: '#2FB86D', fontWeight: '600' },
  dateModalFooter: { paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff', marginTop: 10 },
  confirmDateButton: { backgroundColor: '#2FB86D', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirmDateButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stickyHeaderWrapper: { backgroundColor: '#eff7f4' }
});

export default TransactionHistoryScreen;