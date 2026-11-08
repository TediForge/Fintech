import config from '@config/app';
import { apiConfig } from '@config/api';

const endpoint = `${apiConfig.baseUrl}/v1/banking/checkout/card/index.php`;

const postCardAction = async (action, payload = {}) => {
  const requestBody = {
    action,
    ...payload,
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok && !result) {
    throw new Error(`Card deposit request failed: ${response.status}`);
  }
  return result || { status: 'error', message: 'Invalid card deposit response' };
};

export const initializeCardCharge = (payload) => postCardAction('initialize', {
  invoiceNumber: payload.invoiceNumber,
  cardNumber: payload.cardNumber,
  expiryMonth: payload.expiryMonth,
  expiryYear: payload.expiryYear,
  cvv: payload.cvv,
  ...(payload.cardHolderName ? { cardHolderName: payload.cardHolderName } : {}),
});

export const authorizeCardCharge = ({ invoiceNumber, reference, chargeId, flwRef, authType, pin, otp, billingAddress }) => postCardAction('authorize', {
  invoiceNumber,
  reference,
  ...(chargeId ? { chargeId } : {}),  // Only send chargeId if it exists (not null)
  ...(flwRef ? { flwRef } : {}),
  authType,
  ...(authType === 'pin' ? { pin } : {}),
  ...(authType === 'otp' ? { otp } : {}),
  ...(authType === 'avs' || authType === 'avs_noauth' ? { billingAddress } : {}),
});

export const verifyCardCharge = ({ invoiceNumber, reference, transactionId }) => postCardAction('verify', {
  invoiceNumber,
  reference,
  ...(transactionId ? { transactionId } : {}),
});

export default {
  initializeCardCharge,
  authorizeCardCharge,
  verifyCardCharge,
};
