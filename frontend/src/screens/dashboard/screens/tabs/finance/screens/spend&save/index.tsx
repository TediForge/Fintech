import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@components/headers/ScreenHeader';
import { useTheme } from '@providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import PinVerify from '@auth/verification/pin/pinVerify';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';
import BalanceCard from '@dashboard/screens/wallet/utilities/BalanceCard';
import SpendSaveSetupSheet from './utilities/SpendSaveSetupSheet';
import ActivitySection from '@dashboard/screens/transactions/history/ActivitySection';

const spendSaveEndpoint = `${apiConfig.baseUrl}/v1/banking/savings/spend&save/index.php`;

const SpendSaveScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [setupVisible, setSetupVisible] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [configurationState, setConfigurationState] = useState({ hasConfiguration: false, isEnabled: false, modeText: 'No saving rule configured' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchConfiguration = useCallback(async () => {
    try {
      const sessionToken = await getSessionToken();
      const response = await fetch(`${spendSaveEndpoint}?${new URLSearchParams({ [config.sessionToken]: sessionToken || '' })}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || 'Unable to load Spend & Save configuration');
      }

      const data = result.data || null;
      setConfigurationState({
        hasConfiguration: Boolean(data),
        isEnabled: data?.isEnabled === true || data?.isEnabled === '1' || data?.isEnabled === 1,
        modeText: Number(data?.savePercentage || 0) > 0
          ? `${Number(data.savePercentage).toFixed(2)}% of eligible spending`
          : Number(data?.fixedSaveAmount || 0) > 0
            ? `₦${Number(data.fixedSaveAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per eligible spending`
            : 'No saving rule configured',
      });
    } catch (error) {
      console.warn('[SpendSaveScreen] configuration fetch failed', error?.message || error);
    }
  }, []);

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration, refreshTrigger]);

  const openWalletTransfer = () => {
    navigation.navigate('walletTransfer', { source: 'SPEND&SAVE' });
  };

  const requirePinForSave = (saveAction) => {
    setPendingSave(() => saveAction);
    setSetupVisible(false);
    setPinVisible(true);
  };

  const handlePinResult = (result) => {
    setPinVisible(false);
    const saveAction = pendingSave;
    setPendingSave(null);

    if (result === 'approved') {
      saveAction?.();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Spend & Save"
        backgroundColor={colors.surface}
        textColor={colors.textPrimary}
        iconColor={colors.textPrimary}
        onBack={undefined}
      />
      <View style={styles.pageContent}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={() => setRefreshTrigger((value) => value + 1)} />}
          >
          <BalanceCard
            name="Savings balance"
            walletType="SPEND&SAVE"
            marginHorizontal={16}
            marginVertical={10}
          />
            <TouchableOpacity
              style={[styles.ruleSection, { backgroundColor: colors.card }]}
              onPress={() => setSetupVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.ruleIcon}>
                <Ionicons name="options-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.ruleCopy}>
                <Text style={[styles.ruleValue, { color: colors.textPrimary }]}>{configurationState.modeText}</Text>
              </View>
              <View style={styles.ruleRight}>
                <View style={[styles.statusBadge, { backgroundColor: configurationState.isEnabled ? '#E5F5EC' : '#EEF1F2' }]}>
                  <Text style={[styles.statusBadgeText, { color: configurationState.isEnabled ? '#2E8B57' : colors.textSecondary }]}>
                    {configurationState.isEnabled ? 'Active' : configurationState.hasConfiguration ? 'Disabled' : 'Not configured'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          <ActivitySection
            walletType="SPEND&SAVE"
            refreshTrigger={refreshTrigger}
            marginHorizontal={16}
          />
          </ScrollView>
          <View style={[styles.floatingActions, { bottom: insets.bottom + 22 }]}>
            {!configurationState.isEnabled && (
              <TouchableOpacity
                style={[styles.floatingManageButton, { borderColor: colors.accent }]}
                onPress={() => setSetupVisible(true)}
              >
                <Text style={[styles.floatingManageText, { color: colors.accent }]}>
                  {configurationState.hasConfiguration ? 'Manage Spend & Save' : 'Set up Spend & Save'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.floatingWithdrawButton, { backgroundColor: colors.accent }]}
              onPress={openWalletTransfer}
            >
              <Text style={styles.floatingWithdrawText}>Withdraw funds</Text>
            </TouchableOpacity>
          </View>
      </View>
      <SpendSaveSetupSheet
        visible={setupVisible}
        onClose={() => setSetupVisible(false)}
        onSaved={() => setRefreshTrigger((value) => value + 1)}
        onRequirePin={requirePinForSave}
      />
      <PinVerify
        visible={pinVisible}
        onResult={handlePinResult}
        onClose={() => handlePinResult('cancelled')}
        isPayment
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  ruleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
  },
  ruleIcon: { width: 25, height: 25, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF5EF' },
  ruleCopy: { flex: 1, marginLeft: 10 },
  ruleRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  ruleValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  floatingActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
  },
  floatingWithdrawButton: {
    minHeight: 48,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  floatingWithdrawText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  floatingManageButton: {
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  floatingManageText: {
    fontSize: 13,
    fontWeight: '800',
  },
});

export default SpendSaveScreen;
