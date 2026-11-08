import { Alert } from '@components/common/Alert';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import LoginSheet from '@auth/login/LoginSheet';
import SignupSheet from '@auth/signup/SignupSheet';
import config from '@config/app';
import { apiConfig } from '@config/api';

const listeners: Record<string, Array<(payload: any) => void>> = {};

export const authEventNames = {
	loginSuccess: 'loginSuccess',
	logout: 'logout',
};

export const subscribeToAuthEvent = (eventName: string, listener: (payload: any) => void) => {
	if (typeof listener !== 'function') return () => {};
	listeners[eventName] = listeners[eventName] || [];
	listeners[eventName].push(listener);
	return () => {
		listeners[eventName] = (listeners[eventName] || []).filter((item) => item !== listener);
	};
};

export const emitAuthEvent = (eventName: string, payload: any) => {
	const handlers = listeners[eventName] || [];
	console.log('[authEvents] emit', { eventName, listenerCount: handlers.length, payload });
	handlers.forEach((listener) => {
		try {
			listener(payload);
		} catch (error) {
			console.error(`[authEvents] listener failed for ${eventName}:`, error);
		}
	});
};

const authTokenKey = 'sessionToken';
const lastLoginKey = 'lastLoginTimestamp';

const getStoredValue = async (key: string) => {
	try {
		return await AsyncStorage.getItem(key);
	} catch (error) {
		console.error('[AuthState] storage read error:', error);
		return null;
	}
};

export const syncSessionTokenStorage = async () => {
	try {
		return await AsyncStorage.getItem(authTokenKey);
	} catch (error) {
		console.error('[AuthState] syncSessionTokenStorage error:', error);
		return null;
	}
};

export const getSessionToken = async () => {
	try {
		const token = await getStoredValue(authTokenKey);
		return token || await syncSessionTokenStorage();
	} catch (error) {
		console.error('[AuthState] getSessionToken error:', error);
		return null;
	}
};

export const resolveSessionTokenValue = (source: any) => {
	if (!source || typeof source !== 'object') return null;
	return source.sessionToken || source.session_token || source.token || source[config?.sessionToken] || null;
};

export const isAuthenticated = async () => Boolean(await getSessionToken());

export const setAuthSessionToken = async (sessionToken: string | null) => {
	try {
		if (sessionToken) {
			console.log('[AuthState] setAuthSessionToken: storing token', { tokenLength: String(sessionToken).length });
			await AsyncStorage.setItem(authTokenKey, sessionToken);
			emitAuthEvent(authEventNames.loginSuccess, { sessionToken });
		} else {
			console.log('[AuthState] setAuthSessionToken: clearing token');
			await AsyncStorage.removeItem(authTokenKey);
			emitAuthEvent(authEventNames.logout, null);
		}
		return sessionToken;
	} catch (error) {
		console.error('[AuthState] setAuthSessionToken error:', error);
		return null;
	}
};

export const refreshAuthState = async () => {
	try {
		const token = await getSessionToken();
		console.log('[AuthState] refreshAuthState:', { hasToken: Boolean(token), tokenLength: token ? String(token).length : 0 });
		if (token) emitAuthEvent(authEventNames.loginSuccess, { [config.sessionToken]: token });
		return token;
	} catch (error) {
		console.error('[AuthState] refreshAuthState error:', error);
		return null;
	}
};

export const clearAuthSession = async () => {
	try {
		console.log('[AuthState] clearAuthSession: explicit logout');
		await AsyncStorage.multiRemove([authTokenKey, lastLoginKey]);
		emitAuthEvent(authEventNames.logout, null);
	} catch (error) {
		console.error('[AuthState] clearAuthSession error:', error);
	}
};

export const subscribeAuthState = (listener: (payload: any) => void) => {
	const unsubscribeLogin = subscribeToAuthEvent(authEventNames.loginSuccess, listener);
	const unsubscribeLogout = subscribeToAuthEvent(authEventNames.logout, listener);
	return () => {
		unsubscribeLogin();
		unsubscribeLogout();
	};
};

