import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SwipeTrack from './utilities/SwipeTrack';

const { height: screenHeight } = Dimensions.get('window');
const BRAND_COLOR = '#0E3C2E';
const BRAND_GREEN = '#1E8E3E';

const formatAmount = (amount, currency = '₦') => {
  const numeric = Number(amount || 0);
  if (Number.isNaN(numeric)) return `${currency}0.00`;
  return `${currency}${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function CreditTransactionReviewScreen({
  data,
  visible,
  onClose,
  onConfirm,
  submitting = false,
}) {
  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const [swipeResetKey, setSwipeResetKey] = useState(0);

  const getVisibleDetailRows = (d) => {
    if (!d) return [];
    if (Array.isArray(d.summaryRows) && d.summaryRows.length) {
      return d.summaryRows;
    }
    // Fallback for unstructured data, can be removed if all calls are standardized
    const rows = [];
    Object.keys(d).forEach(key => {
      if (['visible', 'onClose', 'onConfirm', 'icon', 'title', 'subtitle', 'payoutAmount', 'confirmLabel'].includes(key)) return;
      if (d[key]) {
        rows.push({
          label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          value: String(d[key])
        });
      }
    });
    return rows;
  };

  const visibleRows = useMemo(() => getVisibleDetailRows(data), [data]);

  useEffect(() => {
    // Reset state on hide
    if (!visible) {
      animValue.setValue(screenHeight);
      overlayOpacity.setValue(0);
      sheetOpacity.setValue(0);
      return;
    }

    // Animate in on show
    Animated.parallel([
      Animated.spring(animValue, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animValue, overlayOpacity, sheetOpacity, visible]);

  // Centralized confirm handler
  const handleConfirm = () => {
    if (typeof onConfirm === 'function') {
      onConfirm();
    } else {
      // Default behavior if onConfirm is not provided
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheetContainer,
          {
            opacity: sheetOpacity,
            transform: [{ translateY: animValue }],
          },
        ]}
      >
        <View style={styles.dragIndicator} />

        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.sideItem}>
            <Ionicons name="close" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Review Request</Text>
          <View style={styles.sideItem} />
        </View>

        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {data?.payoutAmount !== undefined && data?.payoutAmount !== null && Number(data.payoutAmount) > 0 && (
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>You Will Receive</Text>
              <Text style={styles.amountValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatAmount(data.payoutAmount, '₦')}
              </Text>
            </View>
          )}

          <Text style={styles.sectionHeader}>Transaction Details</Text>

          {visibleRows.length > 0 && (
            <View style={styles.detailsCard}>
              {visibleRows.map((row, index) => (
                <View
                  key={`credit-row-${index}`}
                  style={[
                    styles.detailRow,
                    index === visibleRows.length - 1 && styles.lastDetailRow,
                  ]}
                >
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={[styles.detailValue, row.color && { color: row.color }]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <SwipeTrack
            onConfirm={handleConfirm}
            label={data?.confirmLabel || 'Swipe to Continue'}
            finishLabel={data?.finishLabel || 'Release to Proceed'}
            disabled={submitting}
            resetTrigger={swipeResetKey}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    maxHeight: '85%',
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    width: '100%',
  },
  sideItem: {
    flex: 1,
  },
  headerText: {
    flex: 2,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
    color: '#1A1A1A',
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  amountContainer: {
    alignItems: 'center', // This is correct
    marginVertical: 3, // Match Debit
    gap: -4, // Match Debit
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  amountValue: {
    fontSize: 25, // Match Debit
    fontWeight: '800', // Match Debit
    color: BRAND_GREEN, // Keep brand color for credit
  },
  symbol: {
    fontSize: 15, // Match Debit
    fontWeight: '600', // Match Debit
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginTop: 18,
    marginBottom: 8,
  },
  detailsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 15, // Match Debit
    paddingHorizontal: 15,
    paddingVertical: 8,
    // No margin bottom here, handled by swipe section
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8, // Match Debit
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0', // Match Debit
  },
  lastDetailRow: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A1A1A', // Match Debit text color
    textAlign: 'right',
  },
});
