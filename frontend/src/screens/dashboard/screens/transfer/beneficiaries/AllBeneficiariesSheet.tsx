import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Platform,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '@components/common/SearchBar';

const { width } = Dimensions.get('window');
const scale = width / 410;
const BRAND_DARK = '#0E3C2E';
const BORDER_COLOR = '#E2E8F0';
const TEXT_MUTED = '#64748B';

const getDisplayName = (item) => item?.accountName || item?.name || 'Beneficiary';
const getDisplayBankName = (item) => item?.bankName || 'Bank';
const getDisplayAccountNumber = (item) => item?.accountNumber || '';

const AllBeneficiariesSheet = ({ visible, onClose, beneficiaries = [], onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    setSearchQuery('');
    const timer = setTimeout(() => inputRef.current?.focus(), 180);
    return () => clearTimeout(timer);
  }, [visible]);

  const filteredList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return beneficiaries;

    return beneficiaries.filter((item) => {
      const name = getDisplayName(item).toLowerCase();
      const account = getDisplayAccountNumber(item).toLowerCase();
      const bank = getDisplayBankName(item).toLowerCase();
      return name.includes(query) || account.includes(query) || bank.includes(query);
    });
  }, [beneficiaries, searchQuery]);

  const handleSelect = (item) => {
    onSelect?.(item);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#e8f0ec', '#f5faf8']} style={styles.gradientBackground}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
              <Ionicons name="close" size={18} color={BRAND_DARK} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>All beneficiaries</Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={styles.content}>
            <View style={styles.heroSection}>
              <Text style={styles.heroSubtitle}>Beneficiaries</Text>
              <Text style={styles.heroTitle}>Recent Bank Beneficiaries</Text>
              <Text style={styles.heroDesc}>View and select from your saved recipients</Text>
            </View>

            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              placeholder="Search bank or account"
              inputContainerStyle={styles.searchBarContainer}
            />

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredList.map((item, index) => {
                const accountNumber = getDisplayAccountNumber(item);
                return (
                  <TouchableOpacity
                    key={accountNumber || `beneficiary-${index}`}
                    style={styles.listCard}
                    activeOpacity={0.8}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: '#e8f5e9' }] }>
                      <Ionicons name="person" size={20 * scale} color="#2e7d32" />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardMainText}>{getDisplayName(item)}</Text>
                      <Text style={styles.cardSubText}>
                        {`${getDisplayBankName(item)} • ${accountNumber}`}
                      </Text>
                    </View>
                    <View style={styles.cardAction}>
                      <Ionicons name="chevron-forward" size={15} color="#999" />
                    </View>
                  </TouchableOpacity>
                );
              })}

              {filteredList.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery ? `No results found for "${searchQuery}"` : 'No beneficiaries available yet'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_DARK,
  },
  content: {
    flex: 1,
    paddingTop: 15,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 5,
  },
  heroSection: {
    marginBottom: 15,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND_DARK,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_DARK,
    lineHeight: 24,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 17,
  },
  searchBarContainer: {
    marginBottom: 10,
    borderRadius: 12,
    borderColor: BORDER_COLOR,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  iconCircle: {
    width: 40 * scale,
    height: 40 * scale,
    borderRadius: 20 * scale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardMainText: { fontSize: 13 * scale, fontWeight: '700', color: '#333' },
  cardSubText: { fontSize: 10 * scale, color: '#888', marginTop: 2 },
  cardAction: { justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
});

export default AllBeneficiariesSheet;