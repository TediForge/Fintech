import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * ValidationStatus Component
 * A unified component to handle account verification and customer info display.
 * * @param {boolean} isValidating - Shows the loading indicator and verifying text.
 * @param {object} customerInfo - The customer data object.
 * @param {string} brandColor - The primary theme color for the UI.
 */
const ValidationStatus = ({ 
  isValidating, 
  customerInfo, 
  brandColor = '#0E3C2E' 
}) => {
  if (!isValidating && !customerInfo) return null;

  return (
    <View style={styles.container}>
      {/* Loading State */}
      {isValidating && (
        <View style={styles.validatingBox}>
          <ActivityIndicator size="small" color={brandColor} />
          <Text style={[styles.validatingText, { color: brandColor }]}>Verifying account...</Text>
        </View>
      )}

      {/* Info/Error Display */}
      {customerInfo && (
        <View style={[styles.customerCard, customerInfo.error && styles.customerCardError]}>
          <View style={styles.customerCardIcon}>
            <Ionicons 
              name={customerInfo.error ? "close-circle" : "checkmark-circle"} 
              size={22} 
              color={customerInfo.error ? "#D32F2F" : brandColor} 
            />
          </View>
          
          <View style={styles.customerCardContent}>
            <Text style={styles.customerLabel}>
              {customerInfo.error ? "Status" : (customerInfo.label || "Verified Name")}
            </Text>
            
            <Text style={styles.customerName}>
              {customerInfo.error ? customerInfo.error : customerInfo.name}
            </Text>

            {!customerInfo.error && (
              <>
                {/* Handles Plan & Due Date format */}
                {(customerInfo.plan || customerInfo.dueDate) && (
                  <Text style={styles.customerSubText}>
                    {customerInfo.plan}{customerInfo.dueDate ? ` • Due: ${customerInfo.dueDate}` : ''}
                  </Text>
                )}
                
                {/* Handles Address format */}
                {customerInfo.address && (
                  <Text style={styles.customerSubText}>{customerInfo.address}</Text>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  validatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    marginBottom: 10,
  },
  validatingText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  customerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8F1EE',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  customerCardError: {
    borderColor: '#FFEBEE',
    backgroundColor: '#FFF8F8',
  },
  customerCardIcon: {
    marginRight: 14,
  },
  customerCardContent: {
    flex: 1,
  },
  customerLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0E3C2E',
  },
  customerSubText: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
    fontWeight: '400',
  },
});

export default ValidationStatus;