import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const scale = width / 410;

const GhanaKycComponent = () => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Ghana KYC</Text>
        <Text style={styles.subtitle}>Ghana-specific KYC flow placeholder.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20 * scale,
    paddingBottom: 40,
    paddingTop: 20,
  },
  container: {
    paddingVertical: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0E3C2E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
});

export default GhanaKycComponent;