export const useAuthState = () => {
	const [sessionToken, setSessionTokenState] = useState<string | null>(null);
	const [isAuthLoading, setAuthLoading] = useState(true);
	useEffect(() => {
		let mounted = true;
		const refresh = async () => {
			if (mounted) setAuthLoading(true);
			const token = await getSessionToken();
			if (mounted) setSessionTokenState(token);
			if (mounted) setAuthLoading(false);
		};
		const unsubscribe = subscribeAuthState(refresh);
		refresh();
		return () => {
			mounted = false;
			unsubscribe();
		};
	}, []);
	return {
		sessionToken,
		[config.sessionToken]: sessionToken,
		isAuthenticated: Boolean(sessionToken),
		isAuthLoading,
	};
};

export const registerLoginSheetOpener = (opener: () => void) => {
	if (typeof opener === 'function') (globalThis as any).__openLoginSheet = opener;
};

export const openLoginSheet = () => (globalThis as any).__openLoginSheet?.();

const AuthSheetHost = () => {
	const loginSheetRef = useRef<any>(null);
	const signupSheetRef = useRef<any>(null);
	const openSignupSheet = useCallback(() => {
		loginSheetRef.current?.close?.();
		setTimeout(() => signupSheetRef.current?.open?.(), 250);
	}, []);
	const handleOpenLoginSheet = useCallback((options = {}) => {
		signupSheetRef.current?.close?.();
		setTimeout(() => loginSheetRef.current?.open?.(options), 250);
	}, []);
	useEffect(() => {
		registerLoginSheetOpener(() => loginSheetRef.current?.open?.());
	}, []);
	return React.createElement(
		React.Fragment,
		null,
		React.createElement(LoginSheet.Internal as React.ComponentType<any>, {
			ref: loginSheetRef,
			isModal: true,
			onSwitchToSignup: openSignupSheet,
		} as any),
		React.createElement(SignupSheet as React.ComponentType<any>, {
			ref: signupSheetRef,
			isModal: true,
			onSwitchToLogin: handleOpenLoginSheet,
		} as any),
	);
};

export const useAuthGuard = () => {
	const requireAuth = useCallback((options: any = {}) => {
		const { onFail, onSuccess } = options;
		const sessionToken = (globalThis as any).sessionToken ?? null;
		if (sessionToken) {
			onSuccess?.();
			return true;
		}
		if (onFail) {
			onFail();
			return false;
		}
		openLoginSheet();
		return false;
	}, []);
	return { requireAuth };
};

export const AuthGuard = ({ children, requireAuth, onBlocked }: any) => {
	const handlePress = useCallback(() => {
		if (requireAuth?.()) return true;
		onBlocked?.();
		return false;
	}, [requireAuth, onBlocked]);
	if (!children || !React.isValidElement(children)) return null;
	return React.cloneElement(children as React.ReactElement<any>, {
		onPress: (...args: any[]) => {
			(children as React.ReactElement<any>).props?.onPress?.(...args);
			handlePress();
		},
	});
};

const LOGOUT_TIMEOUT_MS = 8000;

