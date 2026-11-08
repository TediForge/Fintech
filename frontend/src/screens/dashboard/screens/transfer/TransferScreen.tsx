import { Alert } from '@components/common/Alert';
import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import ScreenHeader from '@components/headers/ScreenHeader';
import LoadingScreen from '@components/Loading/LoadingScreen';
import DebitTransactionReviewScreen from '../transactions/review/DebitTransactionReviewScreen';

// Separate Component Imports
import { Page1Content } from './utilities/Page1Content';
import TransferDetails02 from './utilities/TransferDetails02';
import BankSelectionSheet from './utilities/BankSelectionSheet';
import useTransfer from './shared/useTransfer';


const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
});

export default function TransferScreen({ navigation, route }) {
  const { loading: sessionLoading } = useApiClient();
  const [currentPage, setCurrentPage] = useState(1);
  
  const [processing, setProcessing] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);
  const [accountNumber, setAccountNumber] = useState('');
  
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [confirmData, setConfirmData] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmReviewData, setConfirmReviewData] = useState(null);
  const [isBankSheetVisible, setIsBankSheetVisible] = useState(false);
  
  const {
    sessionToken,
    recentBankBeneficiaries,
    isValidating,
    recipientInfo,
    processing: verificationProcessing,
    verifyAccount,
    getTransactionFee,
    resetVerification,
  } = useTransfer({ onSilentVerificationSuccess: () => setCurrentPage(2) });

  const handleAccountNumberChange = useCallback((value) => {
    resetVerification();
    setAccountNumber(value);
  }, [resetVerification]);

  const handleBankChange = useCallback((bank) => {
    resetVerification();
    setSelectedBank(bank);
  }, [resetVerification]);

  const handleBankSheetClose = useCallback(() => {
    console.log('[TransferScreen][bank-sheet-close-requested]', {
      timestamp: new Date().toISOString(),
    });
    setIsBankSheetVisible(false);
  }, []);

  const handleOpenBankSheet = useCallback(() => {
    console.log('[TransferScreen][bank-sheet-tap-received]', {
      timestamp: new Date().toISOString(),
      wasVisible: isBankSheetVisible,
      bankCount: recentBankBeneficiaries.length,
    });
    setIsBankSheetVisible(true);
  }, [isBankSheetVisible, recentBankBeneficiaries.length]);

  const handleBankSheetSelect = useCallback((bank) => {
    handleBankChange(bank);
    setIsBankSheetVisible(false);
    if (accountNumber.length === 10) verifyAccount(accountNumber, bank.bankCode);
  }, [accountNumber, handleBankChange, verifyAccount]);

  

  const handleProceed = async () => {
    const limits = { min: 100, max: 50000 };
    const amountNum = parseFloat(amount);
    if (!amount || amountNum < limits.min) return Alert.sheet('Error', `Minimum is ₦${limits.min}`);
    setProcessing(true);

    // fetch fee based on selected bank code and include in payload (Airtime pattern)
    let fee = 0;
    try {
      fee = await getTransactionFee(selectedBank?.bankCode);
    } catch (e) { fee = 0 }

    const dataPayload = {
      amount,
      [config.sessionToken]: sessionToken,
      request: 'transfer',
      bankCode: selectedBank?.bankCode,
      beneficiaryAccountNumber: accountNumber,
      bankName: selectedBank?.bankName,
      accountName: recipientInfo?.name,
      fee: fee || 0,
    };
    // Respect user's narration: include the key always; send empty string if user left it blank
    const narrationValue = (typeof narration === 'string') ? narration.trim() : '';
    dataPayload.narration = narrationValue;

    setTimeout(() => {
      setProcessing(false);
      setConfirmData(dataPayload);
      const fmt = (v) => `₦${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const rows = [
        { label: 'Amount', value: fmt(dataPayload.amount) },
        { label: 'Beneficiary', value: dataPayload.accountName },
        { label: 'Bank', value: dataPayload.bankName },
        { label: 'Account Number', value: dataPayload.beneficiaryAccountNumber },
        { label: 'Transaction Fee', value: fmt(dataPayload.fee), hasInfoIcon: true, infoMessage: 'This charge covers processing of this payment' },
      ];
      setConfirmReviewData(rows);
      setConfirmVisible(true);
    }, 800);
  };

  if (sessionLoading) return <LoadingScreen visible={true} message="Syncing session" />;

  const isDataReady = recipientInfo && !recipientInfo.error && !isValidating;

  return (
    <View style={{ flex: 1, backgroundColor: '#eff7f4' }}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      
        <ScreenHeader
        backgroundColor="#eff7f4" textColor="#000" iconColor="#000" 
        title={currentPage === 1 ? "Transfer" : "Amount & Narration"}
        onBack={() => {
          if (currentPage === 2) { setCurrentPage(1); return }
          navigation.goBack();
        }}
      />

      {currentPage === 1 ? (
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Page1Content
            accountNumber={accountNumber}
            setAccountNumber={handleAccountNumberChange}
            selectedBank={selectedBank}
            setSelectedBank={handleBankChange}
            isValidating={isValidating}
            recipientInfo={recipientInfo}
            isDataReady={isDataReady}
            handleNextStep={() => {
              if(isDataReady) setCurrentPage(2);
              else {
                verifyAccount(accountNumber, selectedBank?.bankCode);
              }
            }}
            recentBankBeneficiaries={recentBankBeneficiaries}
            verifyAccount={verifyAccount}
            navigation={navigation}
            openBankSheet={handleOpenBankSheet}
          />
        </ScrollView>
      ) : (
        <TransferDetails02
          recipientInfo={recipientInfo}
          selectedBank={selectedBank}
          accountNumber={accountNumber}
          amount={amount}
          setAmount={setAmount}
          narration={narration}
          setNarration={setNarration}
          setCurrentPage={setCurrentPage}
          processing={processing}
          handleProceed={handleProceed}
        />
      )}

      <LoadingScreen visible={(processing || verificationProcessing) && currentPage === 1} message="Verifying Details..." />

      <BankSelectionSheet
        isVisible={isBankSheetVisible}
        onClose={handleBankSheetClose}
        onSelect={handleBankSheetSelect}
        sessionToken={sessionToken}
      />

      {confirmData && <DebitTransactionReviewScreen visible={confirmVisible} data={confirmData} reviewData={confirmReviewData} onClose={() => setConfirmVisible(false)} />}
    </View>
  );
}