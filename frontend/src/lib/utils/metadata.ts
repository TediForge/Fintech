import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import * as Cellular from 'expo-cellular';
import * as Application from 'expo-application';
import * as Location from 'expo-location';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';

let cachedStaticMetadata: Record<string, any> | null = null;

const getStaticMetadata = async () => {
	if (cachedStaticMetadata) return cachedStaticMetadata;

	const deviceId = Platform.OS === 'android'
		? Application.androidId
		: await Application.getIosIdForVendorAsync();
	const osVersion = Device.osVersion;
	const appVersion = Constants.expoConfig?.version || '1.0.0';
	const build = Constants.expoConfig?.extra?.buildNumber || Constants.nativeBuildVersion || 0;
	const fingerprint = await Crypto.digestStringAsync(
		Crypto.CryptoDigestAlgorithm.SHA256,
		`${deviceId}${osVersion}${appVersion}`,
	);

	cachedStaticMetadata = {
		device: {
			id: deviceId,
			name: Device.deviceName || Device.modelName || 'Unknown Device',
			os: `${Platform.OS} ${osVersion || 'unknown'}`,
			brand: Device.brand,
			model: Device.modelName,
			manufacturer: Device.manufacturer,
			deviceType: Device.deviceType === 1 ? 'phone' : 'tablet',
			isEmulator: !Device.isDevice,
		},
		os: {
			name: Platform.OS === 'ios' ? 'iOS' : 'Android',
			version: osVersion,
			buildNumber: Device.osBuildId,
		},
		app: {
			version: appVersion,
			build: parseInt(String(build), 10),
			environment: __DEV__ ? 'development' : 'production',
		},
		security: {
			fingerprint,
			isRooted: await Device.isRootedExperimentalAsync(),
		},
	};

	return cachedStaticMetadata;
};

export const getFullMetadata = async (expoPushToken: string | null = null) => {
	try {
		const staticData = await getStaticMetadata();
		const networkState = await Network.getNetworkStateAsync();
		const biometricEnabled = await LocalAuthentication.isEnrolledAsync();
		const carrierName = await Cellular.getCarrierNameAsync();
		let locationData = { country: 'NG', region: 'Unknown', city: 'Unknown', lat: 0, lng: 0 };

		try {
			const { status } = await Location.getLastKnownPositionAsync({});
			if (status === 'granted' || (await Location.getForegroundPermissionsAsync()).granted) {
				const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
				const geo = await Location.reverseGeocodeAsync({
					latitude: location.coords.latitude,
					longitude: location.coords.longitude,
				});
				if (geo.length > 0) {
					locationData = {
						country: geo[0].isoCountryCode || 'NG',
						region: geo[0].region || 'Unknown',
						city: geo[0].city || 'Unknown',
						lat: location.coords.latitude,
						lng: location.coords.longitude,
					};
				}
			}
		} catch (locationError) {
			console.log('Metadata Location Error:', locationError);
		}

		return {
			session: {
				id: Crypto.randomUUID(),
				createdAt: new Date().toISOString(),
				channel: 'mobile',
			},
			...staticData,
			network: {
				ip: 'auto-from-backend',
				type: networkState.type.toLowerCase(),
				carrier: carrierName || 'WiFi/No-SIM',
				isVpn: networkState.isInternetReachable === false,
			},
			location: locationData,
			security: {
				...staticData.security,
				biometricEnabled,
			},
			notification: { expoPushToken: expoPushToken || null },
		};
	} catch (error) {
		console.log('Error generating full metadata:', error);
		return null;
	}
};
