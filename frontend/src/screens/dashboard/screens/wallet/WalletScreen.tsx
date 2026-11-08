import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  TouchableOpacity,
  Text,
  Dimensions,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import WalletCard from './utilities/WalletCard';
import BankingFooter from '@components/extra/BankingFooter';
import ActivitySection from '../transactions/history/ActivitySection';

const { width } = Dimensions.get('window');
const baseWidth = 410;
const scale = width / baseWidth;

const BRAND_COLOR = '#0E3C2E';
const SECONDARY_GREEN = '#1D644D';
const BORDER_COLOR = "rgba(204, 204, 204, 0.80)";
const WalletScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const handleActivityLoading = useCallback((isLoading) => {
    setRefreshing(isLoading);
  }, []);
  return (
    <>
      <LinearGradient colors={['#f0f9f6', '#fdfdfd']} style={styles.gradientBackground}>
        <View style={styles.wrapper}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

          <ScreenHeader
            title="My Wallet"
            backgroundColor="#f0f9f6"
            textColor="#000"
            iconColor="#000"
            rightComponent={
                          <TouchableOpacity onPress={() => navigation.navigate('Settings', { page: 'reusable', category: 'wallet' })} style={{ padding: 0 }}>
                            <Image 
                              source={{ uri: 'https://cdn-icons-png.flaticon.com/128/16327/16327901.png' }} 
                              style={{ width: 22, height: 22, tintColor: '#0E3C2E' }} 
                            />
                          </TouchableOpacity>
                        }
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => setActivityRefreshKey((currentKey) => currentKey + 1)}
                colors={[BRAND_COLOR]}
              />
            }
          >
            <WalletCard />

            <ActivitySection
              refreshTrigger={activityRefreshKey}
              onLoadingChange={handleActivityLoading}
              marginHorizontal={16}
            />
              <View 
                                      style={{ 
                                        height: 1, 
                                        width: '100%', 
                                        marginBottom: 10 
                                      }} 
                                    />
                                    <View 
                                      style={{  paddingHorizontal: 16,
                                      }} 
                                    >
                                      <BankingFooter />
                                      </View>
            
          </ScrollView>
        </View>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Section header
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
    paddingHorizontal: 5 * scale,
  },
  title: {
    fontWeight: 'bold',
    color: '#222',
    fontSize: 13,
  },
  seeAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAll: {
    color: BRAND_COLOR,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    lineHeight: 11,
  },
  seeAllIcon: {
    width: 8,
    height: 8,
    marginLeft: 3,
    tintColor: BRAND_COLOR,
  },

  // Transaction card
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 0.1,
    borderColor: BORDER_COLOR,
    shadowColor: BORDER_COLOR,
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
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

  // Loading / Empty
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
});

export default WalletScreen;