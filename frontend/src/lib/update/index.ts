import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';

const autoDownloadKey = '@updatesAutoDownload';
const notifyKey = '@updatesNotify';
const wifiOnlyKey = '@updatesWifiOnly';
const mandatoryVersionKey = '@updatesMandatoryVersion';

const defaultPrefs = {
	autoDownload: true,
	notify: true,
	wifiOnly: true,
};

const readPrefs = async () => {
	try {
		const [autoDownload, notify, wifiOnly] = await Promise.all([
			AsyncStorage.getItem(autoDownloadKey),
			AsyncStorage.getItem(notifyKey),
			AsyncStorage.getItem(wifiOnlyKey),
		]);
		const notifyEnabled = notify === null ? defaultPrefs.notify : notify === 'true';

		return {
			autoDownload: autoDownload === null ? defaultPrefs.autoDownload : autoDownload === 'true',
			notify: notifyEnabled,
			notifyOnUpdate: notifyEnabled,
			wifiOnly: wifiOnly === null ? defaultPrefs.wifiOnly : wifiOnly === 'true',
		};
	} catch {
		return { ...defaultPrefs, notifyOnUpdate: defaultPrefs.notify };
	}
};

const normalizePreferenceTitle = (title: unknown) => String(title || '')
	.trim()
	.toLowerCase()
	.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
	.replace(/\s+/g, ' ');

const titleToPreferenceKey = (title: unknown) => {
	const normalized = normalizePreferenceTitle(title);
	if (normalized.includes('auto download')) return 'autoDownload';
	if (normalized.includes('notify on update')) return 'notify';
	if (normalized.includes('wifi only') || normalized.includes('wi-fi only')) return 'wifiOnly';
	return null;
};

export const getUpdatePreferences = readPrefs;
export const getUpdatePreferencesSnapshot = async () => readPrefs();

export const getUpdatePreferenceValueByTitle = async (title: unknown) => {
	const key = titleToPreferenceKey(title);
	if (!key) return null;
	const prefs = await readPrefs();
	return prefs[key];
};

export const setUpdatePreferenceByTitle = async (title: unknown, value: boolean) => {
	const key = titleToPreferenceKey(title);
	if (!key) return false;
	return setUpdatePreference(key, value);
};

export const setUpdatePreference = async (key: string, value: boolean) => {
	try {
		const map: Record<string, string> = {
			autoDownload: autoDownloadKey,
			notify: notifyKey,
			wifiOnly: wifiOnlyKey,
		};
		if (!map[key]) return false;
		await AsyncStorage.setItem(map[key], value ? 'true' : 'false');
		return true;
	} catch {
		return false;
	}
};

export const setMandatoryVersion = async (version?: string | number | null) => {
	if (!version) return AsyncStorage.removeItem(mandatoryVersionKey);
	await AsyncStorage.setItem(mandatoryVersionKey, String(version));
};

export const getMandatoryVersion = async () => AsyncStorage.getItem(mandatoryVersionKey);

let status = { checking: false, progress: 0, available: false, isMandatory: false };

export const getStatus = () => status;

const shouldRespectWifi = async (wifiOnly: boolean) => {
	if (!wifiOnly) return true;
	try {
		const state = await NetInfo.fetch();
		return state.type === 'wifi' || (state.isConnected === true && state.details?.isConnectionExpensive !== true);
	} catch {
		return true;
	}
};

export const checkForUpdatesNow = async (opts: { force?: boolean } = {}) => {
	if (__DEV__) return { isAvailable: false };
	status.checking = true;
	try {
		const prefs = await readPrefs();
		if (prefs.wifiOnly) {
			const canUseNetwork = await shouldRespectWifi(prefs.wifiOnly);
			if (!canUseNetwork && !opts.force) {
				status.checking = false;
				return { isAvailable: false, skippedForWifi: true };
			}
		}

		const update = await Updates.checkForUpdateAsync();
		status.available = !!update.isAvailable;
		if (update.isAvailable) {
			const mandatory = await getMandatoryVersion();
			status.isMandatory = !!mandatory;
			if (prefs.autoDownload || opts.force || status.isMandatory) {
				await Updates.fetchUpdateAsync();
				if (prefs.notify) {
					await Notifications.scheduleNotificationAsync({
						content: { title: 'Update Ready', body: 'A new update has been downloaded and will be applied on next restart.' },
						trigger: null,
					});
				}
			} else if (prefs.notify) {
				await Notifications.scheduleNotificationAsync({
					content: { title: 'Update Available', body: 'A new update is available for download.' },
					trigger: null,
				});
			}
		}

		status.checking = false;
		return update;
	} catch (error) {
		status.checking = false;
		return { isAvailable: false, error };
	}
};

export const handleBackgroundUpdateCheck = async () => {
	if (__DEV__) return { isAvailable: false, skipped: true };
	try {
		const prefs = await readPrefs();
		if (prefs.wifiOnly && !(await shouldRespectWifi(prefs.wifiOnly))) {
			return { isAvailable: false, skippedForWifi: true };
		}

		const update = await Updates.checkForUpdateAsync();
		if (!update?.isAvailable) return { isAvailable: false };
		if (prefs.autoDownload) await Updates.fetchUpdateAsync();
		if (prefs.notify) {
			await Notifications.scheduleNotificationAsync({
				content: {
					title: 'Tediwave Updated',
					body: 'A new security patch has been downloaded and will be applied on next launch.',
					data: { type: 'update' },
				},
				trigger: null,
			});
		}
		return { isAvailable: true, fetched: !!prefs.autoDownload };
	} catch (error) {
		return { isAvailable: false, error };
	}
};

export const initUpdateManager = async () => {
	try {
		await readPrefs();
		if (!__DEV__) checkForUpdatesNow().catch(() => {});
	} catch {
		// Startup update checks must not interrupt app startup.
	}
};

const updateManager = {
	initUpdateManager,
	checkForUpdatesNow,
	getUpdatePreferences,
	getUpdatePreferencesSnapshot,
	getUpdatePreferenceValueByTitle,
	setUpdatePreference,
	setUpdatePreferenceByTitle,
	getStatus,
	setMandatoryVersion,
	getMandatoryVersion,
	handleBackgroundUpdateCheck,
};

export default updateManager;
