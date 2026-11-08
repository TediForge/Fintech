import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import CardFeatures from '../utilities/CardFeatures';

const PhysicalCardPage = () => {
  // Logic to manage which "page" version to show
  // 'initial' = page001, 'ordering' = page002, 'final' = page003
  const [currentPage, setCurrentPage] = useState('initial');

  // PAGE 001: Initial state for users who have no physical card yet
  const renderPage001 = () => (
    <View style={styles.componentContainer}>
      <CardFeatures
        type="physical"
        onActionPress={() => setCurrentPage('ordering')}
        card={{
          cardHolder: 'Daniel Chukwudi',
          cardNumber: '9097 2680 1234 5678',
          backgroundColor: '#1a1a1a',
        }}
      />
    </View>
  );

  // PAGE 002: Ordering process state (e.g., address, delivery options)
  const renderPage002 = () => (
    <View style={styles.componentContainer}>
      {/* PAGE 002: ORDERING STATE 
          This section is reserved for the physical card delivery details.
      */}
      <Text style={styles.placeholderText}>Delivery & Shipping Details (Page 002)</Text>
      <TouchableOpacity 
        style={[styles.orderButton, { marginTop: 20, backgroundColor: '#666' }]} 
        onPress={() => setCurrentPage('initial')}
      >
        <Text style={styles.orderButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  // PAGE 003: Final Physical Card view state (Tracking/Activation)
  const renderPage003 = () => (
    <View style={styles.componentContainer}>
      {/* PAGE 003: FINAL CARD PAGE 
          This section is for card tracking or post-activation settings.
      */}
      <Text style={styles.placeholderText}>Card Tracking & Activation (Page 003)</Text>
    </View>
  );

  return (
    <ScrollView 
      showsVerticalScrollIndicator={false} 
      contentContainerStyle={styles.scrollContent}
      bounces={true}
    >
      {currentPage === 'initial' && renderPage001()}
      {currentPage === 'ordering' && renderPage002()}
      {currentPage === 'final' && renderPage003()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  componentContainer: { 
    width: '100%' 
  },
  centerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardContainer2: {
    width: '98%',
  },
  componentContainer: { 
    width: '100%' 
  },
 orderButton: {
    backgroundColor: '#0E3C2E',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  }, 
  orderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  cardWrapper: {
    width: '100%',
    marginBottom: 30,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  smallCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
  },
  cardTitle: { 
    fontSize: 16.5, 
    fontWeight: '700', 
    color: '#0E3C2E', 
    marginBottom: 12 
  },
  cardText: { 
    fontSize: 14, 
    color: '#444', 
    marginBottom: 8, 
    fontWeight: '500' 
  },
  comingSoonContainer: {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
});

export default PhysicalCardPage;