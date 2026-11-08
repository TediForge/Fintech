import { Alert } from '@components/common/Alert';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '@providers/ThemeProvider';
import ScreenHeader from '@components/headers/ScreenHeader';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';
import ScheduleReviewSheet from './utilities/ScheduleReviewSheet';
import { billServices } from '@dashboard/screens/bills';
import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;
const fetchingEndpoint = `${api}/v1/banking/bills/schedule/fetching/`;
const managementEndpoint = `${api}/v1/banking/bills/schedule/management/`;

const availableBillsToSchedule = billServices.map((service) => ({
  id: service.id,
  title: service.title,
  subtitle: service.subtitle,
  icon: service.icon,
  route: service.route,
}));

export { ScheduleReviewSheet };

const ScheduledBills = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [showSelectBillsPage, setShowSelectBillsPage] = useState(false);
  const [showDetailsPage, setShowDetailsPage] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const sessionToken = await getSessionToken();
      const response = await fetch(`${fetchingEndpoint}?${config.sessionToken}=${encodeURIComponent(sessionToken)}&limit=100&offset=0`);
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || 'Unable to retrieve scheduled bills');
      setSchedules(Array.isArray(result.data?.items) ? result.data.items : []);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to retrieve scheduled bills');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSchedules();
    }, [fetchSchedules])
  );

  const openScheduleDetails = async (schedule) => {
    setSelectedSchedule(schedule);
    setShowDetailsPage(true);
    try {
      const sessionToken = await getSessionToken();
      const response = await fetch(`${fetchingEndpoint}?${config.sessionToken}=${encodeURIComponent(sessionToken)}&id=${encodeURIComponent(schedule.id)}`);
      const result = await response.json();
      if (response.ok && result?.success) {
        setSelectedSchedule({
          ...(result.data?.schedule || schedule),
          runHistory: result.data?.runHistory || [],
        });
      }
    } catch (error) {
      console.warn('[ScheduledBills] detail fetch failed:', error.message);
    }
  };

  const manageSchedule = async (action) => {
    if (!selectedSchedule?.id) return;
    try {
      const sessionToken = await getSessionToken();
      const response = await fetch(managementEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.sessionToken]: sessionToken, action, id: selectedSchedule.id }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || 'Unable to manage scheduled bill');
      setShowDetailsPage(false);
      await fetchSchedules();
    } catch (error) {
      Alert.sheet('Schedule error', error.message || 'Unable to manage scheduled bill');
    }
  };

  const handleSelectBill = (bill) => {
    setShowSelectBillsPage(false);
    console.log('Selected bill for scheduling:', bill.title);

    if (bill?.route) {
      navigation.navigate(bill.route, { schedule: true });
    }
  };

  const bills = schedules;

  if (showDetailsPage && selectedSchedule) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader title="Schedule Details" backgroundColor={colors.surface} textColor={colors.textPrimary} iconColor={colors.textPrimary} onBack={() => setShowDetailsPage(false)} />
          <ScrollView contentContainerStyle={styles.listContent}>
            <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{selectedSchedule.billType}</Text>
              <Text style={[styles.detailStatus, { color: colors.accent }]}>{selectedSchedule.status || 'active'}</Text>
              {Object.entries(selectedSchedule.billPayload || {}).map(([key, value]) => (
                <View key={key} style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{key}</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{String(value)}</Text>
                </View>
              ))}
              <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>Run history</Text>
              {selectedSchedule.runHistory?.length ? selectedSchedule.runHistory.map((run, index) => (
                <View key={run.id || `${run.startedAt || 'run'}-${index}`} style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{run.status || 'Run'}</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{run.executedAt || run.startedAt || run.createdAt || 'Recorded'}</Text>
                </View>
              )) : <Text style={[styles.noHistory, { color: colors.textSecondary }]}>No executions recorded yet.</Text>}
            </View>
            <View style={styles.actionRow}>
              {selectedSchedule.status === 'paused' ? (
                <TouchableOpacity style={[styles.manageButton, { backgroundColor: colors.accent }]} onPress={() => manageSchedule('resume')}><Text style={styles.manageButtonText}>Resume</Text></TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.manageButton, { backgroundColor: colors.warning || colors.accent }]} onPress={() => manageSchedule('pause')}><Text style={styles.manageButtonText}>Pause</Text></TouchableOpacity>
              )}
              {selectedSchedule.status !== 'cancelled' && <TouchableOpacity style={[styles.manageButton, { backgroundColor: '#B42318' }]} onPress={() => manageSchedule('cancel')}><Text style={styles.manageButtonText}>Cancel</Text></TouchableOpacity>}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (showSelectBillsPage) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? colors.background : colors.background }]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />

        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader
            title="Select Bills"
            backgroundColor={colors.surface}
            textColor={colors.textPrimary}
            iconColor={colors.textPrimary}
            onBack={() => setShowSelectBillsPage(false)}
          />

          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            <FeatureCardGrid
              items={availableBillsToSchedule.map((bill) => ({
                ...bill,
                desc: bill.subtitle,
              }))}
              onPress={handleSelectBill}
              delayMs={0}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: isDark ? colors.background : colors.background }]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />

        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader
            title="Scheduled Bills"
            backgroundColor={colors.surface}
            textColor={colors.textPrimary}
            iconColor={colors.textPrimary}
            onBack={() => navigation.goBack()}
          />

          {loading ? <View style={styles.emptyStateContainer}><ActivityIndicator color={colors.accent} /></View> : bills.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {bills.map((bill) => (
                <TouchableOpacity
                  key={bill.id}
                  onPress={() => openScheduleDetails(bill)}
                  activeOpacity={0.8}
                  style={[
                    styles.billCard,
                    { backgroundColor: isDark ? colors.surface : colors.card },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: isDark ? colors.accentSoft : colors.accentSoft }]}>
                    <Ionicons name={bill.icon} size={22} color={colors.accent} />
                  </View>

                  <View style={styles.billInfo}>
                    <Text style={[styles.billTitle, { color: colors.textPrimary }]}>{bill.billType}</Text>
                      <Text style={[styles.billSubtitle, { color: colors.textSecondary }]}>{bill.status || 'active'}</Text>
                  </View>

                  <Text style={[styles.billAmount, { color: colors.textPrimary }]}>{bill.billPayload?.amount ? `₦${bill.billPayload.amount}` : 'View'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyStateContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? colors.surface : colors.accentSoft }]}>
                <Ionicons name="calendar-outline" size={32} color={colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{errorMessage ? 'Unable to load schedules' : 'No scheduled bills yet'}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {errorMessage || 'Set up recurring bill payments and they will show up here.'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.fabButton, { backgroundColor: colors.accent }]}
            onPress={() => setShowSelectBillsPage(true)}
          >
            <View style={styles.fabContent}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.fabText}>Create</Text>
            </View>
          </TouchableOpacity>
        </SafeAreaView>
      </View>

    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  billSubtitle: {
    fontSize: 10,
  },
  billAmount: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  fabButton: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  detailCard: { borderRadius: 16, padding: 16 },
  detailTitle: { fontSize: 18, fontWeight: '700', textTransform: 'capitalize', marginBottom: 6 },
  detailStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.18)' },
  detailLabel: { fontSize: 11 },
  detailValue: { fontSize: 11, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  historyTitle: { fontSize: 12, fontWeight: '700', marginTop: 18, marginBottom: 4 },
  noHistory: { fontSize: 11, paddingVertical: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  manageButton: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  manageButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});

export default ScheduledBills;
