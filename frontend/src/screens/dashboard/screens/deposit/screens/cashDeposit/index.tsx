import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import BankCard from '../../bank/bankDeposit';

const CashDepositScreen = () => (
  <LinearGradient colors={['#e6f2ed', '#f5f8f7']} style={styles.container}>
    <ScreenHeader title="Cash Deposit" backgroundColor="#e6f2ed" textColor="#000" iconColor="#000" />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Deposit cash into your wallet</Text>
      <Text style={styles.subtitle}>Use one of your linked bank or agent accounts to make a cash deposit.</Text>
      <BankCard />
      <View style={styles.note}>
        <Text style={styles.noteTitle}>How it works</Text>
        <Text style={styles.noteText}>Deposit cash into the account shown above. Your wallet balance updates after the transfer is confirmed.</Text>
      </View>
    </ScrollView>
  </LinearGradient>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#14251F', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#64748B', lineHeight: 20, marginBottom: 16 },
  note: { backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 16, padding: 16, marginTop: 18 },
  noteTitle: { color: '#0E3C2E', fontSize: 15, fontWeight: '800', marginBottom: 6 },
  noteText: { color: '#64748B', lineHeight: 20 },
});

export default CashDepositScreen;
