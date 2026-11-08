import React from 'react';
import { View } from 'react-native';
import AdvertSlider from '@components/ads/AdvertSlider';
import ExtraServices from '@components/extra/ExtraServices';
import { BankTransferInput } from './BankTransferInput';
import { BeneficiarySection } from '../beneficiaries/BeneficiarySection';

export const Page1Content = (props) => {
  const {
    isValidating,
    recipientInfo,
    isDataReady,
    handleNextStep,
    selectedBank,
    setSelectedBank,
    accountNumber,
    setAccountNumber,
    verifyAccount,
    recentBankBeneficiaries,
    navigation,
    openBankSheet,
  } = props;

  return (
    <View>
      <AdvertSlider />
      <BankTransferInput
        selectedBank={selectedBank}
        setSelectedBank={setSelectedBank}
        accountNumber={accountNumber}
        setAccountNumber={setAccountNumber}
        verifyAccount={verifyAccount}
        openBankSheet={openBankSheet}
        isValidating={isValidating}
        recipientInfo={recipientInfo}
        isDataReady={isDataReady}
        handleNextStep={handleNextStep}
      />

      <BeneficiarySection
        recentBankBeneficiaries={recentBankBeneficiaries}
        setAccountNumber={setAccountNumber}
        setSelectedBank={setSelectedBank}
        verifyAccount={verifyAccount}
        navigation={navigation}
        marginVertical={10}
      />

      <ExtraServices currentScreen="BankTransferScreen" showUssdEnquiry={false} />
    </View>
  );
};