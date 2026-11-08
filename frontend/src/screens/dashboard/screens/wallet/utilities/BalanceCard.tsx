import React, { useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useApiClient from '@hooks/apiClient';
import { useTheme } from '@providers/ThemeProvider';

const formatBalance = (value) => {
  const amount = Number(value || 0).toFixed(2);
  return amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const getWalletLabel = (walletType) => {
  if (!walletType) return 'Wallet Balance';

  return String(walletType)
    .replace(/[_&-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const BalanceCard = ({ name, walletType, marginHorizontal = 0, marginVertical = 0 }) => {
  const { balances = {}, loading } = useApiClient();
  const { colors, isDark } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const wallet = balances[String(walletType || 'MAIN').toUpperCase()] || {};

  return (
    <View style={[styles.card, { backgroundColor: isDark ? colors.surface : colors.card, borderColor: colors.border, marginHorizontal, marginVertical }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{name || getWalletLabel(walletType)}</Text>
        <TouchableOpacity onPress={() => setIsVisible((visible) => !visible)} activeOpacity={0.7}>
          <Ionicons
            name={isVisible ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.amount, { color: colors.textPrimary }]}>
        {loading ? 'Loading...' : isVisible ? `₦${formatBalance(wallet.availableBalance)}` : 'Confidential'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  amount: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 12,
  },
});

export default BalanceCard;
