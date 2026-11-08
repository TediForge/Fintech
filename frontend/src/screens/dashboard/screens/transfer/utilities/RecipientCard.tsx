import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const styles = StyleSheet.create({
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginBottom: 20,
  },
  recipientLabel: {
    fontSize: 11,
    color: '#166534',
    opacity: 0.7,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
});

export const RecipientCard = ({ recipientInfo }) => {
  if (recipientInfo.error) {
    return (
      <View style={[styles.recipientCard, { borderColor: '#fee2e2', backgroundColor: '#fef2f2' }]}>
        <Ionicons name="alert-circle" size={20} color="#dc2626" />
        <Text style={[styles.recipientName, { color: '#dc2626' }]}>{recipientInfo.error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.recipientCard}>
      <Ionicons name="checkmark-circle" size={20} color="#059669" />
      <View style={{ marginLeft: 10 }}>
        <Text style={styles.recipientLabel}>Recipient Name</Text>
        <Text style={styles.recipientName}>{recipientInfo.name}</Text>
      </View>
    </View>
  );
};