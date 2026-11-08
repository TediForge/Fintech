import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { formatDate } from '@lib/utils/format';
import { getIcon, getStatusColors } from './hooks/transactionCardHelpers';

export const TransactionCardSkeleton = React.memo(() => (
  <View style={styles.card}>
    <View style={styles.inner}>
      <View style={styles.left}>
        <View style={styles.skeletonIcon} />
        <View style={styles.meta}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonDate} />
        </View>
      </View>
      <View style={styles.right}>
        <View style={styles.skeletonAmount} />
        <View style={styles.skeletonBadge} />
      </View>
    </View>
  </View>
));

const TransactionCard = ({
  item,
  loading = false,
  backgroundColor = '#fff',
  iconBackgroundColor,
  iconColor,
}) => {
  const navigation = useNavigation();

  if (loading) {
    return <TransactionCardSkeleton />;
  }

  const status = item.status || 'Pending';
  const isCredit = item.transaction_direction === 'credit';

  const { textColor, bgColor } = getStatusColors(status);
  const TransactionIcon = getIcon(item.transaction_type);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor }]}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('TransactionDetailsScreen', { transactionReference: item.ps_ref })}
    >
      <View style={styles.inner}>
        <View style={styles.left}>
          <View style={[styles.iconBg, { backgroundColor: iconBackgroundColor || (isCredit ? '#E9F9EF' : '#FBE9E9') }]}>
            <TransactionIcon size={20} color={iconColor || '#262626'} />
          </View>
          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={1}>{item.service_name || item.transaction_type || 'Transaction'}</Text>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={[styles.amount, { color: isCredit ? '#2FB86D' : '#0E3C2E' }]}>{isCredit ? '+' : '-'}₦{Math.abs(parseFloat(item.amount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          <View style={[styles.badge, { backgroundColor: bgColor }]}>
            <Text style={[styles.badgeText, { color: textColor }]}>{(status || '').toUpperCase()}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderWidth: 0.1, borderColor: 'rgba(204,204,204,0.8)' },
  inner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  iconBg: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  icon: { width: 20, height: 20 },
  meta: { marginLeft: 10, flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: '#0E3C2E' },
  date: { fontSize: 10, color: '#999', marginTop: 2 },
  right: { alignItems: 'flex-end', minWidth: 90 },
  amount: { fontSize: 13, fontWeight: '800' },
  badge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, marginTop: 6 },
  badgeText: { fontSize: 8, fontWeight: '700' },
  skeletonIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0' },
  skeletonTitle: { width: '62%', height: 12, borderRadius: 4, backgroundColor: '#E2E8F0' },
  skeletonDate: { width: '78%', height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', marginTop: 6 },
  skeletonAmount: { width: 72, height: 13, borderRadius: 4, backgroundColor: '#E2E8F0' },
  skeletonBadge: { width: 52, height: 12, borderRadius: 4, marginTop: 6, backgroundColor: '#E2E8F0' }
});

export default TransactionCard;
