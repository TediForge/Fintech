import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { handleProfile } from '../handlers/handleProfile';

const normalizeTier = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/^level/, 'tier');

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
};

const KycLimitsCard = () => {
  const [tiers, setTiers] = useState([]);
  const [currentTier, setCurrentTier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadTiers = async () => {
      try {
        const result = await handleProfile();
        if (!isMounted) return;

        if (!result?.success) {
          setError(result?.message || 'Unable to load limits');
          setTiers([]);
          return;
        }

        setTiers(Array.isArray(result?.data?.tiers) ? result.data.tiers : []);
        setCurrentTier(normalizeTier(result.data?.current || result.data?.currentLevel));
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || 'Unable to load limits');
        setTiers([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTiers();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Account limits</Text>
        <Text style={styles.loadingText}>Loading tier limits...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Account limits</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const currentIndex = tiers.findIndex((tier) => {
    const tierName = tier?.tierId || tier?.tier || tier?.tierName || tier?.tier_name || tier?.name || tier?.displayName;
    return normalizeTier(tierName) === currentTier;
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Account limits</Text>
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.headerCell]}>Tier</Text>
          <Text style={[styles.cell, styles.headerCell]}>Daily</Text>
          <Text style={[styles.cell, styles.headerCell]}>Monthly</Text>
        </View>

        {tiers.map((tier, index) => {
          const tierName = tier?.displayName || tier?.tierName || tier?.tier_name || 'Tier';
          const tierKey = normalizeTier(tier?.tierId || tier?.tier || tier?.tierName || tier?.tier_name || tier?.name || tierName);
          const dailyValue = tier?.dailyWithdrawalLimit ?? tier?.daily_withdrawal_limit ?? 0;
          const monthlyValue = tier?.monthlyWithdrawalLimit ?? tier?.monthly_withdrawal_limit ?? 0;
          const isCurrent = tierKey === currentTier;
          const isComplete = currentIndex >= 0 && index <= currentIndex;

          return (
            <View key={`${tierName}-${dailyValue}-${monthlyValue}`} style={styles.row}>
              <View style={[styles.cell, styles.tierCell]}>
                <View style={styles.tierIndicator}>
                  <View style={[styles.progressCircle, isComplete && styles.progressCircleComplete, isCurrent && styles.progressCircleCurrent]}>
                    {isCurrent && <Ionicons name="checkmark" size={8} color="#FFFFFF" />}
                  </View>
                </View>
                <Text style={[styles.tierName, isCurrent && styles.progressLabelCurrent]} numberOfLines={1}>{tierName}</Text>
              </View>
              <Text style={styles.cell}>{formatCurrency(dailyValue)}</Text>
              <Text style={styles.cell}>{formatCurrency(monthlyValue)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0E3C2E',
    marginBottom: 12,
  },
  tierCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierIndicator: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    transform: [{ translateY: 1 }],
  },
  progressCircleComplete: {
    borderColor: '#0E3C2E',
    backgroundColor: '#0E3C2E',
  },
  progressCircleCurrent: {
    borderColor: '#0E3C2E',
  },
  progressLabel: {
    fontSize: 9,
    color: '#64748B',
    marginLeft: 8,
  },
  progressLabelCurrent: {
    color: '#0E3C2E',
    fontWeight: '700',
  },
  table: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  headerRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingTop: 0,
  },
  cell: {
    flex: 1,
    fontSize: 11,
    color: '#334155',
    textAlign: 'left',
  },
  headerCell: {
    fontWeight: '700',
    color: '#0E3C2E',
    textTransform: 'uppercase',
  },
  tierName: {
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 3,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
  },
});

export default KycLimitsCard;
