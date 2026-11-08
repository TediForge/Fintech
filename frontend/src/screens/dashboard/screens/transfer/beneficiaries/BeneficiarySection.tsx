import React, { useMemo, useState } from 'react';
import UnifiedServiceSection from '@components/extra/UnifiedServiceSection';
import AllBeneficiariesSheet from './AllBeneficiariesSheet';

const getBeneficiaryItems = (recentBankBeneficiaries = []) =>
  recentBankBeneficiaries.map((item, index) => ({
    id: item.accountNumber || item.bankCode || `beneficiary-${index}`,
    title: item.accountName || 'Beneficiary',
    subtitle: `${item.bankName || 'Bank'} • ${item.accountNumber || ''}`,
    imageUrl: 'https://cdn-icons-png.flaticon.com/128/3135/3135715.png',
    accountNumber: item.accountNumber || '',
    bankCode: item.bankCode || '',
    bankName: item.bankName || '',
    accountName: item.accountName || '',
  }));

export const BeneficiarySection = ({
  recentBankBeneficiaries,
  setAccountNumber,
  setSelectedBank,
  verifyAccount,
  marginVertical = 10,
}) => {
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const beneficiaryItems = useMemo(
    () => getBeneficiaryItems(recentBankBeneficiaries),
    [recentBankBeneficiaries]
  );
  const previewItems = useMemo(() => beneficiaryItems.slice(0, 3), [beneficiaryItems]);
  const showViewAll = beneficiaryItems.length > 3;

  if (!recentBankBeneficiaries || recentBankBeneficiaries.length === 0) return null;

  const handleSelectBeneficiary = (beneficiary) => {
    const accountNumber = beneficiary.accountNumber || '';
    const bankCode = beneficiary.bankCode || '';
    const bankName = beneficiary.bankName || '';

    setAccountNumber(accountNumber);
    setSelectedBank({ bankName, bankCode });
    if (accountNumber && bankCode) {
      verifyAccount(accountNumber, bankCode, true);
    }
  };

  return (
    <>
      <UnifiedServiceSection
        title="Beneficiaries"
        items={previewItems}
        rowMode="chevron"
        marginVertical={marginVertical}
        onHeaderAction={showViewAll ? () => setIsSheetVisible(true) : undefined}
        headerActionLabel="View all"
        onItemPress={handleSelectBeneficiary}
      />

      <AllBeneficiariesSheet
        visible={isSheetVisible}
        onClose={() => setIsSheetVisible(false)}
        beneficiaries={recentBankBeneficiaries}
        onSelect={handleSelectBeneficiary}
      />
    </>
  );
};

export default BeneficiarySection;