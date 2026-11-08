import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
  Modal,
} from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getSessionToken } from '@hooks/useAuth';
import { formatDate as sharedFormatDate, formatDateTime as sharedFormatDateTime } from '@lib/utils/format';
import config from '@config/app';
import { apiConfig } from '@config/api';
import SearchBar from '@components/common/SearchBar';
import { useTheme } from '@providers/ThemeProvider';

const { width } = Dimensions.get('window');
const scale = width / 410;
const BRAND_DARK = "#0E3C2E";
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";

const ReferralDetailList = ({ route, navigation, visible = false, onClose, type: propType, listData: propListData, onCampaignActionComplete }) => {
  const { isDark } = useTheme();
  const resolvedType = propType ?? route?.params?.type;
  const resolvedListData = propListData ?? route?.params?.listData ?? [];
  const resolvedSelectedItem = route?.params?.selectedItem;
  const [searchQuery, setSearchQuery] = useState('');
  const [localListData, setLocalListData] = useState(Array.isArray(resolvedListData) ? resolvedListData : []);
  const [selectedItem, setSelectedItem] = useState(resolvedSelectedItem ?? null);
  const [actionLoading, setActionLoading] = useState(false);

  const isFriends = resolvedType === 'friends';
  const isNotifications = resolvedType === 'notifications';
  const isCampaigns = resolvedType === 'campaigns';
  const isLeaderboard = resolvedType === 'leaderboard';

  useEffect(() => {
    setLocalListData(Array.isArray(resolvedListData) ? resolvedListData : []);
    if (resolvedSelectedItem) {
      setSelectedItem(resolvedSelectedItem);
    }
    setSearchQuery('');
  }, [resolvedListData, visible]);

  const filteredList = useMemo(() => {
    const items = Array.isArray(localListData) ? localListData : [];
    return items.filter((item) => {
      const searchText = (() => {
        if (isFriends) return `${item.firstName || ''} ${item.fullName || ''} ${item.profileName || ''}`;
        if (isNotifications) return `${item.firstName || ''} ${item.summary || ''} ${item.description || ''}`;
        if (isCampaigns) return `${item.name || ''} ${item.description || ''} ${item.campaignCode || ''}`;
        if (isLeaderboard) return `${item.name || ''}`;
        return '';
      })().toLowerCase();

      return searchText.includes(searchQuery.toLowerCase());
    });
  }, [searchQuery, localListData, isFriends, isNotifications, isCampaigns, isLeaderboard]);

  const heroContent = {
    subtitle: isFriends ? "Referral List" : isCampaigns ? "Campaigns" : isNotifications ? "Notifications" : "Leaderboard",
    title: isFriends ? "Referred Friends" : isCampaigns ? "Available Campaigns" : isNotifications ? "Pending Updates" : "Top Referrers",
    desc: isFriends
      ? "View all your successfully invited friends"
      : isCampaigns
        ? "Review campaigns, view details, and join or leave from here"
        : isNotifications
          ? "Review pending rewards and referral updates"
          : "See who is leading the charge in our referral program."
  };

  const formatDate = (dateString) => {
    return sharedFormatDateTime(dateString);
  };

  const formatDate1 = (dateString) => {
    if (!dateString) return '';
    return sharedFormatDate(dateString);
  };

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
      return;
    }
    navigation?.goBack?.();
  };

  const handleNotificationPress = (item) => {
    Alert.sheet(item.firstName || 'Notification', item.summary || 'No additional details');
  };

  const updateCampaignInList = (campaignCode, patch) => {
    setLocalListData((prev) => prev.map((item) => {
      const itemCode = item.campaignCode || item.code;
      if (itemCode !== campaignCode) return item;
      return { ...item, ...patch };
    }));
  };

  const handleCampaignAction = async (campaign, action) => {
    try {
      setActionLoading(true);
      const token = await getSessionToken();
      if (!token) {
        Alert.sheet('Authentication', 'Please log in to continue');
        return;
      }

      const formData = new FormData();
      formData.append(config.sessionToken, token);
      formData.append('action', action === 'leave' ? 'leaveCampaign' : 'joinCampaign');
      formData.append('campaignCode', campaign.campaignCode || campaign.code || '');
      if (action === 'join') {
        formData.append('profileCode', campaign.registration?.profileCode || '');
        formData.append('source', 'mobile');
      }

      const res = await fetch(`${apiConfig.baseUrl}/v1/referrals/getReferralData.php`, { method: 'POST', body: formData });
      const responseText = await res.text();
      let json = {};

      try {
        json = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.warn('Campaign response parse error', parseError);
      }

      const success = json.success === true || json.status === 'success';

      if (!success) {
        Alert.sheet('Campaign', json.message || `Unable to ${action === 'leave' ? 'leave' : 'join'} campaign`);
        return;
      }

      if (action === 'leave') {
        const updatedCampaign = {
          ...campaign,
          registrationStatus: 'left',
          registration: {
            ...(campaign.registration || {}),
            status: 'left',
            promoCode: null,
            joinedAt: null,
          },
        };
        updateCampaignInList(campaign.campaignCode || campaign.code, updatedCampaign);
        setSelectedItem(updatedCampaign);
      } else {
        const updatedCampaign = {
          ...campaign,
          registrationStatus: 'joined',
          registration: {
            ...(campaign.registration || {}),
            status: 'joined',
            promoCode: json.data?.promoCode || campaign.registration?.promoCode || null,
            profileCode: json.data?.profileCode || campaign.registration?.profileCode || null,
            joinedAt: new Date().toISOString(),
          },
        };
        updateCampaignInList(campaign.campaignCode || campaign.code, updatedCampaign);
        setSelectedItem(updatedCampaign);
      }

      if (typeof onCampaignActionComplete === 'function') {
        onCampaignActionComplete();
      }

      Alert.sheet('Campaign', json.message || (action === 'leave' ? 'Left campaign successfully' : 'Joined campaign successfully'));
    } catch (err) {
      console.error('Campaign action error', err);
      Alert.sheet('Error', 'Unable to complete campaign action at the moment');
    } finally {
      setActionLoading(false);
    }
  };

  const shouldRender = visible || Boolean(route?.params?.type);

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal
      visible={visible || Boolean(route?.params?.type)}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <LinearGradient colors={isDark ? ['#121212', '#121212'] : ['#e8f0ec', '#f5faf8']} style={styles.gradientBackground}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={[styles.backBtn, isDark && { backgroundColor: '#1E1E1E', borderColor: '#242424' }]}>
              <Ionicons name="close" size={18} color={isDark ? '#E4E4E4' : BRAND_DARK} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}></Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 15, paddingBottom: 10 }}>
            <View style={styles.heroSection}>
              <Text style={[styles.heroSubtitle, isDark && { color: '#B0B0B0' }]}>{heroContent.subtitle}</Text>
              <Text style={[styles.heroTitle, isDark && { color: '#E4E4E4' }]}>{heroContent.title}</Text>
              <Text style={[styles.heroDesc, isDark && { color: '#B0B0B0' }]}>{heroContent.desc}</Text>
            </View>

            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              placeholder={isFriends ? 'Search friends' : isCampaigns ? 'Search campaigns' : isNotifications ? 'Search notifications' : 'Search referrers'}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredList.map((item, index) => (
              !selectedItem && isFriends ? (
                <View key={`friend-${index}`} style={[styles.listCard, isDark && { backgroundColor: '#1E1E1E', borderColor: '#242424' }]}>
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? '#242424' : '#e8f5e9' }]}>
                    <Ionicons name="person" size={20 * scale} color={isDark ? '#E4E4E4' : '#2e7d32'} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardMainText, isDark && { color: '#E4E4E4' }]}>{item.firstName}</Text>
                    <Text style={[styles.cardSubText, isDark && { color: '#B0B0B0' }]}>Joined on {formatDate1(item.joined)}</Text>
                  </View>
                  <View style={styles.cardAction}>
                    <View style={[styles.statusBadge, item.status === 'Completed' ? styles.statusSuccess : styles.statusPending]}>
                      <Text style={[styles.statusBadgeText, item.status === 'Completed' ? { color: '#2e7d32' } : { color: '#ef6c00' }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : !selectedItem && isNotifications ? (
                <TouchableOpacity key={`note-${index}`} style={[styles.notificationCard, isDark && { backgroundColor: '#1E1E1E', borderColor: '#242424' }]} activeOpacity={0.8} onPress={() => handleNotificationPress(item)}>
                  <View style={styles.notificationLeft}>
                    <Ionicons name="notifications" size={22} color={isDark ? '#E4E4E4' : '#0E3C2E'} style={styles.notificationIconWrapper} />
                    <View style={styles.notificationText}>
                      <Text style={[styles.notificationTitle, isDark && { color: '#E4E4E4' }]} numberOfLines={1}>{item.firstName ? `${item.firstName} is pending` : 'Pending reward'}</Text>
                      <Text style={[styles.notificationSubtitle, isDark && { color: '#B0B0B0' }]} numberOfLines={2}>{item.summary}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : !selectedItem && isCampaigns ? (
                <TouchableOpacity key={`camp-${index}`} style={[styles.campaignCard, isDark && { backgroundColor: '#1E1E1E', borderColor: '#242424' }]} activeOpacity={0.9} onPress={() => setSelectedItem(item)}>
                  <View style={styles.campaignTopRow}>
                    <Text style={[styles.campaignName, isDark && { color: '#E4E4E4' }]} numberOfLines={1}>{item.name || item.campaignCode}</Text>
                    <View style={[styles.campaignStatusPill, item.registrationStatus === 'none' ? { backgroundColor: '#FFF3E0' } : { backgroundColor: 'rgba(47,184,109,0.15)' }]}>
                      <Text style={[styles.campaignStatusText, item.registrationStatus === 'none' ? { color: '#F0AD4E' } : { color: '#2FB86D' }]}>{item.registrationStatus === 'none' ? 'Join' : item.registrationStatus}</Text>
                    </View>
                  </View>
                  <Text style={[styles.campaignDescription, isDark && { color: '#B0B0B0' }]} numberOfLines={2}>{item.description}</Text>
                  <View style={styles.campaignMetaRow}>
                    <Text style={[styles.campaignMetaLabel, isDark && { color: '#B0B0B0' }]}>{item.timeRemaining || (item.availableSlots ? `${item.availableSlots} slots` : 'No deadline specified')}</Text>
                    <Text style={[styles.campaignMetaLabel, { color: BRAND_DARK, fontWeight: '700' }]}>Tap for details</Text>
                  </View>
                </TouchableOpacity>
              ) : !selectedItem && isLeaderboard ? (
                <TouchableOpacity key={`leaderboard-${index}`} style={[styles.listCard, isDark && { backgroundColor: '#1E1E1E', borderColor: '#242424' }]}>
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? '#242424' : '#e8f5e9' }]}>
                    <Text style={[styles.cardMainText, { fontSize: 16, color: isDark ? '#E4E4E4' : BRAND_DARK }]}>{item.rank}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardMainText, isDark && { color: '#E4E4E4' }]}>{item.name}</Text>
                  </View>
                  <View style={styles.cardAction}>
                    <View style={[styles.statusBadge, styles.statusSuccess]}>
                      <Text style={[styles.statusBadgeText, { color: '#2e7d32' }]}>
                        {item.qualifiedReferrals}
                      </Text>
                      <Text style={[styles.statusBadgeText, { color: '#2e7d32', marginLeft: 4, fontWeight: '500' }]}>invited</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : null
            ))}

            {isCampaigns && selectedItem && (
              <View style={[styles.detailCard, isDark && { backgroundColor: '#1E1E1E', borderColor: '#242424' }]}>
                <View style={styles.detailHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailTitle, isDark && { color: '#E4E4E4' }]}>{selectedItem.name || selectedItem.campaignCode || 'Campaign details'}</Text>
                    <Text style={[styles.detailSubtitle, isDark && { color: '#B0B0B0' }]}>{selectedItem.description || 'No description available.'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.detailCloseBtn}>
                    <Ionicons name="close" size={16} color={isDark ? '#E4E4E4' : BRAND_DARK} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.detailMeta, isDark && { color: '#B0B0B0' }]}>Code: {selectedItem.campaignCode || selectedItem.code || 'N/A'}</Text>
                <Text style={[styles.detailMeta, isDark && { color: '#B0B0B0' }]}>Reward: {selectedItem.rewardAmount || selectedItem.reward_amount || 'N/A'}</Text>
                <Text style={[styles.detailMeta, isDark && { color: '#B0B0B0' }]}>Status: {selectedItem.registrationStatus === 'none' ? 'Not joined' : selectedItem.registrationStatus || 'Joined'}</Text>
                <Text style={[styles.detailMeta, isDark && { color: '#B0B0B0' }]}>Slots: {selectedItem.availableSlots ?? selectedItem.slotLimit ?? 'N/A'}</Text>
                {selectedItem.registration?.promoCode && (
                  <Text style={[styles.detailMeta, isDark && { color: '#B0B0B0' }]}>Your Code: {selectedItem.registration.promoCode}</Text>
                )}
                {selectedItem.registration?.joinedAt && (
                  <Text style={[styles.detailMeta, isDark && { color: '#B0B0B0' }]}>Joined: {formatDate(selectedItem.registration.joinedAt)}</Text>
                )}
                <View style={styles.detailActions}>
                  {selectedItem.registrationStatus === 'none' || selectedItem.registrationStatus === 'left' ? (
                    <TouchableOpacity onPress={() => handleCampaignAction(selectedItem, 'join')} style={[styles.primaryButton, { opacity: actionLoading ? 0.7 : 1 }]} disabled={actionLoading}>
                      <Text style={styles.primaryButtonText}>{actionLoading ? 'Joining...' : 'Join campaign'}</Text>
                    </TouchableOpacity>
                  ) : (selectedItem.registrationStatus === 'joined' || selectedItem.registrationStatus === 'active') ? (
                    <TouchableOpacity onPress={() => handleCampaignAction(selectedItem, 'leave')} style={[styles.secondaryButton, { opacity: actionLoading ? 0.7 : 1 }]} disabled={actionLoading}>
                      <Text style={[styles.secondaryButtonText, { color: BRAND_DARK }]}>{actionLoading ? 'Leaving...' : 'Leave campaign'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}

            {filteredList.length === 0 && !selectedItem && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No results found for "{searchQuery}"</Text>
              </View>
            )}
          </ScrollView>
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
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 5 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 50,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: BRAND_DARK,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 5,
  },
  heroSection: {
    marginBottom: 15,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_DARK,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: BRAND_DARK,
    lineHeight: 24,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 17,
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
  },

  notificationCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 14,
    marginBottom: 12,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIconWrapper: {
    marginRight: 10,
    marginTop: 2,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND_DARK,
    marginBottom: 4,
  },
  notificationSubtitle: {
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 16,
  },
  campaignCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
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
    fontSize: 14,
    fontWeight: '800',
    color: BRAND_DARK,
    flex: 1,
    marginRight: 12,
  },
  campaignStatusPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  campaignStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  campaignDescription: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 10,
    lineHeight: 18,
  },
  campaignMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignMetaLabel: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  detailCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: '#FFF',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND_DARK,
    marginBottom: 4,
  },
  detailSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    lineHeight: 18,
  },
  detailCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  detailMeta: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  detailActions: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: BRAND_DARK,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_DARK,
  },
});

export default ReferralDetailList;