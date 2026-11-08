import React from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

export default function TransactionStatusCard({ transaction, rotate }) {
  const isSuccess = ['success', 'successful'].includes(transaction.status);
  const isFailed = transaction.status === 'failed';
  const isProcessing = ['pending', 'processing'].includes(transaction.status);

  // centralized state status mapping array
  const textStrings = {
    success: [
      "Your ", 
      transaction.transaction_type, 
      " of ", 
      `₦${parseFloat(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      " was successful and completed"
    ],
    processing: [
      "Your ", 
      transaction.transaction_type, 
      " of ", 
      `₦${parseFloat(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      " is processing and pending"
    ],
    failed: [
      "Your ", 
      transaction.transaction_type, 
      " transaction of ", 
      `₦${parseFloat(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      " could not be completed, if there are any issues, please contact support"
    ]
  };

  const getActiveArray = () => {
    if (isSuccess) return textStrings.success;
    if (isProcessing) return textStrings.processing;
    return textStrings.failed;
  };

  const getStatusColor = () => {
    if (isSuccess) return 'rgba(40, 167, 69, 1)'; 
    if (isFailed) return 'rgba(231, 76, 60, 1)'; 
    return 'rgba(240, 173, 78, 1)'; 
  };

  const currentSegments = getActiveArray();

  return (
    <View style={styles.mainWrapper}>
      <View style={styles.badgeContainer}>
        {isProcessing && (
          <Animated.View 
            style={[
              styles.spinningRing, 
              { 
                transform: [{ rotate }],
                // Using the main status color accent for the loading spinner to pop from the light background
                borderTopColor: getStatusColor() 
              }
            ]} 
          />
        )}

        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Ionicons 
            name={isSuccess ? "checkmark" : isFailed ? "close" : "time"} 
            size={22} 
            color="rgba(255, 255, 255, 1)" 
          />
        </View>
      </View>

      <View style={styles.textGroup}>
        <Text style={[styles.titleText, { color: getStatusColor() }]}>{transaction.message}</Text>
        <Text style={styles.descriptionText}>
          {currentSegments[0]}
          <Text style={styles.boldText}>{currentSegments[1]}</Text>
          {currentSegments[2]}
          <Text style={styles.boldText}>{currentSegments[3]}</Text>
          {currentSegments[4]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  badgeContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  spinningRing: {
    position: 'absolute',
    width: 56, // padded slightly wider than the badge for an outer-ring effect
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderRightColor: 'rgba(0, 0, 0, 0)',
    borderBottomColor: 'rgba(0, 0, 0, 0)',
    borderLeftColor: 'rgba(0, 0, 0, 0)',
    zIndex: 2,
  },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 1)', // White rim looks crisp sitting on the soft green/grey gradient
    zIndex: 1,
  },
  textGroup: {
    alignItems: 'center',
    width: '100%',
    minHeight: 100,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: 'rgba(74, 85, 104, 1)', // Deep slate grey for clean readability on high-key backgrounds
    textAlign: 'center',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '700', 
    letterSpacing: 0.2,
    color: 'rgba(26, 32, 44, 1)', // Solid dark charcoal to make key elements stand out firmly
  },
});