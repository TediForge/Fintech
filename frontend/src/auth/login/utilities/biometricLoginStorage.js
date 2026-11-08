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
    loginData: {
      key: `@paysmartBiometricData_${normalized}`,
      variants: uniqueVariants.map((value) => `@paysmartBiometricData_${value}`),
    },
    loginFlag: {
      key: `@biometricEnabled_${normalized}`,
      variants: uniqueVariants.map((value) => `@biometricEnabled_${value}`),
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

const removeValue = async ({ key, variants = [] }) => {
  const candidates = [key, ...variants].filter(Boolean);
  await Promise.all(candidates.map((candidate) => AsyncStorage.removeItem(candidate)));
};

export const getBiometricStorageKeys = (phone) => {
  const keys = buildKeySets(phone);
  if (!keys) return null;

  return {
    loginData: keys.loginData.key,
    loginFlag: keys.loginFlag.key,
  };
};

export const getBiometricLoginData = async (phone) => {
  const keys = buildKeySets(phone);
  if (!keys) return null;
  const raw = await getValue(keys.loginData);
  if (!raw?.value) return null;

  try {
    return JSON.parse(raw.value);
  } catch {
    return null;
  }
};

export const saveBiometricLoginData = async (phone, data) => {
  const keys = buildKeySets(phone);
  if (!keys) return;
  await setValue(keys.loginData, JSON.stringify(data));
};

export const removeBiometricLoginData = async (phone) => {
  const keys = buildKeySets(phone);
  if (!keys) return;
  await removeValue(keys.loginData);
};

const getFlagValue = async (phone) => {
  const keys = buildKeySets(phone);
  if (!keys || !keys.loginFlag) return false;
  const value = await getValue(keys.loginFlag);
  return value?.value === 'true';
};

const setFlagValue = async (phone, enabled) => {
  const keys = buildKeySets(phone);
  if (!keys || !keys.loginFlag) return;
  await setValue(keys.loginFlag, enabled ? 'true' : 'false');
};

export const getBiometricLoginEnabled = async (phone) => getFlagValue(phone);
export const setBiometricLoginEnabled = async (phone, enabled) => setFlagValue(phone, enabled);
