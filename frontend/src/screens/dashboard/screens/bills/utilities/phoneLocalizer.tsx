import { getCountryDialCode } from '@lib/utils/format';

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

export const internationalToLocal = async (phone, countrySelection, countries) => {
  if (!phone) return '';
  const dialCode = await getCountryDialCode(countrySelection, countries).catch(() => null);
  const dialDigits = onlyDigits(dialCode || '');

  let cleaned = String(phone || '').trim();
  cleaned = cleaned.replace(/[^+\d]/g, '');
  const noPlus = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  if (dialDigits && noPlus.startsWith(dialDigits)) {
    let rest = noPlus.slice(dialDigits.length);
    rest = rest.replace(/^0+/, '');
    return rest ? `0${rest}` : '';
  }

  const digits = onlyDigits(cleaned);
  if (digits.startsWith('0')) return digits;
  return digits;
};

export const localToInternational = async (phone, countrySelection, countries) => {
  if (!phone) return '';
  const dialCode = await getCountryDialCode(countrySelection, countries).catch(() => null);
  const dialDigits = onlyDigits(dialCode || '');

  let digits = onlyDigits(String(phone || ''));
  if (!digits) return '';

  if (dialDigits && digits.startsWith(dialDigits)) return `+${digits}`;
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  if (!dialDigits) return `+${digits}`;
  return `+${dialDigits}${digits}`;
};

export default {
  internationalToLocal,
  localToInternational,
};
