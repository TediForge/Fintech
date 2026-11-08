import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@components/headers/ScreenHeader';
import {
  getDateRangeForMonth,
  getPreviousMonthRange,
  summarizeTransactions,
  compareMonthSummary,
  buildInsights,
  getFinancialHealthScore,
  formatCurrency,
  formatPercent,
  getMonthYearLabel,
} from './utilities/analysisUtils';
import {
  DonutChart,
  TrendLineChart,
  ProgressBar,
} from './utilities/analysisCharts';
import TransactionAnalysisSkeleton from './utilities/TransactionAnalysisSkeleton';
import config from '@config/app';
import { apiConfig } from '@config/api';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

const api = apiConfig.baseUrl;
const API_URL = `${api}/v1/user/transactions/history.php`;

const { width } = Dimensions.get('window');

const TransactionAnalysisScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const selectedMonth = route.params?.month || new Date().toLocaleString('default', { month: 'long' });
  const selectedYear = route.params?.year || new Date().getFullYear().toString();

  const [transactions, setTransactions] = useState([]);
  const [previousTransactions, setPreviousTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await getSessionToken();
        setSessionToken(token);
      } catch (error) {
        console.error('TransactionAnalysisScreen token error:', error);
      }
    };

    loadToken();
  }, []);

  useEffect(() => {
    const fetchAnalysisData = async () => {
      if (!sessionToken) return;
      setLoading(true);
      setErrorMessage('');

      try {
        const { startDate, endDate, daysInMonth } = getDateRangeForMonth(selectedMonth, selectedYear);
        const prevRange = getPreviousMonthRange(selectedMonth, selectedYear);

        const payload = {
          [config.sessionToken]: sessionToken,
          category: null,
          status: null,
          startDate,
          endDate,
          page: 1,
          limit: 200,
        };

        const prevPayload = {
          [config.sessionToken]: sessionToken,
          category: null,
          status: null,
          startDate: prevRange.startDate,
          endDate: prevRange.endDate,
          page: 1,
          limit: 200,
        };

        const [currentRes, previousRes] = await Promise.all([
          fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
          fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prevPayload),
          }),
        ]);

        const currentData = await currentRes.json();
        const previousData = await previousRes.json();

        if (currentData.status === 'success') {
          setTransactions(Array.isArray(currentData.transactions) ? currentData.transactions : []);
        } else {
          setTransactions([]);
        }

        if (previousData.status === 'success') {
          setPreviousTransactions(Array.isArray(previousData.transactions) ? previousData.transactions : []);
        } else {
          setPreviousTransactions([]);
        }
      } catch (error) {
        console.error('Transaction analysis fetch error:', error);
        setTransactions([]);
        setPreviousTransactions([]);
        setErrorMessage('Network error. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [sessionToken, selectedMonth, selectedYear]);

  if (loading) {
    return (
      <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <SafeAreaView style={styles.safeArea}>
          <ScreenHeader
            title="Transaction Analysis"
            backgroundColor="transparent"
            textColor="#0E3C2E"
            iconColor="#0E3C2E"
            onBack={() => navigation.goBack()}
          />
          <TransactionAnalysisSkeleton />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const { daysInMonth } = getDateRangeForMonth(selectedMonth, selectedYear);
  const current = summarizeTransactions(transactions, daysInMonth);
  const previous = summarizeTransactions(previousTransactions, getPreviousMonthRange(selectedMonth, selectedYear).daysInMonth);
  const comparison = compareMonthSummary(current, previous);
  const insights = buildInsights(current, previous);
  const health = getFinancialHealthScore(current);
  const periodLabel = getMonthYearLabel(selectedMonth, selectedYear);

  const donutData = current.categoryBreakdown.slice(0, 4).map((item) => ({
    label: item.label,
    value: item.amount,
    color: item.color,
  }));

  const weeklyIncome = current.weeklyTrend.income;
  const weeklyExpense = current.weeklyTrend.expense;

  return (
    <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title="Transaction Analysis"
          backgroundColor="transparent"
          textColor="#0E3C2E"
          iconColor="#0E3C2E"
          onBack={() => navigation.goBack()}
        />

        {current.totalTransactions === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyContent} showsVerticalScrollIndicator={false}>
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="document-text-outline" size={56} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No Transactions Found</Text>
              <Text style={styles.emptyMessage}>
                {`No transactions recorded for ${periodLabel}. Try another month to uncover spending patterns.`}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('TransactionHistoryScreen')}
              >
                <Text style={styles.emptyButtonText}>View All Transactions</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Period Header */}
            <View style={styles.periodHeader}>
              <Text style={styles.periodTitle}>{periodLabel}</Text>
              <Text style={styles.periodSubtitle}>Your financial intelligence dashboard</Text>
            </View>

            {/* Executive Summary Card */}
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroLabel}>TOTAL FLOW</Text>
                  <Text style={styles.heroValue}>{formatCurrency(current.totalFlow)}</Text>
                </View>
                <View style={[styles.heroTrend, { backgroundColor: comparison.flowChange >= 0 ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Ionicons name={comparison.flowChange >= 0 ? 'arrow-up' : 'arrow-down'} size={14} color={comparison.flowChange >= 0 ? '#16A34A' : '#DC2626'} />
                  <Text style={[styles.heroTrendText, { color: comparison.flowChange >= 0 ? '#16A34A' : '#DC2626' }]}>
                    {comparison.flowChange >= 0 ? '+' : ''}{comparison.flowChange}%
                  </Text>
                </View>
              </View>

              <View style={styles.heroMetrics}>
                <View style={styles.heroMetricItem}>
                  <Text style={styles.heroMetricLabel}>Income</Text>
                  <Text style={[styles.heroMetricValue, { color: '#16A34A' }]}>{formatCurrency(current.totalIn)}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroMetricItem}>
                  <Text style={styles.heroMetricLabel}>Expense</Text>
                  <Text style={[styles.heroMetricValue, { color: '#DC2626' }]}>{formatCurrency(current.totalOut)}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroMetricItem}>
                  <Text style={styles.heroMetricLabel}>Savings</Text>
                  <Text style={[styles.heroMetricValue, { color: '#2563EB' }]}>{formatPercent(current.savingsRate)}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Financial Health Score */}
            <View style={styles.healthCard}>
              <View style={styles.healthHeader}>
                <Text style={styles.healthTitle}>Financial Health Score</Text>
                <View style={[styles.healthBadge, { backgroundColor: health.score >= 85 ? '#D1FAE5' : health.score >= 70 ? '#FEF3C7' : '#FEE2E2' }]}>
                  <Text style={[styles.healthBadgeText, { color: health.score >= 85 ? '#16A34A' : health.score >= 70 ? '#CA8A04' : '#DC2626' }]}>
                    {health.label}
                  </Text>
                </View>
              </View>
              <View style={styles.healthScore}>
                <Svg width={120} height={120} viewBox="0 0 120 120">
                  <Circle cx="60" cy="60" r="52" fill="none" stroke="#E2E8F0" strokeWidth="8" />
                  <Circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={health.score >= 85 ? '#16A34A' : health.score >= 70 ? '#F59E0B' : '#DC2626'}
                    strokeWidth="8"
                    strokeDasharray={`${(health.score / 100) * 327} 327`}
                    strokeLinecap="round"
                    rotation="-90"
                    originX="60"
                    originY="60"
                  />
                  <SvgText x="60" y="55" textAnchor="middle" fontSize="28" fontWeight="800" fill="#0F172A">
                    {health.score}
                  </SvgText>
                  <SvgText x="60" y="75" textAnchor="middle" fontSize="12" fill="#64748B">
                    /100
                  </SvgText>
                </Svg>
              </View>
            </View>

            {/* Income vs Spending Trend */}
            {weeklyIncome.some((v) => v > 0) || weeklyExpense.some((v) => v > 0) ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Weekly Cash Flow</Text>
                <TrendLineChart income={weeklyIncome} expense={weeklyExpense} labels={['W1', 'W2', 'W3', 'W4']} width={width - 56} height={160} />
              </View>
            ) : null}

            {/* Spending Distribution */}
            {donutData.length > 0 ? (
              <View style={[styles.sectionCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <View>
                  <Text style={styles.sectionTitle}>Spending Distribution</Text>
                  <Text style={styles.sectionSubtitle}>Top categories by amount</Text>
                </View>
                <DonutChart data={donutData} size={140} strokeWidth={16} innerLabel={`${current.topCategories.length}\nCats`} />
              </View>
            ) : null}

            {/* Category Leaderboard */}
            {current.topCategories.length > 0 ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Category Breakdown</Text>
                {current.topCategories.slice(0, 5).map((item, index) => (
                  <View key={`category-${index}`} style={styles.leaderboardItem}>
                    <View style={styles.leaderboardRank}>
                      <Text style={styles.leaderboardRankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.leaderboardLabel}>
                      <Text style={styles.leaderboardLabelText}>{item.label}</Text>
                      <Text style={styles.leaderboardAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                    <ProgressBar value={item.amount} max={current.topCategories[0].amount} color={item.color} />
                  </View>
                ))}
              </View>
            ) : null}

            {/* Key Metrics */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Average Transaction</Text>
                <Text style={styles.metricBoxValue}>{formatCurrency(current.averageTransaction)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Largest Transaction</Text>
                <Text style={styles.metricBoxValue}>{formatCurrency(current.largestTransaction)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Daily Average</Text>
                <Text style={styles.metricBoxValue}>{formatCurrency(current.averageDailySpend)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Success Rate</Text>
                <Text style={styles.metricBoxValue}>{formatPercent(current.successRate)}</Text>
              </View>
            </View>

            {/* Transaction Success Analytics */}
            {current.statusBreakdown.length > 0 ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Transaction Status</Text>
                {current.statusBreakdown.slice(0, 4).map((item, index) => (
                  <View key={`status-${index}`} style={styles.statusItem}>
                    <View style={styles.statusLabel}>
                      <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                      <Text style={styles.statusText}>{item.label}</Text>
                    </View>
                    <Text style={styles.statusPercent}>{item.percentage}%</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Month-over-Month Comparison */}
            {previous.totalTransactions > 0 ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Month-over-Month</Text>
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Income</Text>
                    <Text style={styles.comparisonValue}>{formatCurrency(current.totalIn)}</Text>
                    <Text style={[styles.comparisonChange, { color: comparison.incomeChange >= 0 ? '#16A34A' : '#DC2626' }]}>
                      {comparison.incomeChange >= 0 ? '+' : ''}{comparison.incomeChange}% from last month
                    </Text>
                  </View>
                  <View style={styles.comparisonDivider} />
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Spending</Text>
                    <Text style={styles.comparisonValue}>{formatCurrency(current.totalOut)}</Text>
                    <Text style={[styles.comparisonChange, { color: comparison.spendingChange <= 0 ? '#16A34A' : '#DC2626' }]}>
                      {comparison.spendingChange >= 0 ? '+' : ''}{comparison.spendingChange}% from last month
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Smart Insights */}
            {insights.length > 0 ? (
              <View style={styles.insightsCard}>
                <View style={styles.insightsHeader}>
                  <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
                  <Text style={styles.insightsTitle}>Smart Insights</Text>
                </View>
                {insights.map((insight, index) => (
                  <View key={`insight-${index}`} style={styles.insightItem}>
                    <View style={styles.insightBullet} />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#842029" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Return Button */}
            <TouchableOpacity style={styles.returnButton} onPress={() => navigation.navigate('TransactionHistoryScreen')}>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
              <Text style={styles.returnButtonText}>View All Transactions</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  emptyContent: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  emptyStateContainer: { alignItems: 'center', width: '100%' },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  emptyMessage: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 20, maxWidth: 280 },
  emptyButton: { backgroundColor: '#16A34A', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  emptyButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  periodHeader: { marginBottom: 28 },
  periodTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  periodSubtitle: { fontSize: 13, color: '#64748B', lineHeight: 20 },
  heroCard: { backgroundColor: '#fff', borderRadius: 28, padding: 24, marginBottom: 24, shadowColor: '#0a0f14', shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  heroLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  heroValue: { fontSize: 32, fontWeight: '800', color: '#0F172A' },
  heroTrend: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTrendText: { fontSize: 12, fontWeight: '700' },
  heroMetrics: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroMetricItem: { flex: 1 },
  heroMetricLabel: { fontSize: 10, fontWeight: '600', color: '#64748B', marginBottom: 6, textTransform: 'uppercase' },
  heroMetricValue: { fontSize: 18, fontWeight: '800' },
  heroDivider: { width: 1, height: 40, backgroundColor: '#F1F5F9', marginHorizontal: 8 },
  healthCard: { backgroundColor: '#fff', borderRadius: 28, padding: 24, marginBottom: 24, shadowColor: '#0a0f14', shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  healthTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  healthBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  healthBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  healthScore: { alignItems: 'center', justifyContent: 'center', height: 140 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 28, padding: 24, marginBottom: 24, shadowColor: '#0a0f14', shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  sectionSubtitle: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  leaderboardItem: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  leaderboardRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  leaderboardRankText: { fontSize: 12, fontWeight: '800', color: '#0E3C2E' },
  leaderboardLabel: { marginBottom: 8 },
  leaderboardLabelText: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  leaderboardAmount: { fontSize: 12, color: '#64748B' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metricBox: { flex: 1, minWidth: (width - 52) / 2, backgroundColor: '#fff', borderRadius: 18, padding: 16, shadowColor: '#0a0f14', shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  metricBoxLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 8, textTransform: 'uppercase' },
  metricBoxValue: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  statusItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  statusLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  statusPercent: { fontSize: 13, fontWeight: '800', color: '#0E3C2E' },
  comparisonRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  comparisonItem: { flex: 1 },
  comparisonLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 6, textTransform: 'uppercase' },
  comparisonValue: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  comparisonChange: { fontSize: 11, fontWeight: '700' },
  comparisonDivider: { width: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },
  insightsCard: { backgroundColor: '#FEFCE8', borderRadius: 28, padding: 24, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  insightsTitle: { fontSize: 16, fontWeight: '800', color: '#78350F' },
  insightItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  insightBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B', marginTop: 8 },
  insightText: { flex: 1, fontSize: 12, color: '#78350F', lineHeight: 18, fontWeight: '500' },
  errorBox: { backgroundColor: '#F8D7DA', borderRadius: 16, padding: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorText: { color: '#842029', fontSize: 12, fontWeight: '600', flex: 1 },
  returnButton: { backgroundColor: '#16A34A', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  returnButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default TransactionAnalysisScreen;
