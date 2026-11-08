import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, Fragment } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Linking,
  Modal,
  Animated,
  ImageBackground,
  PanResponder,
  ActivityIndicator,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Contacts from "expo-contacts";
import * as ImagePicker from "expo-image-picker";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";

import CustomSwitch from "./common/Switch";

const { height: SCREEN_HEIGHT } = Dimensions.get("screen");
const BRAND_DARK = "#0E3C2E";
const BORDER_COLOR = "#E2E8F0";
const INACTIVE_COLOR = "#D1E4DD";
const TEXT_MUTED = "#A1A1A1";

const PERMISSIONS_CONFIG = [
  {
    key: "notifications",
    priority: "basic",
    isActive: true,
    isRequired: true,
    title: "Notifications",
    image: "https://cdn-icons-png.flaticon.com/128/19001/19001457.png",
    iconBottom: "https://paysmart.com.ng/assets/images/plain.png",
    check: Notifications.getPermissionsAsync,
    request: Notifications.requestPermissionsAsync,
  },
  {
    key: "mediaLibrary",
    priority: "secondary",
    isActive: false,
    isRequired: false,
    title: "Media Library",
    image: "https://cdn-icons-png.flaticon.com/128/3917/3917317.png",
    iconBottom: "https://paysmart.com.ng/assets/images/plain.png",
    check: ImagePicker.getMediaLibraryPermissionsAsync,
    request: ImagePicker.requestMediaLibraryPermissionsAsync,
  },
  {
    key: "camera",
    priority: "primary",
    isActive: true,
    isRequired: false,
    title: "Camera Access",
    image: "https://cdn-icons-png.flaticon.com/128/3917/3917108.png",
    iconBottom: "https://paysmart.com.ng/assets/images/plain.png",
    check: ImagePicker.getCameraPermissionsAsync,
    request: ImagePicker.requestCameraPermissionsAsync,
  },
  {
    key: "location",
    priority: "basic",
    isActive: true,
    isRequired: true,
    title: "Location Access",
    image: "https://cdn-icons-png.flaticon.com/128/3916/3916880.png",
    iconBottom: "https://paysmart.com.ng/assets/images/plain.png",
    check: Location.getForegroundPermissionsAsync,
    request: Location.requestForegroundPermissionsAsync,
  },
  {
    key: "contacts",
    priority: "primary",
    isActive: true,
    isRequired: false,
    title: "Contacts Access",
    image: "https://cdn-icons-png.flaticon.com/128/18697/18697656.png",
    iconBottom: "https://paysmart.com.ng/assets/images/plain.png",
    check: Contacts.getPermissionsAsync,
    request: Contacts.requestPermissionsAsync,
  },
];

