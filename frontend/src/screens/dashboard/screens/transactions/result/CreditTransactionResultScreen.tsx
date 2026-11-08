import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';
import LoadingScreen from '@components/Loading/LoadingScreen';
import { formatDate } from '@lib/utils/format';

const BRAND_COLOR = '#0E3C2E';
const BRAND_GREEN = '#1E8E3E';
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 0;
const API_URL = `${apiConfig.baseUrl}/v1/user/transactions/history.php`;

const normalizeStatus = (value) => String(value || 'submitted').trim().toLowerCase();

const formatAmount = (value) => `₦${Math.abs(Number(value || 0)).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export default function CreditTransactionResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { reference, transaction } = route.params || {};
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchTransaction = useCallback(async () => {
    if (!reference) return;

    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) return;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionReference: reference,
          [config.sessionToken]: sessionToken,
        }),
      });
      const result = await response.json();

      if (result?.status === 'success' && result.details) {
        setDetails(result.details);
      }
    } catch (error) {
      console.error('Credit transaction fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    if (!reference) {
      setLoading(false);
      return undefined;
    }

    fetchTransaction();
    pollRef.current = setInterval(fetchTransaction, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchTransaction, reference]);

  const status = normalizeStatus(details?.status);
  const statusLabel = ['success', 'successful', 'completed'].includes(status)
    ? 'Completed'
    : ['failed', 'declined'].includes(status)
      ? 'Failed'
      : 'Submitted';
  const transactionType = details?.transaction_type || details?.service_name || 'Credit request';
  const formattedCreatedAt = details?.created_at ? formatDate(details.created_at) : '';
  const summaryRows = details ? [
    { label: 'Amount', value: formatAmount(details.amount) },
    { label: 'Method', value: details.service_name || details.transaction_type || 'Credit' },
    ...(details.status ? [{ label: 'Status', value: statusLabel }] : []),
    ...(formattedCreatedAt ? [{ label: 'Date', value: formattedCreatedAt }] : []),
  ] : (Array.isArray(transaction?.summaryRows) ? transaction.summaryRows : []);

  const handleGoHome = () => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Dashboard' }] }));
  };

  if (loading) return <LoadingScreen visible message="Fetching transaction details" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.closeIconBtn} onPress={handleGoHome} activeOpacity={0.7}>
          <View style={styles.vectorXIconContainer}>
            <View style={[styles.vectorLine, styles.lineRotationLeft]} />
            <View style={[styles.vectorLine, styles.lineRotationRight]} />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>✓</Text>
          </View>
          <Text style={styles.heroTitle}>Credit Request {statusLabel}</Text>
          <Text style={styles.heroSubtitle}>
            {status === 'failed' || status === 'declined'
              ? 'Your credit request could not be completed.'
              : `Your ${transactionType} is being tracked and will be updated shortly.`}
          </Text>
        </View>

        {reference ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Reference</Text>
            <Text style={styles.infoValue}>{reference}</Text>
          </View>
        ) : null}

        {summaryRows.length > 0 ? (
          <View style={styles.detailsCard}>
            {summaryRows.map((row, index) => (
              <View
                key={`credit-result-${index}`}
                style={[styles.detailRow, index === summaryRows.length - 1 && styles.lastDetailRow]}
              >
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={[styles.detailValue, row.color && { color: row.color }]} numberOfLines={2}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={handleGoHome}>
          <Text style={styles.primaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eff7f4',
  },
  headerBar: {
    width: '100%',
    paddingTop: STATUS_BAR_HEIGHT + 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 20,
  },
  closeIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26, 40, 34, 0.05)',
  },
  vectorXIconContainer: {
    width: 10,
    height: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vectorLine: {
    position: 'absolute',
    width: 12,
    height: 1.5,
    backgroundColor: '#1c2824',
    borderRadius: 1,
  },
  lineRotationLeft: {
    transform: [{ rotate: '45deg' }],
  },
  lineRotationRight: {
    transform: [{ rotate: '-45deg' }],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F8EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 24,
    fontWeight: '800',
    color: BRAND_GREEN,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_COLOR,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  lastDetailRow: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    flexBasis: '45%',
    maxWidth: '45%',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_COLOR,
    flexBasis: '55%',
    maxWidth: '55%',
    textAlign: 'right',
    flexShrink: 1,
  },
  primaryBtn: {
    backgroundColor: BRAND_COLOR,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
