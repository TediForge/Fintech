import { Alert } from '@components/common/Alert';
import React, { useState, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import LoadingScreen from '@components/Loading/LoadingScreen';
import SearchBar from '@components/common/SearchBar';
import ScreenHeader from '@components/headers/ScreenHeader';
import { useTheme } from '@providers/ThemeProvider';
import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;
const BRAND_DARK = '#0E3C2E';
const BRAND_GOLD = '#D4AF37';
const TEXT_MUTED = '#64748B';

const AccountLimitsScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [fetching, setFetching] = useState(true);
  const [tiers, setTiers] = useState([]);
  const [currentTier, setCurrentTier] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLimitsData = async () => {
    try {
      const sessionToken = await getSessionToken();
      const url = `${api}/v1/user/tiers/?${config.sessionToken}=${encodeURIComponent(sessionToken || '')}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (data?.success) {
        setTiers(data.data?.tiers || []);
        setCurrentTier(data.data?.currentLevel || '');
      } else {
        throw new Error(data?.message || 'Unable to load account tiers');
      }
    } catch (err) {
      console.log('Limits Sync Error:', err);
      Alert.sheet('Unable to load tiers', 'Please try again in a moment.');
    } finally {
      setFetching(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLimitsData();
    }, [])
  );

  const filteredTiers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return tiers.filter((tier) => {
      const name = (tier.tierName || '').toLowerCase();
      return name.includes(query);
    });
  }, [tiers, searchQuery]);

  const handleUpgrade = (tier) => {
    Alert.sheet(
      'Upgrade Account',
      `Would you like to proceed with the requirements for ${(tier.tierName || tier.tier_name || 'this tier').toUpperCase()}?`,
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Upgrade Now', onPress: () => navigation.navigate('KYCUpdate', { targetTier: tier.tier_name }) },
      ]
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (fetching) {
    return <LoadingScreen visible={true} message="Fetching Limits.." />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]}
        style={StyleSheet.absoluteFillObject}
      />

      <ScreenHeader
        title="Account Limits"
        backgroundColor={colors.surface}
        textColor={colors.textPrimary}
        iconColor={colors.textPrimary}
        onBack={() => navigation.goBack()}
      />

      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        placeholder="Search tiers..."
        containerStyle={{ paddingTop: 20, paddingHorizontal: 16, marginBottom: 10 }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredTiers.map((item) => {
          const tierName = (item.tierName || item.tier_name || '').toLowerCase();
          const isCurrent = tierName === String(currentTier).toLowerCase();
          const tierOrder = ['tier1', 'tier2', 'tier3', 'merchant'];
          const canUpgrade = tierOrder.indexOf(tierName) > tierOrder.indexOf(String(currentTier).toLowerCase());

          return (
            <TouchableOpacity
              key={item.tierName || item.tier_name || tierName}
              style={[styles.permissionCard, isCurrent && styles.activeCardBorder, { backgroundColor: colors.card }]}
              activeOpacity={canUpgrade ? 0.7 : 1}
              onPress={() => canUpgrade && handleUpgrade(item)}
            >
              <View style={styles.cardInternalWrapper}>
                <View style={styles.leftInfoSection}>
                  <View style={[styles.iconWrapper, { backgroundColor: isCurrent ? BRAND_DARK : BRAND_DARK + '15' }]}
                  >
                    <MaterialCommunityIcons
                      name={tierName === 'merchant' ? 'store' : 'shield-check'}
                      size={20}
                      color={isCurrent ? colors.surface : colors.accent}
                    />
                  </View>
                  <View style={styles.textMetadataContainer}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.permissionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {(item.tierName || item.tier_name || 'Tier').toUpperCase()}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>Daily: {formatCurrency(item.dailyWithdrawalLimit ?? item.daily_withdrawal_limit ?? 0)} • Monthly: {formatCurrency(item.monthlyWithdrawalLimit ?? item.monthly_withdrawal_limit ?? 0)}</Text>
                  </View>
                </View>

                {canUpgrade ? (
                  <View style={styles.upgradeIndicator}>
                    <Text style={styles.upgradeText}>Upgrade</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                  </View>
                ) : (
                  !isCurrent && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {filteredTiers.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tiers found matching "{searchQuery}"</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: 15, paddingBottom: 80, paddingHorizontal: 16 },
  permissionCard: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  activeCardBorder: { borderColor: BRAND_DARK, borderWidth: 1 },
  cardInternalWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  leftInfoSection: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  iconWrapper: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  textMetadataContainer: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  permissionTitle: { fontSize: 13, fontWeight: '700', color: BRAND_DARK, marginRight: 8 },
  currentBadge: { backgroundColor: BRAND_GOLD, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  currentBadgeText: { fontSize: 8, fontWeight: '800', color: BRAND_DARK },
  permissionDesc: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },
  upgradeIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f0ec', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  upgradeText: { fontSize: 10, fontWeight: '700', color: BRAND_DARK, marginRight: 2 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: TEXT_MUTED, textAlign: 'center' },
});

export default AccountLimitsScreen;