const PermissionSheet = forwardRef(({ onComplete }, ref) => {
  const [visible, setVisible] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Processing...");
  const [targetPriorities, setTargetPriorities] = useState(["basic", "primary", "secondary"]);
  const [onCloseCallback, setOnCloseCallback] = useState(null);
  
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [enabledViewerMode, setEnabledViewerMode] = useState(false);
  
  const [permissionsState, setPermissionsState] = useState({
    location: false,
    notifications: false,
    contacts: false,
    camera: false,
    mediaLibrary: false,
  });

  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const syncPermissionsState = useCallback(async () => {
    let updatedStates = { ...permissionsState };
    for (const config of PERMISSIONS_CONFIG) {
      try {
        const res = await config.check();
        const isGranted = res?.granted || res?.status === "granted" || false;
        updatedStates[config.key] = isGranted;
      } catch (err) {
        console.warn(`Silently failed verifying state for: ${config.key}`, err);
      }
    }
    setPermissionsState(updatedStates);
    return updatedStates;
  }, [permissionsState]);

  const loadCurrentStates = async () => {
    let currentStates = { ...permissionsState };
    for (const config of PERMISSIONS_CONFIG) {
      try {
        const res = await config.check();
        currentStates[config.key] = res?.granted || res?.status === "granted" || false;
      } catch (e) {}
    }
    setPermissionsState(currentStates);
    return currentStates;
  };

  const animateOpen = () => {
    slideAnim.setValue(SCREEN_HEIGHT);
    setVisible(true);
    
    // ✅ Uses a well-damped spring config to clear the bottom gap anomaly entirely
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 20,
      mass: 0.8,
      stiffness: 140,
      restSpeedThreshold: 0.01,
      restDisplacementThreshold: 0.01,
      useNativeDriver: true,
    }).start();
  };

  useImperativeHandle(ref, () => ({
    open: async (options = {}) => {
      setMaintenanceMode(false);
      setEnabledViewerMode(false);
      const priorities = options.priorities || ["basic", "primary", "secondary"];
      const closeAction = options.onClose || null;
      
      setTargetPriorities(priorities);
      setOnCloseCallback(() => closeAction);

      const currentStates = await loadCurrentStates();
      const itemsToVerify = PERMISSIONS_CONFIG.filter(
        (p) => p.isActive && priorities.includes(p.priority)
      );
      const missingRequired = itemsToVerify.some((p) => p.isRequired && !currentStates[p.key]);

      if (!missingRequired) {
        // All required permissions are already granted, pass success result
        if (closeAction) {
          const result = {
            success: true,
            permissions: currentStates,
            alreadyGranted: true,
            timestamp: Date.now(),
          };
          closeAction(result);
        }
        return;
      }

      animateOpen();
    },
    openMaintenance: async (options = {}) => {
      setMaintenanceMode(true);
      setEnabledViewerMode(false);
      const closeAction = options.onClose || null;
      setOnCloseCallback(() => closeAction);

      await loadCurrentStates();
      animateOpen();
    },
    openEnabledViewer: async (options = {}) => {
      setEnabledViewerMode(true);
      setMaintenanceMode(false);
      const closeAction = options.onClose || null;
      setOnCloseCallback(() => closeAction);

      await loadCurrentStates();
      animateOpen();
    },
    close: () => {
      handleDismiss();
    },
    checkCurrentStates: async () => {
      return await syncPermissionsState();
    }
  }));

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setMaintenanceMode(false);
      setEnabledViewerMode(false);
      if (onCloseCallback) {
        // Pass permission state information to the callback
        const result = {
          success: true,
          permissions: permissionsState,
          timestamp: Date.now(),
        };
        onCloseCallback(result);
      }
    });
  };

  const handleManualSettings = (title) => {
    Alert.sheet(
      "Permission Required",
      `To enable ${title}, please open your system application settings and toggle it manually, syncs update instantly when returning.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
  };

  const runBackgroundTasksForGrantedPermissions = async (key) => {
    try {
      if (key === "notifications" && Device.isDevice && Platform.OS === "android") {
        const channels = ["Notification", "Transactions", "Security", "Promotions"];
        for (const id of channels) {
          await Notifications.setNotificationChannelAsync(id, {
            name: id,
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: BRAND_DARK,
            sound: "default",
            enableVibrate: true,
          });
        }
      }
      if (key === "location") {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = location.coords;
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        const address = reverse[0] ? `${reverse[0].street || ""}, ${reverse[0].city || ""}` : "Cached Location";
        await AsyncStorage.setItem("last_known_location", JSON.stringify({ latitude, longitude, address }));
      }
    } catch (e) {
      console.warn("Background system sync processing halted silently", e);
    }
  };

  const requestPermission = async (config) => {
    setLoadingMessage(`Verifying ${config.title}...`);
    setRequestLoading(true);
    
    try {
      const currentRes = await config.check();
      if (currentRes.status === "denied" && !currentRes.canAskAgain) {
        setRequestLoading(false);
        handleManualSettings(config.title);
        return;
      }

      const result = await config.request();
      const granted = result?.granted || result?.status === "granted" || false;

      setPermissionsState((prev) => ({ ...prev, [config.key]: granted }));

      const permissionLog = { permission: config.key, granted, date: new Date().toISOString() };
      await AsyncStorage.setItem(`perm_log_${config.key}`, JSON.stringify(permissionLog));

      if (granted) {
        await runBackgroundTasksForGrantedPermissions(config.key);
      } else if (result?.canAskAgain === false) {
        handleManualSettings(config.title);
      } else {
        Alert.sheet("Action Required", `${config.title} details are requested to optimize secure transactions.`);
      }

      const updatedStates = { ...permissionsState, [config.key]: granted };
      if (onComplete) {
        onComplete(updatedStates);
      }
    } catch (err) {
      console.warn(`Request workflow exception handling ${config.key}:`, err);
    } finally {
      setRequestLoading(false);
    }
  };

  useEffect(() => {
    let subscription;
    if (visible) {
      subscription = Linking.addEventListener("url", syncPermissionsState);
      syncPermissionsState();
    }
    return () => {
      if (subscription) subscription.remove();
    };
  }, [visible, syncPermissionsState]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) slideAnim.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 140 || gestureState.vy > 0.6) {
          handleDismiss();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 20,
            mass: 0.8,
            stiffness: 140,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const getRenderedPermissions = () => {
    if (maintenanceMode) {
      return PERMISSIONS_CONFIG;
    }
    if (enabledViewerMode) {
      return PERMISSIONS_CONFIG.filter((item) => permissionsState[item.key] === true);
    }
    return PERMISSIONS_CONFIG.filter((item) => item.isActive && targetPriorities.includes(item.priority));
  };

  const renderedPermissions = getRenderedPermissions();

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.dismissOverlayTouch} activeOpacity={1} onPress={handleDismiss} />
        
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={["#e6f2ed", "#f5f8f7"]} style={styles.gradientBackground}>
            <SafeAreaView style={styles.safeArea}>
              
              <View {...panResponder.panHandlers} style={styles.dragResponderZone}>
                <View style={styles.dragIndicatorContainer}>
                  <View style={styles.dragIndicatorLine} />
                </View>

                <View style={styles.header}>
                  <TouchableOpacity onPress={handleDismiss} style={styles.backBtn}>
                    <Ionicons name="close" size={18} color={BRAND_DARK} />
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>
                    {maintenanceMode 
                      ? "System Diagnostics Mode" 
                      : enabledViewerMode 
                      ? "Active System Permissions" 
                      : "Permissions Privacy Control"
                    }
                  </Text>
                  <View style={{ width: 32 }} />
                </View>
              </View>

              <View style={styles.heroSection}>
                <Text style={styles.heroDesc}>
                  {maintenanceMode 
                    ? "Reviewing active system capabilities, toggled states bypass onboarding rules instantly to provide clear diagnostic tracking"
                    : enabledViewerMode
                    ? "The following hardware capabilities and system services are verified and securely allowed by your device system settings"
                    : "Review permissions and access details currently assigned to your account profile, customize features safely at any time"
                  }
                </Text>
              </View>

              <ScrollView 
                contentContainerStyle={styles.scrollContent} 
                showsVerticalScrollIndicator={false}
                bounces={true}
                alwaysBounceVertical={true}
                overScrollMode="always"
              >
                {renderedPermissions.length > 0 ? (
                  <View>
                    <Text style={styles.sectionHeader}>System Permissions</Text>
                    <View style={styles.sectionContainer}>
                      {renderedPermissions.map((item, index) => (
                        <Fragment key={item.key}>
                          <View style={styles.itemContainer}>
                            <ImageBackground
                              source={{ uri: item.iconBottom }}
                              style={styles.leftIcons}
                              imageStyle={styles.leftIcons}
                            >
                              <Image source={{ uri: item.image }} style={styles.icon} />
                            </ImageBackground>

                          <View style={styles.textContainer}>
                            <Text style={styles.title}>{item.title}</Text>
                          </View>

                          <CustomSwitch
                            value={permissionsState[item.key]}
                            onValueChange={() => requestPermission(item)}
                            width={40}
                            height={28}
                          />
                        </View>
                        {index < renderedPermissions.length - 1 && <View style={styles.separator} />}
                      </Fragment>
                    ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="shield-outline" size={48} color={INACTIVE_COLOR} />
                    <Text style={styles.emptyText}>No permissions are currently enabled</Text>
                  </View>
                )}
              </ScrollView>

              {requestLoading && (
                <View style={styles.sheetLoaderOverlay}>
                  <View style={styles.loaderContentCard}>
                    <ActivityIndicator size="small" color={BRAND_DARK} />
                    <Text style={styles.loaderMessageText}>{loadingMessage}</Text>
                  </View>
                </View>
              )}

            </SafeAreaView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  dismissOverlayTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    maxHeight: SCREEN_HEIGHT * 0.78,
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  gradientBackground: {
    flex: 0,
  },
  safeArea: {
    flex: 0,
  },
  dragResponderZone: {
    width: "100%",
  },
  dragIndicatorContainer: {
    width: "100%",
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  dragIndicatorLine: {
    width: 42,
    height: 5,
    backgroundColor: "rgba(14, 60, 46, 0.15)",
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 44,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5, 
    borderColor: BORDER_COLOR,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: BRAND_DARK,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  heroSection: {
    marginTop: 5,
    marginBottom: 20,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 16,
  },
  heroDesc: {
    fontSize: 10,
    color: "#A1A1A1",
    lineHeight: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8c8c8c',
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 8,
  },
  sectionContainer: {
    backgroundColor: '#fff',
    borderWidth: 0.1,
    borderColor: '#f5f5f5',
    borderRadius: 15,
    overflow: 'hidden',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  leftIcons: {
    marginRight: 14,
    justifyContent: "center",
    alignItems: "center",
    height: 32,
    width: 32,
    resizeMode: 'contain',
    tintColor: '#f0f0f0',
  },
  icon: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#262626' },
  textContainer: { flex: 1 },
  title: { fontSize: 12, fontWeight: '500', color: '#6E6E6E' },
  description: {
    marginTop: 1.5,
    fontSize: 10,
    color: '#A1A1A1',
  },
  separator: { height: 1.5, backgroundColor: '#f5f5f5' },
  sheetLoaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245, 248, 247, 0.30)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loaderContentCard: {
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  loaderMessageText: {
    fontSize: 12,
    fontWeight: "600",
    color: BRAND_DARK,
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_MUTED,
    marginTop: 12,
  },
});

export default PermissionSheet;