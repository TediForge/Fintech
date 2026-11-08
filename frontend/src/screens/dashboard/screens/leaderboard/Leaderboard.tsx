import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  StyleSheet,
  Platform,
  StatusBar,
  Image,
  SafeAreaView,
  Dimensions,
  Animated,
  Modal,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSessionToken } from '@hooks/useAuth';
import ScreenHeader from '@components/headers/ScreenHeader';
import LoadingScreen from '@components/Loading/LoadingScreen';

const api = apiConfig.baseUrl;

const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

const Leaderboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topTen, setTopTen] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [currentWeekName, setCurrentWeekName] = useState('');

  // Custom Sheet Animation Refs
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    if (!refreshing) setLoading(true);
    try {
      const sessionToken = await getSessionToken();
      const api_url = `${api}/v1/user/transactions/leaderboard.php`;

      const topRes = await fetch(api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getTop10' }),
      });
      const topJson = await topRes.json();
      
      if (topJson.success && Array.isArray(topJson.data)) {
        setTopTen(topJson.data);
        if (topJson.data.length > 0 && topJson.data[0].weekName) {
          setCurrentWeekName(topJson.data[0].weekName);
        }
      }

      if (sessionToken) {
        const rankRes = await fetch(api_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getUserRank', [config.sessionToken]: sessionToken }),
        });
        const rankJson = await rankRes.json();
        if (rankJson.success) {
          setUserRank(rankJson.data);
        }
      }

    } catch (error) {
      console.error('Leaderboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboardData();
  };

  const openInfoSheet = () => {
    setIsSheetVisible(true);
    Animated.parallel([
      Animated.timing(animValue, {
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

  const closeInfoSheet = () => {
    Animated.parallel([
      Animated.timing(animValue, {
        toValue: screenHeight,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsSheetVisible(false);
    });
  };

  const getProfileImage = (item) => {
    if (item.profileImage) return { uri: item.profileImage };
    return item.gender === 'female' 
      ? { uri: 'https://cdn-icons-png.flaticon.com/128/16973/16973671.png' }
      : { uri: 'https://cdn-icons-png.flaticon.com/128/13716/13716710.png' };
  };

  const getOrdinalSuffix = (rank) => {
    const s = ["th", "st", "nd", "rd"];
    const v = rank % 100;
    return rank + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const renderRankIcon = (rank) => {
    const ordinal = getOrdinalSuffix(rank);
    if (rank <= 3) {
      return (
        <View style={[styles.topBadge, rank === 1 ? styles.goldBadge : rank === 2 ? styles.silverBadge : styles.bronzeBadge]}>
          <Text style={styles.topBadgeText}>{ordinal}</Text>
        </View>
      );
    }
    return <Text style={styles.rankNumber}>{ordinal}</Text>;
  };

  const groupData = (data) => {
    const sections = [];
    if (data.length > 0) {
      sections.push({ title: currentWeekName || 'Weekly Rankings', data: data });
    }
    return sections;
  };

  const renderItem = ({ item }) => {
    const isTopThree = item.rank <= 3;
    const isCurrentUser = userRank && item.name === userRank.name;
    const RANK_LABELS = [
      'Apex Spender',
      'Elite Spender',
      'Prime Spender',
      'Platinum Spender',
      'Gold Spender',
      'Silver Spender',
      'Power Spender',
      'Active Spender',
      'Rising Spender',
      'Smart Spender'
    ];

    return (
      <TouchableOpacity style={styles.transactionCard} activeOpacity={0.8}>
        <View style={styles.cardInternalWrapper}>
          <View style={styles.leftInfoSection}>
            <View style={[styles.iconCircleBackground, { backgroundColor: isTopThree ? '#E9F9EF' : '#F5F8F7' }]}>
              <Image source={getProfileImage(item)} style={styles.typeIconImage} resizeMode="contain" />
            </View>

            <View style={styles.textMetadataContainer}>
              <Text style={styles.transactionMainTitle} numberOfLines={1}>
                {item.name}{isCurrentUser ? ' (You)' : ''}
              </Text>
              <Text style={styles.transactionDateSubtitle}>
                {RANK_LABELS[item.rank - 1] || 'Active Transaction Leader'}
              </Text>
            </View>
          </View>

          <View style={styles.rightFinancialSection}>
            <View style={styles.rankBadge}>
              {renderRankIcon(item.rank)}
            </View>
            <View style={[styles.statusBadgeContainer, { backgroundColor: isTopThree ? 'rgba(47,184,109,0.15)' : 'rgba(14,60,46,0.1)' }]}>
              <Text style={[styles.statusLabelText, { color: isTopThree ? '#2FB86D' : BRAND_COLOR }]}>ACTIVE</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPodiumHeader = () => {
    const podiumData = topTen.slice(0, 3);
    if (podiumData.length === 0) return null;
    const displayOrder = [];
    if (podiumData[1]) displayOrder.push(podiumData[1]);
    if (podiumData[0]) displayOrder.push(podiumData[0]);
    if (podiumData[2]) displayOrder.push(podiumData[2]);

    return (
      <View style={styles.headerCombinedArea}>
        <View style={styles.podiumWrapper}>
          <View style={styles.podiumContainer}>
            {displayOrder.map((item) => {
              const nameParts = item.name ? item.name.split(' ') : [];
              const middleName = nameParts.length > 1 ? nameParts[1] : item.name;
              
              const standHeight = item.rank === 1 ? 95 : item.rank === 2 ? 70 : 50;
              const standColor = item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32';

              return (
                <View key={item.user_id || item.name} style={[styles.podiumItem, item.rank === 1 && styles.firstPlace]}>
                  <View style={styles.imageWrapper}>
                    <Image source={getProfileImage(item)} style={styles.podiumImage} />
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>{middleName}</Text>
                  
                  <LinearGradient
                    colors={['rgba(14, 60, 46, 0.15)', 'rgba(239, 247, 244, 0.0)']}
                    style={[styles.podiumStand, { height: standHeight }]}
                  >
                    <View style={[styles.podiumRankBadge, { backgroundColor: standColor }]}>
                      <Text style={styles.podiumRankText}>{item.rank}</Text>
                    </View>
                    <View style={styles.podiumGlow} />
                  </LinearGradient>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <Text style={styles.footerText}>Keep spending to climb the ranks and unlock elite rewards every week!</Text>
    </View>
  );

  return (
    <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={styles.mainScreenContainer}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title="Champions Board" backgroundColor="#eff7f4" textColor="#000" iconColor="#000" />

        <LoadingScreen visible={loading} message="Fetching.." />

        <View style={styles.bodyWrapper}>
          <SectionList
            sections={groupData(topTen)}
            keyExtractor={(item, index) => (item.user_id ? item.user_id.toString() : index.toString())}
            renderItem={renderItem}
            stickySectionHeadersEnabled={true}
            ListHeaderComponent={renderPodiumHeader}
            ListFooterComponent={renderFooter}
            ListFooterComponentStyle={{ flex: 1, justifyContent: 'flex-end' }}
            contentContainerStyle={styles.listScrollingContainer}
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.stickyHeaderWrapper}>
                <View style={styles.sectionHeaderContainer}>
                  <View style={styles.headerLeftColumn}>
                    <Text style={styles.sectionHeaderText}>{title}</Text>
                    <View style={styles.monthlySummaryRow}>
                      <View style={styles.summaryItem}>
                        <View style={[styles.dot, { backgroundColor: '#2FB86D' }]} />
                        <Text style={styles.summaryLabel}>Category: </Text>
                        <Text style={styles.summaryValueIn}>Top Spenders</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.infoButton} activeOpacity={0.7} onPress={openInfoSheet}>
                    <Text style={styles.infoButtonText}>Info</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2FB86D']} />
            }
          /> 
        </View>

        {/* Info / Rules Sheet */}
        <Modal
          visible={isSheetVisible}
          transparent={true}
          animationType="none"
          onRequestClose={closeInfoSheet}
        >
          <View style={styles.modalRoot}>
            <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeInfoSheet} />
            </Animated.View>

            <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: animValue }] }]}>
              <View style={styles.dragIndicator} />
              <SafeAreaView style={styles.safeAreaSheet}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetMainTitle}>Leaderboard Rules</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rulesScrollContent}>
                  <View style={styles.ruleItem}>
                    <View style={styles.ruleIconBox}>
                      <Ionicons name="trophy-outline" size={18} color={BRAND_COLOR} />
                    </View>
                    <View style={styles.ruleTextBox}>
                      <Text style={styles.ruleTitle}>The Top 10 Elite</Text>
                      <Text style={styles.ruleDescription}>Only the top 10 users with the highest successful transaction volume are saved in the weekly rankings.</Text>
                    </View>
                  </View>

                  <View style={styles.ruleItem}>
                    <View style={styles.ruleIconBox}>
                      <Ionicons name="flash-outline" size={18} color={BRAND_COLOR} />
                    </View>
                    <View style={styles.ruleTextBox}>
                      <Text style={styles.ruleTitle}>Real-time Competition</Text>
                      <Text style={styles.ruleDescription}>This is a live cycle. If someone spends more than you, they will take your spot in the Top 10 automatically.</Text>
                    </View>
                  </View>

                  <View style={styles.ruleItem}>
                    <View style={styles.ruleIconBox}>
                      <Ionicons name="calendar-outline" size={18} color={BRAND_COLOR} />
                    </View>
                    <View style={styles.ruleTextBox}>
                      <Text style={styles.ruleTitle}>Weekly Finalization</Text>
                      <Text style={styles.ruleDescription}>At the end of every week, the standings are locked, and the top 3 participants are declared winners for that week.</Text>
                    </View>
                  </View>

                  <View style={styles.ruleItem}>
                    <View style={styles.ruleIconBox}>
                      <Ionicons name="person-outline" size={18} color={BRAND_COLOR} />
                    </View>
                    <View style={styles.ruleTextBox}>
                      <Text style={styles.ruleTitle}>Track Your Progress</Text>
                      <Text style={styles.ruleDescription}>Even if you aren't in the Top 10 yet, you can always see your specific position at the top of the list.</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.closeSheetBtn} onPress={closeInfoSheet}>
                    <Text style={styles.closeSheetBtnText}>I Understand</Text>
                  </TouchableOpacity>
                </ScrollView>
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  mainScreenContainer: { flex: 1 },
  safeArea: { flex: 1 },
  bodyWrapper: { flex: 1 },
  listScrollingContainer: { 
    paddingHorizontal: 16, 
    paddingBottom: 40,
    paddingTop: 20,
    flexGrow: 1,
  },
  headerCombinedArea: {
    marginBottom: 15,
  },
  podiumWrapper: { marginBottom: 15, marginTop: 5 },
  podiumContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 220 },
  podiumItem: { alignItems: 'center', width: width / 3.8 },
  firstPlace: { transform: [{ scale: 1.1 }], marginBottom: 15 },
  imageWrapper: { position: 'relative', height: 50, width: 50, borderRadius: 27, borderWidth: 1, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E9F9EF', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  podiumImage: { width: 25, height: 25, borderRadius: 12.5 },
  badge: { position: 'absolute', bottom: -4, right: -4, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  podiumName: { marginTop: 10, fontWeight: '800', fontSize: 11, color: BRAND_COLOR, textAlign: 'center', marginBottom: 8 },
  podiumStand: { width: '80%', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, alignItems: 'center', paddingTop: 12, overflow: 'hidden' },
  podiumRankBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fff', elevation: 3 },
  podiumRankText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  podiumGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' },

  userRankInline: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  inlineGradient: { padding: 12 },
  inlineContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineUserSection: { flexDirection: 'row', alignItems: 'center' },
  inlineRank: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  inlineTextWrapper: { marginLeft: 15 },
  inlineLabel: { color: '#b2dfdb', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3 },
  inlineName: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
  },
  cardInternalWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leftInfoSection: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  iconCircleBackground: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  typeIconImage: { width: '50%', height: '50%', borderRadius: 12.5 },
  textMetadataContainer: { marginLeft: 8, flex: 1 },
  transactionMainTitle: { fontSize: 12, fontWeight: '700', color: BRAND_COLOR },
  transactionDateSubtitle: { fontSize: 9, color: '#999', marginTop: 1 },
  rightFinancialSection: { alignItems: 'flex-end', minWidth: 60 },
  rankBadge: { marginBottom: 3, alignItems: 'center' },
  rankNumber: { fontSize: 11, fontWeight: '800', color: '#666' },
  topBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  goldBadge: { backgroundColor: '#FFD700' },
  silverBadge: { backgroundColor: '#C0C0C0' },
  bronzeBadge: { backgroundColor: '#CD7F32' },
  topBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  statusBadgeContainer: { paddingVertical: 1, paddingHorizontal: 5, borderRadius: 3 },
  statusLabelText: { fontSize: 7, fontWeight: '700' },
  stickyHeaderWrapper: { backgroundColor: '#eff7f4' },
  sectionHeaderContainer: {
    backgroundColor: '#eff7f4', 
    paddingVertical: 8,
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(14, 60, 46, 0.05)',
    marginBottom: 10,
  },
  headerLeftColumn: { flexDirection: 'column' },
  sectionHeaderText: { fontSize: 11, fontWeight: '800', color: BRAND_COLOR, textTransform: 'uppercase' },
  monthlySummaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  summaryItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginRight: 3 },
  summaryLabel: { fontSize: 9, color: '#666' },
  summaryValueIn: { fontSize: 9, fontWeight: '700', color: '#2FB86D' },
  infoButton: { backgroundColor: '#2FB86D', paddingVertical: 3, paddingHorizontal: 12, borderRadius: 10 },
  infoButtonText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  footerContainer: { paddingVertical: 30, alignItems: 'center', paddingHorizontal: 40 },
  footerText: { fontSize: 10, color: '#999', textAlign: 'center', lineHeight: 16, fontStyle: 'italic' },

  // --- Modal / Sheet Styles ---
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 25 * scale,
    borderTopRightRadius: 25 * scale,
    maxHeight: screenHeight * 0.7,
  },
  dragIndicator: { 
    width: 35 * scale,   
    height: 4 * scale, 
    backgroundColor: '#E0E0E0', 
    borderRadius: 2, 
    alignSelf: 'center', 
    marginTop: 12 * scale 
  },
  safeAreaSheet: { width: '100%' },
  sheetHeader: { alignItems: 'center', paddingTop: 15 * scale, paddingBottom: 20 * scale },
  sheetMainTitle: { fontSize: 17 * scale, fontWeight: '700', color: BRAND_COLOR },
  rulesScrollContent: { paddingHorizontal: 20 * scale, paddingBottom: 40, paddingTop: 10 },
  ruleItem: { flexDirection: 'row', marginBottom: 20 * scale, alignItems: 'flex-start' },
  ruleIconBox: { width: 36 * scale, height: 36 * scale, borderRadius: 18 * scale, backgroundColor: '#f0f7f4', justifyContent: 'center', alignItems: 'center' },
  ruleTextBox: { flex: 1, marginLeft: 15 * scale },
  ruleTitle: { fontSize: 14 * scale, fontWeight: '700', color: '#1A1C1E', marginBottom: 4 },
  ruleDescription: { fontSize: 12 * scale, color: '#666', lineHeight: 18 * scale },
  closeSheetBtn: { backgroundColor: BRAND_COLOR, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  closeSheetBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default Leaderboard;