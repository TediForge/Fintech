import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import ScreenHeader from '@components/headers/ScreenHeader';
import LoadingScreen from '@components/Loading/LoadingScreen';
import { formatDate } from '@lib/utils/format';
import { useTheme } from '@providers/ThemeProvider';
import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;

const BRAND_COLOR = '#0E3C2E';
const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

export default function DeviceManagementScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  
  // App initialization states
  const [initialLoading, setInitialLoading] = useState(true);
  const [displayedDevices, setDisplayedDevices] = useState([]);
  
  // Pagination tracking engine properties
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const ITEMS_PER_PAGE = 5;

  const swipeableRefs = useRef(new Map());
  const swipeProgressRefs = useRef(new Map());

  const currentDeviceModel = Device.modelName || 'Unknown Device';
  const currentDeviceOS = Platform.OS === 'ios' ? 'iOS' : 'Android';
  const currentDeviceOSVersion = Platform.Version || '';

  // Helper mapping function to preserve original UI design icons dynamically using API metadata signatures
  const resolveDeviceIcon = (channel, os) => {
    const lowOS = String(os || '').toLowerCase();
    if (lowOS.includes('ios') || lowOS.includes('iphone')) {
      return 'https://cdn-icons-png.flaticon.com/128/644/644458.png';
    }
    if (lowOS.includes('android')) {
      return 'https://cdn-icons-png.flaticon.com/128/2586/2586488.png';
    }
    if (lowOS.includes('mac')) {
      return 'https://cdn-icons-png.flaticon.com/128/428/428001.png';
    }
    return 'https://cdn-icons-png.flaticon.com/128/428/428001.png'; 
  };

  // API INTEGRATION: FETCH DEVICES UTILITY WITH ASYNCSTORAGE
  const fetchAccountDevices = async (isInitial = true) => {
    if (!isInitial && (loadingMore || !hasMoreItems)) return;

    if (isInitial) {
      setInitialLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // Fetching the session token directly from AsyncStorage
      const sessionToken = await getSessionToken();

      if (!sessionToken) {
        console.log("Device Sync Error: Missing active session token in storage");
        setInitialLoading(false);
        setLoadingMore(false);
        return;
      }

      const fetchUrl = `${api}/v1/user/profile/devices/index.php?${new URLSearchParams({
        action: 'fetch',
        [config.sessionToken]: sessionToken,
      })}`;
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const json = await response.json();

      if (json && json.status === 200 && json.data && Array.isArray(json.data.devices)) {
        // Standardizing items securely to clear away potential nested mapping crashes
        const standardizedDevices = json.data.devices.map((device, index) => {
          const fingerprint = device.fingerprint || `gen-${index}`;
          const deviceName = device.device_model || 'Unknown Authorized Device';
          
          // CRITICAL CRASH FIX: Parse os properties dynamically to ensure it parses to a plain text string string rather than an object payload block
          const rawOS = device.metadata?.os || device.os;
          let deviceOS = 'System';

          if (rawOS && typeof rawOS === 'object') {
            deviceOS = `${rawOS.name || ''} ${rawOS.version || ''}`.trim() || 'System';
          } else if (typeof rawOS === 'string') {
            deviceOS = rawOS;
          }
          
          // Determine active layout tracking values gracefully
          const isCurrent = device.is_current === true;
          const lastActiveDate = !device.last_seen ? null : formatDate(device.last_seen);

          return {
            id: fingerprint, 
            model: deviceName,
            os: deviceOS,
            lastActive: device.status === 'active'
              ? 'Active now'
              : lastActiveDate
                ? `Last active: ${lastActiveDate}`
                : 'Last active: Recent',
            isCurrent: isCurrent,
            icon: resolveDeviceIcon(device.channel, deviceOS),
            rawDeviceData: device
          };
        });

        if (isInitial) {
          setDisplayedDevices(standardizedDevices.slice(0, ITEMS_PER_PAGE));
          if (standardizedDevices.length <= ITEMS_PER_PAGE) {
            setHasMoreItems(false);
          }
        } else {
          const startRange = currentPage * ITEMS_PER_PAGE;
          const endRange = (currentPage + 1) * ITEMS_PER_PAGE;
          const nextSlice = standardizedDevices.slice(startRange, endRange);

          if (nextSlice.length > 0) {
            setDisplayedDevices(prev => [...prev, ...nextSlice]);
            setCurrentPage(prev => prev + 1);
          }
          if (endRange >= standardizedDevices.length) {
            setHasMoreItems(false);
          }
        }
      } else {
        Alert.sheet('Error', json.message || 'Failed to fetch authorized user devices');
      }
    } catch (error) {
      console.log("Device Sync Error:", error);
      Alert.sheet('Network Error', 'Could not establish connection to synchronization servers, please try again');
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  };

  // Sync effect block handles initialization on mount cleanly
  useEffect(() => {
    fetchAccountDevices(true);
  }, []);

  const loadNextPageData = () => {
    fetchAccountDevices(false);
  };

  const closeOtherSwipeables = (currentId) => {
    swipeableRefs.current.forEach((ref, id) => {
      if (id !== currentId && ref) {
        ref.close();
      }
    });
  };

  const handleUnlinkDevice = (device) => {
    swipeableRefs.current.get(device.id)?.close();
    Alert.sheet(
      'Unlink Device',
      `Are you sure you want to log out and remove authorization for ${device.model}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setInitialLoading(true);
            try {
              const sessionToken = await getSessionToken();
              const response = await fetch(`${api}/v1/user/profile/devices/index.php?action=block`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: JSON.stringify({
                  [config.sessionToken]: sessionToken,
                  fingerprint: device.id,
                  action: 'block',
                }),
              });
              const result = await response.json();
              if (!response.ok || result?.success !== true) {
                throw new Error(result?.message || 'Unable to block device');
              }

              setDisplayedDevices(prev => prev.filter(d => d.id !== device.id));
              Alert.sheet('Success', `${device.model} has been unlinked successfully.`);
            } catch (error) {
              console.error('Device block error:', error);
              Alert.sheet('Error', error?.message || 'Unable to unlink device.');
            } finally {
              setInitialLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (item, progressAnimatedValue) => {
    swipeProgressRefs.current.set(item.id, progressAnimatedValue);

    return (
      <View style={styles.swipeActionsContainer}>
        <View style={styles.swipeActionWrapper}>
          <TouchableOpacity 
            style={styles.swipeActionItem} 
            onPress={() => handleUnlinkDevice(item)}
            activeOpacity={0.8}
          >
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/128/6861/6861362.png' }} 
              style={styles.swipeActionIcon} 
            />
            <Text style={styles.swipeActionText}>Unlink</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderListHeader = () => (
    <View style={styles.brandSection}>
      <View style={styles.logoWrapper}>
            <Ionicons name="shield-checkmark-outline" size={44} color={BRAND_COLOR} />
      </View>
      <Text style={styles.brandTitle}>Authorized Devices</Text>
    </View>
  );

  const renderListFooter = () => {
    if (!loadingMore) return <View style={styles.footerSpacing} />;
    return (
      <View style={styles.loaderFooterContainer}>
        <ActivityIndicator size="small" color={BRAND_COLOR} />
        <Text style={styles.loaderFooterText}>Fetching additional entries</Text>
      </View>
    );
  };

  const renderDeviceRow = ({ item }) => {
    if (!swipeProgressRefs.current.has(item.id)) {
      swipeProgressRefs.current.set(item.id, new Animated.Value(0));
    }
    const progress = swipeProgressRefs.current.get(item.id);

    const chevronRotation = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    const deviceCardContent = (
      <View style={[styles.menuItemCard, item.isCurrent && styles.blockedCard]}>
        <View style={[styles.iconBox, item.isCurrent && styles.activeIconBox]}>
          <Image 
            source={{ uri: item.icon }} 
            style={[styles.deviceIcon, { tintColor: item.isCurrent ? BRAND_COLOR : '#4A5568' }]} 
          />
        </View>
        
        <View style={styles.textWrapper}>
          <View style={styles.titleRow}>
            <Text style={styles.menuText} numberOfLines={1} elipsizeMode="tail">{item.model}</Text>
            {item.isCurrent && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>This device</Text>
              </View>
            )}
          </View>
          <Text style={styles.subText}>{item.os} • {item.lastActive}</Text>
        </View>

        {!item.isCurrent && (
          <AnimatedIonicons 
            name="chevron-back" 
            size={13} 
            color="#A0AEC0" 
            style={[
              styles.hintChevron, 
              { transform: [{ rotate: chevronRotation }] }
            ]} 
          />
        )}
      </View>
    );

    if (item.isCurrent) {
      return (
        <View style={styles.cardWrapper}>
          {deviceCardContent}
        </View>
      );
    }

    return (
      <View style={styles.cardWrapper}>
        <Swipeable
          ref={ref => {
            if (ref) swipeableRefs.current.set(item.id, ref);
            else {
              swipeableRefs.current.delete(item.id);
              swipeProgressRefs.current.delete(item.id);
            }
          }}
          renderRightActions={(progress) => renderRightActions(item, progress)}
          onSwipeableWillOpen={() => closeOtherSwipeables(item.id)}
          friction={2}
          rightThreshold={30}
          containerStyle={styles.swipeableContainer}
        >
          {deviceCardContent}
        </Swipeable>
      </View>
    );
  };

  if (initialLoading) return <LoadingScreen visible={true} message="Syncing" />;

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]} style={styles.container}>
        
        <ScreenHeader
          title="Device Management"
          backgroundColor={colors.surface}
          textColor={colors.textPrimary}
          iconColor={colors.textPrimary}
        />

        <FlatList
          data={displayedDevices}
          keyExtractor={(item) => item.id}
          renderItem={renderDeviceRow}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderListFooter}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadNextPageData}
          onEndReachedThreshold={0.2}
        />
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: (Constants.statusBarHeight || 24) + 68,
    paddingBottom: 40,
  },
  brandSection: { alignItems: 'center', marginBottom: 28 }, 
  logoWrapper: {
    backgroundColor: '#fff',
    borderRadius: 24, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 12,
    width: 80, 
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: { fontSize: 20, fontWeight: '800', color: BRAND_COLOR }, 
  versionLabel: { fontSize: 12, color: '#718096', marginTop: 4, fontWeight: '500', textAlign: 'center', paddingHorizontal: 16 },
  
  cardWrapper: {
    width: '100%',
    marginBottom: 8, 
  },
  swipeableContainer: {
    borderRadius: 12,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12, 
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  blockedCard: {
    borderColor: '#E6FFFA',
    backgroundColor: '#FAFFFD',
  },
  iconBox: {
    width: 38, 
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activeIconBox: {
    backgroundColor: '#E6FFFA',
  },
  deviceIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  textWrapper: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  menuText: { fontSize: 14, fontWeight: '600', color: '#2D3748' }, 
  subText: { fontSize: 11, color: '#A0AEC0', marginTop: 2, fontWeight: '500' },
  badge: {
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#B2F5EA',
  },
  badgeText: { fontSize: 9, color: '#234E52', fontWeight: '700' },
  hintChevron: {
    marginLeft: 2,
    opacity: 0.6,
  },

  swipeActionsContainer: {
    width: 98, 
    flexDirection: 'row',
  },
  swipeActionWrapper: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 2,
  },
  swipeActionItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 12,
  },
  swipeActionIcon: {
    width: 16,
    height: 16,
    tintColor: '#fff',
    marginBottom: 2,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  loaderFooterContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loaderFooterText: {
    fontSize: 12,
    color: '#718096',
    marginLeft: 8,
    fontWeight: '500',
  },
  footerSpacing: {
    height: 16,
  },
});  