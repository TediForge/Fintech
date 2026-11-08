import { Alert } from '@components/common/Alert';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PinVerify from '@auth/verification/pin/pinVerify';
import { useTheme } from '@providers/ThemeProvider';
import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';

const initializationEndpoint = `${apiConfig.baseUrl}/v1/banking/bills/schedule/initialization/`;

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrow = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

const ScheduleReviewSheet = ({
  visible = false,
  payload = null,
  reviewData = [],
  onClose = () => {},
  onSubmitted = () => {},
}) => {
  const { colors } = useTheme();
  const [frequency, setFrequency] = useState(86400);
  const [startAt, setStartAt] = useState(formatDate(getTomorrow()));
  const [endAt, setEndAt] = useState('');
  const [maxRuns, setMaxRuns] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (visible) {
      setFrequency(86400);
      setStartAt(formatDate(getTomorrow()));
      setEndAt('');
      setMaxRuns('');
    }
  }, [visible, payload]);

  if (!visible || !payload) return null;

  const initializeSchedule = async () => {
    setSubmitting(true);
    try {
      const sessionToken = await getSessionToken();
      const response = await fetch(initializationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionToken,
          billType: payload.billType,
          billPayload: payload.billPayload,
          frequency,
          startAt,
          ...(endAt ? { endAt } : {}),
          ...(maxRuns ? { maxRuns: Number(maxRuns) } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || 'Unable to save scheduled bill');
      onSubmitted(result.data);
      onClose();
    } catch (error) {
      Alert.sheet('Schedule error', error.message || 'Unable to save scheduled bill');
    } finally {
      setSubmitting(false);
    }
  };

  const submitSchedule = () => {
    if (!payload?.billType || !payload?.billPayload) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startAt)) {
      Alert.sheet('Invalid date', 'Use YYYY-MM-DD for the start date.');
      return;
    }
    if (endAt && !/^\d{4}-\d{2}-\d{2}$/.test(endAt)) {
      Alert.sheet('Invalid date', 'Use YYYY-MM-DD for the end date.');
      return;
    }
    const tomorrowDate = getTomorrow();
    tomorrowDate.setHours(0, 0, 0, 0);
    const startDate = new Date(`${startAt}T00:00:00`);
    if (Number.isNaN(startDate.getTime()) || startDate < tomorrowDate) {
      Alert.sheet('Invalid date', 'The start date must be tomorrow or later.');
      return;
    }
    if (endAt) {
      const endDate = new Date(`${endAt}T00:00:00`);
      if (Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        Alert.sheet('Invalid date', 'The end date must be after the start date.');
        return;
      }
    }
    if (frequency === 0 && endAt) {
      Alert.sheet('Invalid schedule', 'A one-time schedule cannot have an end date.');
      return;
    }
    if (maxRuns && (!/^\d+$/.test(maxRuns) || Number(maxRuns) < 1 || (frequency === 0 && Number(maxRuns) > 1))) {
      Alert.sheet('Invalid schedule', frequency === 0 ? 'A one-time schedule can have a maximum of one run.' : 'Max runs must be a positive whole number.');
      return;
    }

    setShowPin(true);
  };

  const handlePinApproval = (status) => {
    setShowPin(false);
    if (status === 'approved') {
      initializeSchedule();
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
          <View style={styles.dragIndicator} />
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.sideItem}>
              <Ionicons name="close" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerText}>Schedule Preview</Text>
            <View style={styles.sideItem} />
          </View>

          <Text style={styles.sectionHeader}>Transaction Details</Text>
          <View style={styles.detailsCard}>
            {[{ label: 'Bill Type', value: `${String(payload.billType).charAt(0).toUpperCase()}${String(payload.billType).slice(1)}` }, ...reviewData].map((row, index, rows) => (
                <View key={`schedule-detail-${index}`} style={[styles.detailRow, index === rows.length - 1 && styles.lastDetailRow]}>
                  <View style={styles.labelWithIcon}>
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    {row.hasInfoIcon && (
                      <TouchableOpacity onPress={() => row.infoMessage && Alert.sheet(row.label, row.infoMessage)} style={styles.infoIconTouch}>
                        <Ionicons name="information-circle-outline" size={14} color="#000" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.detailValue, row.color && { color: row.color }]}>{row.value}</Text>
                </View>
            ))}
          </View>

          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Schedule Details</Text>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Frequency</Text>
          <View style={styles.frequencyRow}>
            {[{ label: 'Once', value: 0 }, { label: 'Daily', value: 86400 }, { label: 'Weekly', value: 604800 }, { label: 'Monthly', value: 2592000 }].map((option) => (
              <TouchableOpacity key={option.value} onPress={() => setFrequency(option.value)} style={[styles.frequencyOption, { borderColor: colors.border }, frequency === option.value && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                <Text style={[styles.frequencyText, { color: frequency === option.value ? '#FFFFFF' : colors.textSecondary }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Start date</Text>
          <TextInput value={startAt} onChangeText={setStartAt} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textDisabled} style={[styles.sheetInput, { color: colors.textPrimary, borderColor: colors.border }]} />
          {frequency !== 0 && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>End date (optional)</Text>
              <TextInput value={endAt} onChangeText={setEndAt} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textDisabled} style={[styles.sheetInput, { color: colors.textPrimary, borderColor: colors.border }]} />
            </>
          )}

          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: '#0F766E' }]} onPress={submitSchedule} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryActionText}>Create Schedule</Text>}
          </TouchableOpacity>
        </View>
        <PinVerify
          visible={showPin}
          isPayment
          onResult={handlePinApproval}
          onClose={() => setShowPin(false)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  sheetBackdrop: { flex: 1 },
  sheetContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  dragIndicator: { width: 46, height: 5, borderRadius: 999, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34, marginBottom: 8 },
  sideItem: { width: 36, alignItems: 'flex-start' },
  headerText: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#333' },
  sectionHeader: { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 12, marginBottom: 8 },
  sheetSubtitle: { fontSize: 12, marginBottom: 22 },
  detailsCard: { backgroundColor: '#F8F9FA', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 8, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', alignItems: 'flex-start' },
  lastDetailRow: { borderBottomWidth: 0 },
  labelWithIcon: { flexDirection: 'row', alignItems: 'center', flexBasis: '45%', maxWidth: '45%', minWidth: 0 },
  infoIconTouch: { marginLeft: 4, paddingTop: 1 },
  detailLabel: { fontSize: 11, color: '#666', flexShrink: 1 },
  detailValue: { fontSize: 11, fontWeight: '600', flexBasis: '55%', maxWidth: '55%', minWidth: 0, textAlign: 'right' },
  primaryAction: { borderRadius: 14, paddingVertical: 14, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  frequencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  frequencyOption: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  frequencyText: { fontSize: 10, fontWeight: '700' },
  sheetInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12 },
});

export default ScheduleReviewSheet;
