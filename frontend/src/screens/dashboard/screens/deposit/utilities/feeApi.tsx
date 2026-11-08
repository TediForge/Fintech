import config from '@config/app';
import { apiConfig } from '@config/api';

const endpoint = `${apiConfig.baseUrl}/v1/banking/checkout/fees/index.php`;

export const quoteCheckoutFee = async ({ invoiceNumber, method, cardFirst6 }) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      invoiceNumber,
      method,
      ...(method === 'card' && cardFirst6 ? { cardFirst6 } : {}),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== 'success' || !result.data) {
    throw new Error(result?.message || `Could not quote ${method} checkout fees.`);
  }
  return result.data;
};

export default quoteCheckoutFee;
