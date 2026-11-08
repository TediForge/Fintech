// Copyright (c) 2026 Tediwave, all rights reserved, subject to the proprietary license located in the root directory
import { Alert } from '@components/common/Alert';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import config from '@config/app';
import { brandConfig } from '@config/brand';

export default function ScannerSheet({
  visible = true,
  onClose,
  mode: initialMode = 'qr',
  onScanResult,
  onModeChange,
}) {
  const [hasPermission, setHasPermission] = useState(null);
  const [lastScannedTime, setLastScannedTime] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);
  const [mode, setMode] = useState(initialMode);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scanDelay = 3000;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sheetTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  const startAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    let active = true;

    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (active) {
        setHasPermission(status === 'granted');
      }
    };

    getCameraPermissions();
    startAnimation();

    const unsubscribe = navigation?.addListener?.('blur', () => {
      setTorchOn(false);
    });

    return () => {
      active = false;
      unsubscribe?.();
      setTorchOn(false);
    };
  }, [navigation]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: Dimensions.get('window').height,
          duration: 220,
          useNativeDriver: true,
          easing: undefined,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    sheetTranslateY.setValue(0);
    sheetOpacity.setValue(1);
  }, [visible, sheetTranslateY, sheetOpacity]);

  const closeSheet = () => {
    if (onClose) {
      onClose();
      return;
    }
    navigation?.goBack?.();
  };

  const parseQRCodeData = (data) => {
    try {
      const regex = /brand-name:\s*(.*?),\s*url:\s*(.*?),\s*page-name:\s*(.*?),\s*data-to-act-on:\s*(.*?)(?:,|$)/;
      const match = data.match(regex);

      if (match) {
        return {
          brandName: match[1]?.trim() || '',
          url: match[2]?.trim() || '',
          pageName: match[3]?.trim() || '',
          dataToActOn: match[4]?.trim() || '',
        };
      }
    } catch (error) {
      console.error('QR Parsing Error:', error);
    }
    return { brandName: '', url: '', pageName: '', dataToActOn: '' };
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (!scannerActive || mode !== 'qr') return;
    const now = Date.now();
    if (now - lastScannedTime < scanDelay) return;

    setLastScannedTime(now);

    const parsedData = parseQRCodeData(data);

    if (parsedData.brandName !== `${brandConfig.brandName}2557`) {
      Alert.sheet('Invalid QR Code', 'This is not a valid Tediwave code.', [
        { text: 'OK', onPress: () => setScannerActive(true) },
      ]);
      return;
    }

    let dataToPass = parsedData.dataToActOn;

    try {
      if (typeof dataToPass === 'string' && (dataToPass.startsWith('{') || dataToPass.startsWith('['))) {
        dataToPass = JSON.parse(dataToPass);
      }
    } catch (error) {
      console.log('dataToActOn is not JSON, treating as string');
    }

    if (parsedData.pageName) {
      navigation?.navigate?.(parsedData.pageName, { qrData: dataToPass });
    }

    if (typeof onScanResult === 'function') {
      onScanResult({
        type: 'qr',
        data: dataToPass,
        raw: data,
      });
    }

    if (parsedData.dataToActOn) {
      await AsyncStorage.setItem('lastDataFromScanner', typeof dataToPass === 'object' ? JSON.stringify(dataToPass) : String(dataToPass));
    }

    if (parsedData.url) {
      await AsyncStorage.setItem('lastURLFromScanner', parsedData.url);
    }

    setScannerActive(true);
  };

  const toggleFlashlight = () => {
    try {
      setTorchOn((prev) => !prev);
    } catch (error) {
      console.error('Flashlight error:', error);
    }
  };

  const toggleMode = (nextMode) => {
    setMode(nextMode);
    onModeChange?.(nextMode);
  };

  const renderBody = () => {
    if (hasPermission === false) {
      return (
        <View style={styles.permissionState}>
          <Ionicons name="camera-outline" size={42} color="white" />
          <Text style={styles.permissionTitle}>Camera access is required</Text>
          <Text style={styles.permissionText}>Enable camera permission to continue scanning.</Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraShell}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'pdf417'] }}
          onBarcodeScanned={mode === 'qr' ? handleBarcodeScanned : undefined}
        />

        <View style={styles.overlayLayer}>
          <Animated.View style={[styles.scannerBox, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.cornerTopLeft}>
              <View style={styles.cornerInnerTopLeft} />
            </View>
            <View style={styles.cornerTopRight}>
              <View style={styles.cornerInnerTopRight} />
            </View>
            <View style={styles.cornerBottomLeft}>
              <View style={styles.cornerInnerBottomLeft} />
            </View>
            <View style={styles.cornerBottomRight}>
              <View style={styles.cornerInnerBottomRight} />
            </View>
          </Animated.View>
        </View>
      </View>
    );
  };

  const content = (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.cameraContainer}>{renderBody()}</View>

      <View style={[
        styles.controlsLayer,
        {
          paddingTop: insets.top ? insets.top + 12 : (Platform.OS === 'ios' ? 54 : 24),
          paddingBottom: insets.bottom ? insets.bottom + 20 : 40,
        },
      ]}>
        <View style={styles.headerControls}>
          <TouchableOpacity style={styles.iconButton} onPress={closeSheet}>
            <Ionicons name="close" size={18} color="white" />
          </TouchableOpacity>
        </View>

        {/* Mode is controlled externally via `initialMode` or programmatic `onModeChange`.
            No explicit mode-selector UI here by design. */}

        <View style={styles.footerControls}>
          <View style={styles.footerAction}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleFlashlight}>
              <Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={20} color="white" />
            </TouchableOpacity>
            <Text style={styles.tagline}>Flashlight</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (typeof visible === 'boolean') {
    return (
      <Modal visible={visible} transparent={false} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeSheet}>
        {content}
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
  cameraShell: { flex: 1, backgroundColor: '#000' },
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  // Mode selection UI intentionally omitted; mode controlled externally
  modeButton: {
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
  },
  activeModeButton: {
    backgroundColor: '#22c55e',
  },
  disabledModeButton: {
    opacity: 0.5,
  },
  modeButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  footerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  footerAction: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  controlButton: {
    height: 50,
    width: 50,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  tagline: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerBox: {
    width: '65%',
    aspectRatio: 1,
    borderColor: 'transparent',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '10%',
    height: '10%',
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 8,
    overflow: 'hidden',
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '10%',
    height: '10%',
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 8,
    overflow: 'hidden',
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '10%',
    height: '10%',
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 8,
    overflow: 'hidden',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '10%',
    height: '10%',
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  cornerInnerTopLeft: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '66%',
    height: '66%',
    
    borderBottomRightRadius: 14,
  },
  cornerInnerTopRight: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '66%',
    height: '66%',
    
    borderBottomLeftRadius: 14,
  },
  cornerInnerBottomLeft: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '66%',
    height: '66%',
    
    borderTopRightRadius: 14,
  },
  cornerInnerBottomRight: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '66%',
    height: '66%',
    
    borderTopLeftRadius: 14,
  },
  permissionState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  permissionText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});