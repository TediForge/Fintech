import AsyncStorage from '@react-native-async-storage/async-storage';

const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('234')) {
    return cleaned.length === 13 ? `0${cleaned.slice(3)}` : cleaned;
  }

  if (cleaned.startsWith('0')) {
    return cleaned;
  }

  if (cleaned.length === 10) {
    return `0${cleaned}`;
  }

  if (cleaned.length === 11) {
    return cleaned;
  }

  return cleaned;
};

const buildKeySets = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const digits = String(phone).replace(/\D/g, '');
  const variants = [
    normalized,
    digits,
    digits.startsWith('0') ? digits.replace(/^0/, '') : null,
    digits.startsWith('0') ? `234${digits.slice(1)}` : null,
    digits.startsWith('234') ? `0${digits.slice(3)}` : null,
    digits.startsWith('234') ? digits.slice(3) : null,
  ].filter(Boolean);

  const uniqueVariants = [...new Set(variants)];

  return {
    payFlag: {
      key: `@biometricPayEnabled_${normalized}`,
      variants: uniqueVariants.map((value) => `@biometricPayEnabled_${value}`),
    },
  };
};

const getValue = async ({ key, variants = [] }) => {
  const candidates = [key, ...variants].filter(Boolean);
  for (const candidate of candidates) {
    const value = await AsyncStorage.getItem(candidate);
    if (value) return { key: candidate, value };
  }
  return null;
};

const setValue = async ({ key, variants = [] }, value) => {
  const candidates = [key, ...variants].filter(Boolean);
  await Promise.all(candidates.map((candidate) => AsyncStorage.setItem(candidate, value)));
};

const getFlagValue = async (phone) => {
  const keys = buildKeySets(phone);
  if (!keys || !keys.payFlag) return false;
  const value = await getValue(keys.payFlag);
  return value?.value === 'true';
};

const setFlagValue = async (phone, enabled) => {
  const keys = buildKeySets(phone);
  if (!keys || !keys.payFlag) return;
  await setValue(keys.payFlag, enabled ? 'true' : 'false');
};

export const getBiometricPaymentEnabled = async (phone) => getFlagValue(phone);
export const setBiometricPaymentEnabled = async (phone, enabled) => setFlagValue(phone, enabled);
