import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RecipientCard } from './RecipientCard';

const BRAND_COLOR = '#0E3C2E';

const styles = StyleSheet.create({
  mainTransferFormContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  validatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  validatingText: {
    marginLeft: 10,
    color: '#64748B',
    fontSize: 13,
  },
  fullProceedBtn: {
    backgroundColor: BRAND_COLOR,
    height: 45,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proceedBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  // ==========================================
  // INPUT FIELDS AND SELECTORS
  // ==========================================
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 20,
  },
  bankSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 20,
  },
  bankSelectorText: {
    flex: 1,
    color: '#334155',
    fontSize: 15
  },
  inputIcon: {
    marginRight: 12
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500'
  },
});

export const BankTransferInput = ({ 
  selectedBank, 
  setSelectedBank, 
  accountNumber, 
  setAccountNumber, 
  verifyAccount,
  openBankSheet,
  isValidating,
  recipientInfo,
  isDataReady,
  handleNextStep,
}) => {
  return (
    <View style={styles.mainTransferFormContainer}>
      <Text style={styles.inputLabel}>Select Bank</Text>
      <TouchableOpacity style={styles.bankSelector} onPress={openBankSheet}>
        <Ionicons name="business-outline" size={20} color={BRAND_COLOR} style={styles.inputIcon} />
        <Text style={styles.bankSelectorText}>{selectedBank?.bankName || 'Select Bank'}</Text>
        <Ionicons name="chevron-down" size={18} color="#666" />
      </TouchableOpacity>

      <Text style={styles.inputLabel}>Account Number</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="card-outline" size={20} color={BRAND_COLOR} style={styles.inputIcon} />
        <TextInput
          style={styles.textInput}
          placeholder="0123456789"
          keyboardType="numeric"
          maxLength={10}
          value={accountNumber}
          onChangeText={(val) => {
            setAccountNumber(val);
            if (val.length === 10) verifyAccount(val, selectedBank?.bankCode);
          }}
        />
      </View>

      {isValidating && (
        <View style={styles.validatingBox}>
          <ActivityIndicator size="small" color={BRAND_COLOR} />
          <Text style={styles.validatingText}>Verifying recipient...</Text>
        </View>
      )}

      {recipientInfo && <RecipientCard recipientInfo={recipientInfo} />}

      <TouchableOpacity style={styles.fullProceedBtn} onPress={handleNextStep} activeOpacity={0.9}>
        <Text style={styles.proceedBtnText}>
          {isDataReady ? 'Next Step' : 'Validate Account'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};