const terminateSession = async (sessionToken: string) => {
	const request = fetch(`${apiConfig.baseUrl}/v1/auth/session/terminate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ [config.sessionToken]: sessionToken }),
	});
	const timeout = new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error('Logout request timed out')), LOGOUT_TIMEOUT_MS);
	});
	const response = await Promise.race([request, timeout]);
	const data = await response.json().catch(() => ({}));
	if (!response.ok || data?.success === false) throw new Error(data?.message || 'Logout request failed');
};

export const performLogout = async ({ navigation, resetRouteName = 'Dashboard', onComplete }: any) => {
	try {
		const sessionToken = await getSessionToken();
		if (sessionToken) await terminateSession(sessionToken);
	} catch (error) {
		console.error('[LogoutAction] logout failed:', error);
		Alert.sheet('Unable to log out', 'Please check your connection and try again.');
		return;
	}
	await clearAuthSession();
	if (navigation?.dispatch) {
		navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: resetRouteName }] }));
	}
	onComplete?.();
};

export const confirmLogout = ({
	navigation,
	title = 'Log Out',
	message = 'Are you sure you want to logout?',
	confirmText = 'Logout',
	resetRouteName = 'Dashboard',
	onComplete,
	onCancel,
}: any) => {
	Alert.sheet(title, message, [
		{ text: 'Cancel', style: 'cancel', onPress: onCancel },
		{
			text: confirmText,
			style: 'destructive',
			onPress: () => performLogout({ navigation, resetRouteName, onComplete }),
		},
	], { cancelable: true });
};

export const LogoutAction = ({ navigation, children, ...props }: any) => {
	const handlePress = () => confirmLogout({ navigation, ...props });
	if (!children || !React.isValidElement(children)) return null;
	return React.cloneElement(children as React.ReactElement<any>, {
		onPress: (...args: any[]) => {
			(children as React.ReactElement<any>).props?.onPress?.(...args);
			handlePress();
		},
	});
};

export default AuthSheetHost;

const countriesCacheKey = '@supportedCountriesCache';
const countriesCacheExpiryMs = 4 * 60 * 60 * 1000;

type SupportedCountry = {
	isoCode: string;
	name: string;
	dialCode: string;
	flagUrl: string | null;
};

const normalizeCountryPayload = (payload: unknown): SupportedCountry[] | null => {
	if (!payload || typeof payload !== 'object') return null;
	return Object.entries(payload as Record<string, any>)
		.map(([, countryData]) => {
			if (!countryData || typeof countryData !== 'object') return null;
			const { countryCode, countryName, dialCode } = countryData;
			if (typeof countryCode !== 'string' || typeof countryName !== 'string' || typeof dialCode !== 'string') return null;
			const isoCode = countryCode.toUpperCase();
			return { isoCode, name: countryName, dialCode, flagUrl: getFlagCdnUrl(isoCode) };
		})
		.filter((country): country is SupportedCountry => country !== null);
};

export const getFlagCdnUrl = (isoCode: string | null | undefined) => {
	if (!isoCode || typeof isoCode !== 'string') return null;
	return `https://flagcdn.com/w80/${isoCode.toLowerCase()}.png`;
};

const readCachedCountries = async () => {
	try {
		const cached = await AsyncStorage.getItem(countriesCacheKey);
		if (!cached) return null;
		const parsed = JSON.parse(cached);
		if (!parsed?.data || typeof parsed.timestamp !== 'number') return null;
		return parsed;
	} catch {
		return null;
	}
};

const writeCachedCountries = async (data: unknown) => {
	try {
		await AsyncStorage.setItem(countriesCacheKey, JSON.stringify({ timestamp: Date.now(), data }));
	} catch {
		// Cache write failures should not block country lookup.
	}
};

export const syncSupportedCountries = async () => {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 15000);
		const url = `${apiConfig.baseUrl}/v1/auth/shared/countries/countries.json?cb=${Date.now()}`;
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: 'application/json, text/plain, */*' },
		});
		clearTimeout(timeoutId);
		if (!response.ok) return;
		const payload = await response.json().catch(() => null);
		if (!payload) return;
		const cached = await readCachedCountries();
		if (JSON.stringify(cached?.data || {}) !== JSON.stringify(payload)) await writeCachedCountries(payload);
	} catch (error) {
		console.log('[countryUtils] Silent sync failed:', error);
	}
};

export const getSupportedCountries = async (): Promise<SupportedCountry[]> => {
	const cached = await readCachedCountries();
	if (cached && Date.now() - cached.timestamp < countriesCacheExpiryMs && cached.data) {
		return normalizeCountryPayload(cached.data)?.map((country) => ({
			...country,
			flagUrl: getFlagCdnUrl(country.isoCode),
		})) || [];
	}

	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const url = `${apiConfig.baseUrl}/v1/auth/shared/countries/countries.json?cb=${Date.now()}`;
			const response = await fetch(url, { headers: { Accept: 'application/json, text/plain, */*' } });
			const rawText = await response.text();
			console.log('[countryUtils] response', { url, status: response.status, rawText });
			if (!response.ok) throw new Error(`Status ${response.status}`);
			const payload = rawText ? JSON.parse(rawText) : null;
			const normalized = normalizeCountryPayload(payload);
			if (!normalized?.length) throw new Error('No countries in payload');
			await writeCachedCountries(payload);
			return normalized;
		} catch (error) {
			if (attempt === 3) {
				console.warn('Could not fetch supported countries:', error);
				return [];
			}
			await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
		}
	}
	return [];
};
