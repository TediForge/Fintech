import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getSessionToken } from '@hooks/useAuth';
import UnifiedServiceSection from '@components/extra/UnifiedServiceSection';
import { useTheme } from '@providers/ThemeProvider';
import config from '@config/app';
import { apiConfig } from '@config/api';
import TransactionCard from './utilities/TransactionCard';

const API_URL = `${apiConfig.baseUrl}/v1/user/transactions/history.php`;

const ActivitySection = ({ walletType, refreshTrigger = 0, marginTop = 0, marginHorizontal, onLoadingChange }) => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);

    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        setTransactions([]);
        return;
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionToken,
          category: null,
          status: null,
          startDate: null,
          endDate: null,
          ...(walletType ? { wallet_type: walletType } : {}),
        }),
      });
      const data = await response.json();

      if (response.ok && data.status === 'success') {
        const sortedTransactions = Array.isArray(data.transactions) ? data.transactions : [];
        sortedTransactions.sort((first, second) => new Date(second.created_at) - new Date(first.created_at));
        setTransactions(sortedTransactions);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.warn('[ActivitySection] fetch failed', error?.message || error);
      setTransactions([]);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [onLoadingChange, walletType]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity, refreshTrigger]);

  const viewAll = () => {
    navigation.navigate('TransactionHistoryScreen', walletType ? { walletType } : undefined);
  };

  return (
    <View style={marginHorizontal === undefined ? undefined : { marginHorizontal }}>
      <UnifiedServiceSection
        title="Activity"
        items={transactions.slice(0, 3)}
        isLoading={loading}
        rowMode="link"
        marginTop={marginTop}
        onHeaderAction={transactions.length > 3 ? viewAll : undefined}
        renderItem={(transaction) => (
          <TransactionCard
            key={transaction.ps_ref || transaction.id}
            item={transaction}
            backgroundColor={isDark ? colors.card : colors.accentSoft}
            iconBackgroundColor={colors.accentSoft}
            iconColor={colors.accent}
          />
        )}
      />
    </View>
  );
};

export default ActivitySection;