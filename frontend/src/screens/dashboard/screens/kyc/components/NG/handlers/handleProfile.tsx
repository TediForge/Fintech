import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;

export const formatTierName = (tierName) => {
  if (!tierName) return '';
  
  // Convert to string if it's an object or other type
  const tierNameStr = String(tierName);
  const tierNameLower = tierNameStr.toLowerCase();
  
  if (tierNameLower === 'merchant') {
    return 'Merchant';
  }
  
  // Handle tier1, tier2, tier3 format
  const match = tierNameLower.match(/tier(\d+)/);
  if (match) {
    return `Tier ${match[1]}`;
  }
  
  // Fallback: capitalize first letter
  return tierNameStr.charAt(0).toUpperCase() + tierNameStr.slice(1);
};

export const kycProfile = {
  getComplianceAccess: async () => {
    const sessionToken = await getSessionToken();
    const response = await fetch(`${api}/v1/user/kyc/index.php`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getComplianceAccess',
        [config.sessionToken]: sessionToken,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.success || !data?.data?.url) {
      throw new Error(data?.message || 'Unable to open compliance');
    }

    return data;
  },

  getAccountTiers: async () => {
    const sessionToken = await getSessionToken();
    const url = `${api}/v1/user/tiers/index.php?${config.sessionToken}=${encodeURIComponent(sessionToken || '')}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (__DEV__) {
      console.log('[KYC backend] getAccountTiers response:', data);
    }

    if (!data?.success) {
      throw new Error(data?.message || 'Unable to load account tiers');
    }

    return data;
  },

  getKycProfile: async () => {
    const sessionToken = await getSessionToken();

    const response = await fetch(`${api}/v1/user/kyc/index.php?action=getKycProfile`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getKycProfile',
        [config.sessionToken]: sessionToken,
      }),
    });

    const data = await response.json();
    if (__DEV__) {
      console.log('[KYC backend] getKycProfile response:', data);
    }

    if (!response.ok || (!data?.success && data?.status !== 'success')) {
      throw new Error(data?.message || 'Unable to load KYC profile');
    }

    return data;
  },

  getKycStatus: async () => {
    const sessionToken = await getSessionToken();
    const response = await fetch(`${api}/v1/user/kyc/index.php?action=getKycStatus`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getKycStatus',
        [config.sessionToken]: sessionToken,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.success || !data?.data?.sections) {
      throw new Error(data?.message || 'Unable to load KYC status');
    }

    return data;
  },
};

const normalizeTierValue = (value) => {
  if (!value && value !== 0) return null;
  return String(value).trim().toLowerCase().replace(/[\s_-]+/g, '');
};

export const handleProfile = async () => {
  try {
    const [tiersResponse, profileResponse] = await Promise.all([
      kycProfile.getAccountTiers(),
      kycProfile.getKycProfile(),
    ]);

    const tiersData = tiersResponse?.data || {};
    const profileData = profileResponse?.data || {};

    const currentTier = normalizeTierValue(tiersData?.current || tiersData?.currentLevel || profileData?.currentLevel);
    const previousTier = normalizeTierValue(tiersData?.previous || tiersData?.previousLevel || profileData?.previousLevel);
    const accountTierList = Array.isArray(tiersData?.tiers) ? tiersData.tiers : [];
    const getTierName = (tier) => tier?.name || tier?.tier || tier?.tierName || tier?.tier_name || tier;
    const currentTierIndex = accountTierList.findIndex((tier) => normalizeTierValue(getTierName(tier)) === currentTier);
    const nextTierDefinition = currentTierIndex < 0
      ? accountTierList[0]
      : accountTierList[currentTierIndex + 1];
    const nextTier = nextTierDefinition
      ? normalizeTierValue(getTierName(nextTierDefinition))
      : null;
    const tierFlowList = accountTierList;

    const formattedAccountTiers = accountTierList.map(tier => {
      const tierNameValue = getTierName(tier);
      return {
        ...tier,
        displayName: formatTierName(tierNameValue),
      };
    });

    const formattedTierFlow = tierFlowList.map(tier => {
      const tierNameValue = tier?.tierId || tier?.name || tier?.tier || tier?.tierName || tier?.tier_name || tier;
      return {
        ...tier,
        displayName: formatTierName(tierNameValue),
      };
    });

    return {
      success: true,
      message: 'Profile loaded successfully',
      data: {
        ...profileData,
        ...tiersData,
        current: currentTier,
        previous: previousTier,
        next: nextTier,
        currentLevel: currentTier,
        previousLevel: previousTier,
        nextLevel: nextTier,
        kycStatus: tiersData?.kycStatus || profileData?.kycStatus || null,
        accountTiers: formattedAccountTiers,
        tiers: formattedAccountTiers,
        tierFlow: formattedTierFlow,
        tierRequirements: tierFlowList,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || 'Unable to load profile',
      data: null,
    };
  }
};

export default handleProfile;
