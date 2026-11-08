import { useCallback, useEffect, useRef, useState } from 'react';
import config from '@config/app';
import { apiConfig } from '@config/api';
import useApiClient from '@hooks/apiClient';
import { getSessionToken } from '@hooks/useAuth';

const api = apiConfig.baseUrl;
const transferFetchingUrl = `${api}/v1/banking/transfers/fetching/`;
const transferValidationUrl = `${api}/v1/banking/transfers/validation/`;
const transferInitializationUrl = `${api}/v1/banking/transfers/initialization/`;

const safeParseResponse = async (response) => {
  try {
    return await response.clone().json();
  } catch (error) {
    try {
      return JSON.parse(await response.text());
    } catch (parseError) {
      return null;
    }
  }
};

const normalizeBankList = (list) => (Array.isArray(list) ? list : [])
  .map((bank) => ({
    bankName: (bank.bankName || bank.name || '').toString().trim(),
    bankCode: (bank.bankCode || bank.routingKey || bank.code || '').toString().trim(),
    logoImage: bank.logoImage || null,
  }))
  .filter((bank) => bank.bankCode);

const getTransactionFee = async (bankCode) => {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const feeTable = { '011': 50, '044': 65, '058': 45, '057': 55, '033': 40 };
  return feeTable[String(bankCode || '').trim()] ?? 0;
};

export const useTransfer = ({ onSilentVerificationSuccess } = {}) => {
  const { user } = useApiClient();
  const [sessionToken, setSessionToken] = useState(null);
  const [banks, setBanks] = useState([]);
  const [recentBankBeneficiaries, setRecentBankBeneficiaries] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState(null);
  const [processing, setProcessing] = useState(false);
  const verificationRequestRef = useRef(0);

  const fetchBanks = useCallback(async (token = sessionToken) => {
    try {
      const response = await fetch(`${transferFetchingUrl}?${new URLSearchParams({
        action: 'banks',
        [config.sessionToken]: token || '',
        country: 'NG',
      })}`);
      const result = await safeParseResponse(response);
      const list = Array.isArray(result) ? result : result?.data;
      const uniqueBanks = [];
      const seenCodes = new Set();

      normalizeBankList(list).forEach((bank) => {
        if (!seenCodes.has(bank.bankCode)) {
          seenCodes.add(bank.bankCode);
          uniqueBanks.push(bank);
        }
      });

      setBanks(uniqueBanks);
      return uniqueBanks;
    } catch (error) {
      console.error('Transfer: bank fetch failed', error);
      return [];
    }
  }, [sessionToken]);

  const fetchBeneficiaries = useCallback(async (token = sessionToken) => {
    try {
      const response = await fetch(`${api}/v1/banking/beneficiaries/index.php?${new URLSearchParams({
        [config.sessionToken]: token || '',
        service: 'transfer',
      })}`);
      const result = await safeParseResponse(response);
      const beneficiaries = response.ok && result?.success === true && Array.isArray(result?.data?.beneficiaries)
        ? result.data.beneficiaries
        : [];
      const seenAccountNumbers = new Set();
      const normalizedBeneficiaries = [];

      beneficiaries.forEach((item) => {
        const beneficiary = { ...item, ...(item.details || {}) };
        const accountNumber = String(beneficiary.accountNumber || '').trim();
        const bankCode = String(beneficiary.bankCode || '').trim();
        if (accountNumber && bankCode && !seenAccountNumbers.has(accountNumber)) {
          seenAccountNumbers.add(accountNumber);
          normalizedBeneficiaries.push({
            accountName: String(beneficiary.accountName || '').trim(),
            bankName: String(beneficiary.bankName || '').trim(),
            accountNumber,
            bankCode,
          });
        }
      });

      setRecentBankBeneficiaries(normalizedBeneficiaries);
      return normalizedBeneficiaries;
    } catch (error) {
      console.error('Transfer: beneficiary fetch failed', error);
      return [];
    }
  }, [sessionToken]);

  useEffect(() => {
    let cancelled = false;

    const loadTransferData = async () => {
      try {
        const token = user?.sessionToken || await getSessionToken();
        if (!token || cancelled) return;
        setSessionToken(token);
        await Promise.all([fetchBanks(token), fetchBeneficiaries(token)]);
      } catch (error) {
        console.error('Transfer: data sync failed', error);
      }
    };

    loadTransferData();
    return () => {
      cancelled = true;
    };
  }, [user, fetchBanks, fetchBeneficiaries]);

  const verifyAccount = useCallback(async (accountNumber, bankCode, silent = false) => {
    if (accountNumber.length !== 10 || !bankCode) return false;
    const requestId = ++verificationRequestRef.current;
    if (!silent) setIsValidating(true);
    else setProcessing(true);
    setRecipientInfo(null);

    try {
      const token = sessionToken || await getSessionToken();
      const response = await fetch(`${transferValidationUrl}?${new URLSearchParams({
        [config.sessionToken]: token || '',
        bankCode,
        accountNumber,
      })}`);
      const result = await safeParseResponse(response);
      if (!result) throw new Error('Invalid JSON response');
      if (requestId !== verificationRequestRef.current) return false;

      if (result.success === true) {
        const data = result.data || {};
        setRecipientInfo({ name: data.accountName || '', bank: data.bankCode || bankCode, error: false });
        if (silent) onSilentVerificationSuccess?.();
        return true;
      }

      setRecipientInfo({ error: result.message || 'Invalid Account' });
      return false;
    } catch (error) {
      if (requestId !== verificationRequestRef.current) return false;
      setRecipientInfo({ error: 'Verification failed' });
      return false;
    } finally {
      if (requestId === verificationRequestRef.current) {
        setIsValidating(false);
        setProcessing(false);
      }
    }
  }, [onSilentVerificationSuccess, sessionToken]);

  const resetVerification = useCallback(() => {
    verificationRequestRef.current += 1;
    setRecipientInfo(null);
    setIsValidating(false);
  }, []);

  return {
    sessionToken,
    banks,
    recentBankBeneficiaries,
    isValidating,
    recipientInfo,
    processing,
    setRecipientInfo,
    resetVerification,
    fetchBanks,
    fetchBeneficiaries,
    verifyAccount,
    getTransactionFee,
    transferInitializationUrl,
  };
};

export default useTransfer;
