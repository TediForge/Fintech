import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAuthSession, getSessionToken } from '@hooks/useAuth';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { authEventNames, subscribeToAuthEvent } from '@hooks/useAuth';
import { parseJsonResponse } from '@lib/utils/responce';
import { shouldTerminateSession } from '@lib/utils/session';

const api = apiConfig.baseUrl;

/**
 * GLOBAL STORE (Single Source of Truth)
 * Shared across all instances of the hook to prevent duplicate requests
 * and ensure real-time consistency across screens.
 */
let globalStore = {
  user: null,
  sessionValid: null,
  notificationCount: 0,
  accounts: [],
  wallets: [],
  balances: {},
  loading: true,
  lastSynced: 0,
  isSyncing: false,
};

let listeners = [];

const updateGlobalStore = (data) => {
  globalStore = { ...globalStore, ...data };
  listeners.forEach((listener) => listener(globalStore));
};

export default function useApiClient() {
  const [localState, setLocalState] = useState(globalStore);
  const hasRegisteredPush = useRef(false);

  useEffect(() => {
    // Register this instance as a listener for global state changes
    listeners.push(setLocalState);

    const init = async () => {
      // 1. HYDRATION: Load last known state from storage for instant UI render
      if (!globalStore.user) {
        try {
          const snapshot = await AsyncStorage.getItem('userSnapshot');
          if (snapshot) {
            const parsed = JSON.parse(snapshot);
            updateGlobalStore({
              user: parsed.user,
              accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
                wallets: Array.isArray(parsed.wallets) ? parsed.wallets : [],
                balances: parsed.balances || {},
              sessionValid: true,
              loading: false,
            });
          }
        } catch (e) {
          console.log('[Hydration Error]:', e);
        }
      }

      // 2. INITIAL SYNC: Only fetch if data is stale (> 30 seconds)
      const now = Date.now();
      if (now - globalStore.lastSynced > 5000) {
        syncData({ refreshAvatar: true });
      }
    };

    init();

    const unsubscribeLogin = subscribeToAuthEvent(authEventNames.loginSuccess, () => {
      syncData({ refreshAvatar: true });
    });

    const unsubscribeLogout = subscribeToAuthEvent(authEventNames.logout, () => {
      updateGlobalStore({ user: null, sessionValid: false, loading: false, notificationCount: 0, accounts: [], wallets: [], balances: {} });
      AsyncStorage.multiRemove(['sessionToken', 'lastLoginTimestamp', 'userSnapshot']);
    });

    // 3. SMART SYNC: Interval check (Every 15s) but only triggers if TTL expired
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - globalStore.lastSynced > 30000) {
        syncData();
      }
    }, 15000);

    return () => {
      listeners = listeners.filter((l) => l !== setLocalState);
      unsubscribeLogin();
      unsubscribeLogout();
      clearInterval(interval);
    };
  }, []);

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const registerForPushNotifications = async (sessionToken) => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const nativeToken = (await Notifications.getDevicePushTokenAsync()).data;

      const params = new URLSearchParams({
        [config.sessionToken]: sessionToken,
        push_token: nativeToken,
        platform: Platform.OS,
      }).toString();

      await fetch(`${api}/v1/user/profile/update-push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      hasRegisteredPush.current = true;
    } catch (err) {
      console.log('[Push Registration Error]:', err);
    }
  };

  const syncData = async ({ refreshAvatar = false } = {}) => {
    // 4. REQUEST DEDUPLICATION: Prevent multiple simultaneous API hits
    if (globalStore.isSyncing) return;
    
    const sessionToken = await getSessionToken();

    if (!sessionToken) {
      updateGlobalStore({ sessionValid: false, user: null, loading: false });
      return;
    }

    updateGlobalStore({ isSyncing: true });

    try {
      // 5. Validate the session; profile and wallet data come from their own endpoints.
      const res = await fetch(`${api}/v1/auth/session/orchestrator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionToken,
        }),
      });

      const data = await parseJsonResponse(res, { success: false, data: null });

      if (data?.success && data.data?.valid) {
        const profileRes = await fetch(`${api}/v1/user/profile/get/index.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [config.sessionToken]: sessionToken }),
        });
        const profileData = await parseJsonResponse(profileRes, { success: false, data: null });
        const profile = profileData?.data?.profile;

        if (!profileRes.ok || !profileData?.success || !profile || typeof profile !== 'object') {
          if (shouldTerminateSession(profileRes, profileData)) {
            updateGlobalStore({ sessionValid: false, user: null, loading: false, isSyncing: false });
            await clearAuthSession();
            return;
          }
          throw new Error(profileData?.message || 'Unable to load user profile');
        }

        const fetchedUser = {
          ...profile,
          id: profile.userId,
          user_id: profile.userId,
          first_name: profile.firstName,
          middle_name: profile.middleName,
          last_name: profile.lastName,
          full_name: profile.fullName,
          phone_number: profile.phoneNumber,
          date_of_birth: profile.dateOfBirth,
        };

        const currentUserId = globalStore.user?.id ?? globalStore.user?.userId;
        const isSameUser = currentUserId != null
          && fetchedUser.id != null
          && String(currentUserId) === String(fetchedUser.id);
        if (currentUserId && fetchedUser.id && !isSameUser) {
          updateGlobalStore({ accounts: [] });
        }
        const user = {
          ...fetchedUser,
          avatarUrl: refreshAvatar || !isSameUser || !globalStore.user?.avatarUrl
            ? fetchedUser.avatarUrl ?? (isSameUser ? globalStore.user?.avatarUrl : null)
            : globalStore.user.avatarUrl,
        };

        updateGlobalStore({
          sessionValid: true,
          user,
          lastSynced: Date.now(),
          loading: false,
          isSyncing: false
        });

        // 6. SNAPSHOT: Save to storage for next app launch
        AsyncStorage.setItem('userSnapshot', JSON.stringify({
          user,
          accounts: globalStore.accounts,
          wallets: globalStore.wallets,
          balances: globalStore.balances,
        }));

        // 7. BACKGROUND SYNC: Non-critical updates
        Promise.all([
          fetchNotifications(sessionToken),
          fetchAccounts(sessionToken),
          fetchWalletBalances(sessionToken)
        ]);

        if (!hasRegisteredPush.current) {
          registerForPushNotifications(sessionToken);
        }
      } else if (shouldTerminateSession(res, data)) {
        console.log('[apiClient] terminating session due to auth validation response', { status: res?.status, data });
        updateGlobalStore({ sessionValid: false, user: null, loading: false, isSyncing: false });
        await clearAuthSession();
      } else {
        console.log('[apiClient] keeping session active after validation response', { status: res?.status, data });
        updateGlobalStore({ sessionValid: globalStore.sessionValid ?? true, user: globalStore.user, loading: false, isSyncing: false });
      }
    } catch (err) {
      console.log('[Sync Error - Silent]:', err);
      // Fail-safe: keep existing data if network fails
      updateGlobalStore({ isSyncing: false, loading: false });
    }
  };

  const fetchWalletBalances = async (sessionToken) => {
    try {
      const res = await fetch(`${api}/v1/user/wallets/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.sessionToken]: sessionToken }),
      });
      const data = await parseJsonResponse(res, { success: false, data: null });
      const wallets = Array.isArray(data?.data?.wallets) ? data.data.wallets : [];
      const balances = wallets.reduce((result, wallet) => {
        const walletType = String(wallet.walletType || '').toUpperCase();
        if (walletType) {
          result[walletType] = {
            balance: Number(wallet.balance || 0),
            availableBalance: Number(wallet.availableBalance || 0),
            pendingBalance: Number(wallet.pendingBalance || 0),
          };
        }
        return result;
      }, {});

      if (data?.success) {
        updateGlobalStore({ wallets, balances });
      }
    } catch (err) {
      console.log('[Fetch Wallet Balances Error]:', err);
    }
  };

  const fetchNotifications = async (sessionToken) => {
    try {
      const params = new URLSearchParams({ [config.sessionToken]: sessionToken }).toString();
      const res = await fetch(`${api}/v1/user/activity/notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      const data = await parseJsonResponse(res, { status: 'error', data: [] });
      if (data?.status === 'success' && Array.isArray(data.data)) {
        const unread = data.data.filter(n => n.is_read === 0).length;
        updateGlobalStore({ notificationCount: unread });
      }
    } catch (err) {
      console.log('[Fetch Notifications Error]:', err);
    }
  };

  const fetchAccounts = async (sessionToken) => {
    try {
      const res = await fetch(`${api}/v1/banking/checkout/bank/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [config.sessionToken]: sessionToken }),
      });

      const parsed = await parseJsonResponse(res, {
        status: 'error',
        success: false,
        data: null,
        accounts: [],
      });

      const payload = parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
        ? parsed.data
        : parsed;

      const rawAccounts = Array.isArray(payload?.accounts)
        ? payload.accounts
        : Array.isArray(parsed?.accounts)
          ? parsed.accounts
          : [];

      const accounts = rawAccounts.map((entry, index) => {
        if (!entry || typeof entry !== 'object') return entry;

        const derivedProvider = entry.provider || entry.account?.provider || 'flutterwave';
        const normalizedEntry = {
          ...entry,
          provider: derivedProvider,
          isPrimary: Boolean(entry.isPrimary ?? entry.account?.isPrimary ?? index === 0),
          account: {
            ...(entry.account || {}),
            provider: derivedProvider,
          },
        };

        return normalizedEntry;
      });

      const isSuccessResponse =
        parsed?.status === 'success' ||
        payload?.status === 'success' ||
        parsed?.success === true ||
        payload?.success === true ||
        res?.ok === true;

      if (isSuccessResponse) {
        updateGlobalStore({ accounts });
      }
    } catch (err) {
      console.log('[Fetch Virtual Account Error]:', err);
    }
  };

  const kycMap = { tier0: 0, tier1: 1, tier2: 2, tier3: 3, merchant: 4 };
  const tier = kycMap[localState.user?.kycLevel] ?? null;

  const safeUser = localState.user || {
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    username: '',
    kycLevel: 'tier1',
    avatarUrl: null,
  };

  return {
    headerText: getTimeBasedGreeting(),
    checkSession: () => syncData({ refreshAvatar: true }),
    sessionValid: localState.sessionValid,
    loading: localState.loading,
    user: safeUser,
    wallets: localState.wallets,
    balances: localState.balances,
    tier,
    notificationCount: localState.notificationCount,
    profileImage: {
      type: safeUser.avatarUrl ? 'online' : 'local',
      url: safeUser.avatarUrl || 'https://paysmart.com.ng/assets/brand-logos/bitmap.png',
    },
    accounts: localState.accounts,
  };
}