import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const PlaceholderBlock = ({ height = 16, width = '100%', style }) => (
  <View style={[styles.placeholder, { height, width }, style]} />
);

const TransactionAnalysisSkeleton = () => (
  <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
    <View style={styles.heroCard}>
      <PlaceholderBlock height={24} width="70%" style={{ marginBottom: 16 }} />
      <PlaceholderBlock height={40} width="90%" style={{ marginBottom: 16 }} />
      <PlaceholderBlock height={14} width="50%" style={{ marginBottom: 16 }} />
      <View style={styles.heroRow}>
        <PlaceholderBlock height={64} width="48%" style={{ marginBottom: 0 }} />
        <PlaceholderBlock height={64} width="48%" style={{ marginBottom: 0 }} />
      </View>
    </View>

    <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
      <PlaceholderBlock height={100} width={CARD_WIDTH} style={{ marginBottom: 0 }} />
      <PlaceholderBlock height={100} width={CARD_WIDTH} style={{ marginBottom: 0 }} />
    </View>

    <View style={[styles.card, { height: 220 }]}>
      <PlaceholderBlock height={18} width="40%" style={{ marginBottom: 16 }} />
      <PlaceholderBlock height={140} width="100%" />
    </View>

    <View style={[styles.card, { height: 220 }]}>
      <PlaceholderBlock height={18} width="40%" style={{ marginBottom: 16 }} />
      <PlaceholderBlock height={140} width="100%" />
    </View>

    <View style={[styles.card, { paddingVertical: 20 }]}> 
      {[...Array(4)].map((_, index) => (
        <View key={`list-${index}`} style={styles.listItem}>
          <PlaceholderBlock height={14} width="30%" style={{ marginBottom: 8 }} />
          <PlaceholderBlock height={14} width="45%" />
        </View>
      ))}
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#eff7f4',
  },
  heroCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#0a0f14',
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0a0f14',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  placeholder: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
});

export default React.memo(TransactionAnalysisSkeleton);
