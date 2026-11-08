import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  Share,
  TouchableOpacity,
  Text,
  RefreshControl,
  Image,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getSessionToken, useAuthState } from '@hooks/useAuth';
import { formatDate as sharedFormatDate, formatTime as sharedFormatTime, formatDateTime as sharedFormatDateTime } from '@lib/utils/format';
import ScreenHeader from '@components/headers/ScreenHeader';
import ReferralCodeCard from './utilities/ReferralCodeCard';
import ReferralDetailList from './ReferralDetailList';
import LoadingScreen from '@components/Loading/LoadingScreen';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';
import UnifiedServiceSection from '@components/extra/UnifiedServiceSection';
import { useTheme } from '@providers/ThemeProvider';
import config from '@config/app';
import { brandConfig } from '@config/brand';
import { apiConfig } from '@config/api';
import { useFocusEffect } from '@react-navigation/native';

const api = apiConfig.baseUrl;

const { width } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RefererScreen = ({ navigation }) => {
  const { isDark, colors } = useTheme();
  const { isAuthLoading } = useAuthState();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    referralCode: '',
    referralLink: '',
    history: [],
    transactions: [],
    estimatedPendingRewards: [],
    campaigns: [],
    leaderboard: [],
    rewardConfig: {},
    statistics: {},
  });
  const [referralSheet, setReferralSheet] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    referrals: false,
    transactions: false,
    leaderboard: false,
  });

  // Fetches all referral and campaign data from the backend.
  const fetchData = async () => {
    setLoading(true);
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        Alert.sheet('Authentication error', 'Please log in again.');
        return;
      }

      const baseFormData = new FormData();
      baseFormData.append(config.sessionToken, sessionToken);

      // Create separate form data for each action
      const referralDataForm = new FormData();
      referralDataForm.append(config.sessionToken, sessionToken);
      referralDataForm.append('action', 'getReferralData');

      const campaignsForm = new FormData();
      campaignsForm.append(config.sessionToken, sessionToken);
      campaignsForm.append('action', 'listCampaigns');

      const leaderboardForm = new FormData();
      leaderboardForm.append(config.sessionToken, sessionToken);
      leaderboardForm.append('action', 'getLeaderboard');
      leaderboardForm.append('limit', 20);

      // Fetch all data in parallel
      const [referralRes, campaignsRes, leaderboardRes] = await Promise.all([
        fetch(`${api}/v1/referrals/getReferralData.php`, { method: 'POST', body: referralDataForm }),
        fetch(`${api}/v1/referrals/getReferralData.php`, { method: 'POST', body: campaignsForm }),
        fetch(`${api}/v1/referrals/getReferralData.php`, { method: 'POST', body: leaderboardForm }),
      ]);

      const referralJson = await referralRes.json();
      const campaignsJson = await campaignsRes.json();
      const leaderboardJson = await leaderboardRes.json();

      if (referralJson.success) {
        const payload = referralJson.data || {};
        setData(prev => ({
          ...prev,
          ...payload,
          history: payload.history || [],
          transactions: payload.transactions || payload.referralTransactions || [],
        }));
      }

      setData(prev => ({ ...prev, campaigns: campaignsJson.data?.campaigns || [] }));
      setData(prev => ({ ...prev, leaderboard: leaderboardJson.data?.leaderboard || [] }));

    } catch (error) {
      console.error('Fetch error:', error);
      Alert.sheet('Error', 'Something went wrong while loading referral data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refetch data when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthLoading) {
        fetchData();
      }
    }, [isAuthLoading])
  );
  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const toggleSection = (section) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    setExpandedSections(prev => {
      const isCurrentlyOpen = prev[section];

      // If we are clicking an already open section, just close it.
      // Otherwise, close all sections and open the clicked one.
      return {
        referrals: false,
        transactions: false,
        leaderboard: false,
        [section]: !isCurrentlyOpen,
      };
    });
  };

  const getReferralLink = () => {
    if (data.referralLink) return data.referralLink;
    if (data.referralCode) {
      return `${config.website.replace(/\/$/, '')}/r/${data.referralCode}`;
    }
    return config.website;
  };

  const handleShare = async () => {
    const link = getReferralLink();
    const message = `Join me on ${brandConfig.brandName} using my referral link:\n${link}\n\nUse code ${data.referralCode} to get started with rewards.`;

    try {
      await Share.share({ message, title: `Join ${brandConfig.brandName}` });
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  };

  const formatDate = (dateString) => {
    return sharedFormatDateTime(dateString);
  };

  const formatDate1 = (dateString) => {
    if (!dateString) return '';
    return sharedFormatDate(dateString);
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

  const formatAmount = (value) => {
    const amount = parseFloat(value);
    if (Number.isNaN(amount)) return '₦0.00';
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const handleReferralPress = (item) => {
    const title = item.firstName || item.fullName || item.profileName || 'Referral details';
    const message = item.summary || item.description || item.status || 'Tap again later for an update.';
    Alert.sheet(title, message);
  };

  const handlePendingRewardPress = (item) => {
    setReferralSheet({ type: 'notifications', listData: data.estimatedPendingRewards || [], selectedItem: item });
  };

  const getTransactionReference = (tx) => {
    return tx.transaction_reference || tx.reference || tx.ps_ref || tx.transaction_id || tx.ref || null;
  };

  const handleTransactionPress = (tx) => {
    const reference = getTransactionReference(tx);
    if (reference) {
      navigation.navigate('TransactionDetailsScreen', { transactionReference: reference });
    } else {
      Alert.sheet('Transaction details', 'Unable to open this transaction at the moment.');
    }
  };

  const handleCampaignPress = (campaign) => {
    navigation.navigate('ReferralDetailList', { type: 'campaigns', listData: data.campaigns, selectedItem: campaign });
  };

  const campaignItems = (data.campaigns || []).map((campaign, index) => {
    const status = campaign.registrationStatus || campaign.registration?.status || 'none';
    const isJoined = status === 'joined' || status === 'active';

    return {
      id: campaign.id || campaign.campaignCode || `${campaign.name || 'campaign'}-${index}`,
      key: campaign.id || campaign.campaignCode || `${campaign.name || 'campaign'}-${index}`,
      title: campaign.name || campaign.campaignCode || 'Campaign',
      subtitle: campaign.description || 'Tap to view campaign details.',
      actionLabel: isJoined ? 'View' : 'Join',
      status: isJoined ? 'view' : 'join',
      onPress: () => handleCampaignPress(campaign),
      imageUrl: campaign.imageUrl || campaign.iconUrl,
      icon: 'megaphone-outline',
      isJoined,
      campaign,
    };
  });

  const renderReferralCard = (item, index) => {
    const isComplete = item.status?.toLowerCase() === 'completed';
    return (
      <TouchableOpacity
        key={`history-${index}`}
        style={[styles.serviceRow, { marginBottom: 10, backgroundColor: colors.card }]}
        activeOpacity={0.8}
        onPress={() => handleReferralPress(item)}
      >
        <View style={[styles.serviceIconContainer, { backgroundColor: isDark ? colors.surface : colors.accentSoft }]}>
          <Ionicons name="person-outline" size={18} color={colors.textPrimary} />
        </View>
        <View style={styles.serviceTextContainer}>
          <Text style={[styles.serviceTitle, { color: colors.textPrimary }]}>{item.firstName || item.fullName || 'Referred user'}</Text>
          <Text style={[styles.serviceSubtitle, { color: colors.textSecondary }]}>{item.joined ? `Joined on ${formatDate1(item.joined)}` : 'Tap for details'}</Text>
        </View>
        <View style={[styles.serviceStatusPill, { backgroundColor: isComplete ? colors.success + '20' : colors.warning + '20' }]}> 
            <Text style={[styles.serviceStatusText, { color: isComplete ? colors.success : colors.warning }]}>
              {item.status || item.registrationStatus || 'Pending'}
            </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#4A4A4A' : '#D1D5DB'} />
      </TouchableOpacity>
    );
  };

  const renderTransactionCard = (tx, index) => {
    const status = tx.status || 'Success';
    const { textColor, bgColor } = getStatusColors(status);
    const displayTitle = tx.service_name || tx.description || 'Referral Bonus';
    const amountStr = parseFloat(tx.amount) || 0;

    return (
      <TouchableOpacity
        key={`tx-${index}`}
        style={[styles.serviceRow, { marginBottom: 10, backgroundColor: colors.card }]}
        activeOpacity={0.8}
        onPress={() => handleTransactionPress(tx)}
      >
        <View style={[styles.serviceIconContainer, { backgroundColor: isDark ? colors.surface : colors.accentSoft }]}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/128/15859/15859094.png' }} 
            style={[styles.serviceImage, { tintColor: isDark ? colors.textPrimary : colors.success }]} 
            resizeMode="contain" 
          />
        </View>
        <View style={styles.serviceTextContainer}>
          <Text style={[styles.serviceTitle, { color: colors.textPrimary }]} numberOfLines={1}>{displayTitle}</Text>
          <Text style={[styles.serviceSubtitle, { color: colors.textSecondary }]}>{formatDate(tx.date || tx.created_at)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.serviceAmountText, { color: '#2FB86D' }]} numberOfLines={1}>+{formatAmount(amountStr)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCampaignCard = (campaign, index) => {
    const status = campaign.registrationStatus || campaign.registration?.status || 'none';
    const isJoined = status === 'joined' || status === 'active';
    return (
      <TouchableOpacity
        key={`campaign-${index}`}
        style={[styles.campaignCard, { backgroundColor: isDark ? colors.surface : colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => handleCampaignPress(campaign)}
      >
        <View style={styles.campaignTopRow}>
          <Text style={[styles.campaignName, { color: colors.textPrimary }]} numberOfLines={1}>{campaign.name || campaign.campaignCode}</Text>
          <View style={[styles.campaignStatusPill, !isJoined ? { backgroundColor: colors.warning + '20' } : { backgroundColor: colors.success + '20' }]}>
            <Text style={[styles.campaignStatusText, !isJoined ? { color: colors.warning } : { color: colors.success }]}>{isJoined ? status : 'Join'}</Text>
          </View>
        </View>
        <Text style={[styles.campaignDescription, { color: colors.textSecondary }]} numberOfLines={2}>{campaign.description || 'Tap to view campaign details.'}</Text>
        <View style={styles.campaignMetaRow}>
          <Text style={[styles.campaignMetaLabel, { color: colors.textSecondary }]}>{campaign.timeRemaining || campaign.availableSlots ? `${campaign.timeRemaining || ''}${campaign.timeRemaining && campaign.availableSlots ? ' · ' : ''}${campaign.availableSlots ? `${campaign.availableSlots} slots` : ''}` : 'No deadline specified'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLeaderboardItem = (item, index) => (
    <View key={`leaderboard-${index}`} style={[styles.serviceRow, { marginBottom: 10, backgroundColor: colors.card }]}>
      <View style={[styles.serviceIconContainer, { backgroundColor: isDark ? colors.surface : colors.accentSoft }]}>
        <Text style={[styles.serviceTitle, { fontSize: 14, color: colors.textPrimary }]}>{item.rank}</Text>
      </View>
      <View style={styles.serviceTextContainer}>
        <Text style={[styles.serviceTitle, { color: colors.textPrimary }]}>{item.name}</Text>
        <Text style={[styles.serviceSubtitle, { color: colors.textSecondary }]}>Top Referrer</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.serviceStatusText, { color: '#2e7d32', fontWeight: '700' }]}>
            {item.qualifiedReferrals}
          </Text>
          <Text style={[styles.serviceStatusText, { color: '#2e7d32', marginLeft: 4, fontWeight: '500', fontSize: 9 }]}>invited</Text>
      </View>
    </View>
  );

  return (
    <>
      <LoadingScreen visible={loading || isAuthLoading} message="Please Wait" />

      <View style={styles.container}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
        <LinearGradient colors={isDark ? ['#121212', '#121212'] : ['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

        <ScreenHeader
          title='Invite & Earn'
          backgroundColor={isDark ? '#121212' : '#eff7f4'}
          textColor={isDark ? '#E4E4E4' : '#000'}
          iconColor={isDark ? '#E4E4E4' : '#000'}
          rightComponent={
            <TouchableOpacity onPress={() => navigation.navigate('ReferralDetailList', { type: 'notifications', listData: data.estimatedPendingRewards || [], onCampaignActionComplete: fetchData })} style={styles.headerIconButton} activeOpacity={0.7}>
              <Ionicons name='notifications-outline' size={22} color={isDark ? '#E4E4E4' : '#0E3C2E'} />
            </TouchableOpacity>
          }
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          bounces={true}
          overScrollMode='never'
          decelerationRate='normal'
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === 'android'}
        >
          <View style={styles.heroSection}>
            <LinearGradient
              colors={['#257a5d', '#0E3C2E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroContent}>
                <View style={styles.heroTextContainer}>
                  <Text style={styles.heroBadge}>UNLIMITED REWARDS</Text>
                  <Text style={styles.heroTitle}>Invite Friends &{"\n"}Earn <Text style={{ color: '#2FB86D' }}>#50,000.00</Text></Text>
                  <Text style={styles.heroSubtitle}>Get instant rewards when your friends join and transact on {brandConfig.brandName}.</Text>
                </View>
                <View style={styles.floatingContainer}>
                  <View style={styles.floatingIcon}>
                    <Ionicons name='people' size={80 * scale} color='rgba(255,255,255,0.1)' />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          <ReferralCodeCard code={data.referralCode} link={data.referralLink} onShare={handleShare} />

          {data.estimatedPendingRewards?.length > 0 && (
            <View style={styles.pendingSection}>
              <View style={styles.topRow}>
                <Text style={[styles.title, isDark && { color: '#E4E4E4' }]}>Pending Rewards</Text>
                <Text style={[styles.pendingBadge, isDark && { color: '#B0B0B0' }]}>Notification</Text>
              </View>
              {data.estimatedPendingRewards.map((item, index) => (
                <TouchableOpacity
                  key={`pending-${index}`}
                  style={[styles.notificationCard, { backgroundColor: isDark ? colors.surface : colors.card, borderColor: colors.border }]}
                  activeOpacity={0.8}
                  onPress={() => handlePendingRewardPress(item)}
                >
                  <View style={styles.notificationLeft}>
                    <Ionicons name='notifications' size={22} color='#0E3C2E' />
                    <View style={styles.notificationText}>
                      <Text style={[styles.notificationTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.firstName ? `${item.firstName} is pending` : 'Pending reward'}</Text>
                      <Text style={[styles.notificationSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>{item.summary}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <UnifiedServiceSection
            title="Campaigns"
            items={campaignItems}
            onItemPress={(item) => handleCampaignPress(item.campaign)}
            rowMode="button"
            showAction={true}
            showEmptyState={true}
            emptyStateTitle="No campaigns available"
            emptyStateSubtitle="Check back later for new campaigns."
            isLoading={loading}
            marginVertical={10}
          />

          <FeatureCardGrid
            items={[
              {
                id: 'referrals',
                icon: 'people-outline',
                title: 'My Referrals',
                desc: `${(data.history || []).length} referred`,
                onPress: () => navigation.navigate('ReferralDetailList', { type: 'friends', listData: data.history, onCampaignActionComplete: fetchData }),
              },
              {
                id: 'transactions',
                icon: 'cash-outline',
                title: 'Transactions',
                desc: `${(data.transactions || []).length} bonuses`,
                onPress: () => navigation.navigate('TransactionHistoryScreen', { category: 'Referral Bonus' }),
              },
              {
                id: 'leaderboard',
                icon: 'trophy-outline',
                title: 'Leaderboard',
                desc: `${(data.leaderboard || []).length} top referrers`,
                onPress: () => navigation.navigate('ReferralDetailList', { type: 'leaderboard', listData: data.leaderboard }),
              },
            ]}
            isLoading={loading}
            onPress={() => {}}
          />
        </ScrollView>

      </View>
    </>
  );
};

export default RefererScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 170,
    paddingHorizontal: 16,
  },
  heroSection: {
    width: '100%',
    height: 180 * scale,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20 * scale,
  },
  heroGradient: { flex: 1, padding: 20 * scale },
  heroContent: { flex: 1, flexDirection: 'row', position: 'relative' },
  heroTextContainer: { flex: 0.7, justifyContent: 'center', zIndex: 2 },
  heroBadge: {
    backgroundColor: 'rgba(47, 184, 109, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    color: '#2FB86D',
    fontSize: 10 * scale,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroTitle: { fontSize: 22 * scale, fontWeight: '900', color: '#FFF', lineHeight: 28 * scale },
  heroSubtitle: { fontSize: 12 * scale, color: 'rgba(255,255,255,0.7)', marginTop: 8, fontWeight: '500' },
  floatingContainer: { flex: 0.3 },
  floatingIcon: { position: 'absolute', right: -10, bottom: -10 },
  
  /* FAQ Button Styles (used by ScreenHeader) */
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

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16 * scale, fontWeight: '800', color: '#1a1a1a' },
  sectionCount: { 
    backgroundColor: '#c2f3c6', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 10,
    marginLeft: 5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sectionCountText: {
    fontSize: 12 * scale, 
    fontWeight: '700', 
    color: BRAND_COLOR,
  },
  viewAllText: {
    fontSize: 13 * scale,
    fontWeight: '700',
    color: BRAND_COLOR,
    paddingLeft: 10,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  iconCircle: { width: 40 * scale, height: 40 * scale, borderRadius: 20 * scale, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardMainText: { fontSize: 14 * scale, fontWeight: '700', color: '#333' },
  cardSubText: { fontSize: 11 * scale, color: '#888', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10 * scale, fontWeight: '800' },
  statusSuccess: { backgroundColor: '#e8f5e9' },
  statusPending: { backgroundColor: '#fff3e0' },
  transactionItem: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  txRow: { flexDirection: 'row', alignItems: 'center' },
  txIconBox: { width: 44 * scale, height: 44 * scale, borderRadius: 12, backgroundColor: '#f5f8f7', justifyContent: 'center', alignItems: 'center' },
  txMainInfo: { flex: 1, marginLeft: 12 },
  txNarration: { fontSize: 14 * scale, fontWeight: '700', color: '#1a1a1a' },
  txDateText: { fontSize: 11 * scale, color: '#888', marginTop: 4 },
  txAmountBox: { alignItems: 'flex-end' },
  txAmountText: { fontSize: 15 * scale, fontWeight: '900', color: '#2FB86D' },
  txStatusText: { fontSize: 10 * scale, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginTop: 4 },
  emptyContainer: { padding: 30, alignItems: 'center' },
  emptyText: { color: '#aaa', fontSize: 13 * scale },

  /* Exact transaction card design copied from TransactionHistoryScreen */
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

  /* Exact section header design copied from QuickAccess component */
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8 * scale,
    marginBottom: 8 * scale,
    paddingHorizontal: 5 * scale,
  },
  seeAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAll: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    lineHeight: 11,
  },
  seeAllIcon: {
    width: 8,
    height: 8,
    marginLeft: 3,
    tintColor: '#007AFF',
  },
  headerIconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
  },
  tabWrapper: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  pendingSection: {
    marginBottom: 20,
  },
  pendingBadge: {
    fontSize: 11 * scale,
    fontWeight: '700',
    color: '#6B7280',
  },
  notificationCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 13 * scale,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  notificationSubtitle: {
    fontSize: 11 * scale,
    color: '#6B7280',
    lineHeight: 16,
  },
  campaignsHeader: {
    marginBottom: 12,
  },
  campaignSubtitle: {
    fontSize: 12 * scale,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
  },
  campaignCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  campaignTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  campaignName: {
    fontSize: 14 * scale,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  campaignStatusPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  campaignStatusText: {
    fontSize: 10 * scale,
    fontWeight: '700',
  },
  campaignDescription: {
    fontSize: 12 * scale,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 18,
  },
  campaignMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignMetaLabel: {
    fontSize: 11 * scale,
    color: '#6B7280',
  },

  sectionCard: {
    borderRadius: 16,
    padding: 12,
  },

  // Styles from ExtraServices adapted for this screen
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  serviceIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceImage: {
    width: '50%',
    height: '50%',
  },
  serviceTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  serviceTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  serviceSubtitle: {
    fontSize: 10,
    marginTop: 1,
  },
  serviceStatusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8 },
  serviceStatusText: { fontSize: 10, fontWeight: '700' },
  serviceAmountText: { fontSize: 13, fontWeight: '700' },
});