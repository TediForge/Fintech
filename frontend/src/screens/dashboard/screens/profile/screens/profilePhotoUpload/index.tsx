import { Alert } from '@components/common/Alert';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  SafeAreaView,
  Platform,
  Modal,
  Animated,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import ScreenHeader from '@components/headers/ScreenHeader';
import LoadingScreen from '@components/Loading/LoadingScreen';
import OptionCard from '@components/extra/OptionCard';
import GridActionCard from '@components/extra/GridActionCard';
import SearchBar from '@components/common/SearchBar';
import { useTheme } from '@providers/ThemeProvider';
import useApiClient from '@hooks/apiClient';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { loadAvatarOptions } from './utilities/avatarLoader';

const api = apiConfig.baseUrl;

const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;

const BACKEND_URL = `${api}/v1/user/profile/update/index.php`;
const BRAND_DARK = '#0E3C2E';
const BORDER_COLOR = '#E2E8F0';
const TEXT_MUTED = '#64748B';
const AVATAR_BG = '#eff7f4'; // Background color for every avatar

const AVATARS = loadAvatarOptions();

const ProfilePhotoUploadScreen = () => {
  const navigation = useNavigation();
  const { profileImage, checkSession } = useApiClient();
  const { colors, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Avatar Sheet Animation Refs
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // 1. Open Camera
  const handleOpenCamera = async () => {
    const { status } = await requestPermission();
    if (status === 'granted') {
      setIsCameraOpen(true);
    } else {
      Alert.sheet("Permission Denied", "Camera access is required to update your photo.");
    }
  };

  // 2. Open Gallery
  const handleOpenGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.sheet("Permission Denied", "Gallery access is required to upload a photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      uploadToServer(result.assets[0].base64);
    }
  };

  // 3. Capture Flow (No AI Verification)
  const takeAndUpload = async () => {
    if (!cameraRef.current || loading) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.5, 
        base64: true 
      });

      setIsCameraOpen(false);
      uploadToServer(photo.base64);

    } catch (err) {
      setIsCameraOpen(false);
      Alert.sheet("Error", "Could not capture image. Please try again.");
    }
  };

  // 4. Final Upload
  const uploadToServer = async (base64) => {
    setLoading(true);
    setLoadingMessage("Updating Record");
    try {
      const token = await getSessionToken();
      const formData = new FormData();
      formData.append(config.sessionToken, token);
      formData.append('action', 'avatar');
      formData.append('avatarUri', {
        uri: `data:image/jpeg;base64,${base64}`,
        type: 'image/jpeg',
        name: `avatar_${Date.now()}.jpg`,
      });

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data' 
        },
      });

      const text = await response.text();
      let res = null;
      if (text && text.trim()) {
        try {
          res = JSON.parse(text);
        } catch {
          res = { message: text.trim() };
        }
      }

      if (res?.success === true || res?.status === 'success') {
        await checkSession(); // Refresh user data
        setLoading(false);
        Alert.sheet("Upload Success", "Your profile photo has been updated.", [{ text: "Done", onPress: () => navigation.goBack() }]);
      } else {
        throw new Error(res?.message || res?.error || "Server error.");
      }
    } catch (e) {
      setLoading(false);
      Alert.sheet("Upload Error", e.message);
    }
  };

  const openAvatarSheet = () => {
    setIsSheetVisible(true);
    Animated.parallel([
      Animated.timing(animValue, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeAvatarSheet = () => {
    Animated.parallel([
      Animated.timing(animValue, {
        toValue: screenHeight,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsSheetVisible(false);
    });
  };

  const selectAvatar = async (avatarUrl) => {
    closeAvatarSheet();
    setLoading(true);
    setLoadingMessage("Setting avatar...");
    try {
      const token = await getSessionToken();
      const formData = new FormData();
      formData.append(config.sessionToken, token);
      formData.append('action', 'avatar');
      formData.append('avatarUri', {
        uri: avatarUrl,
        type: 'image/png',
        name: `avatar_${Date.now()}.png`,
      });

      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data' 
        },
      });

      const result = await res.json();
      if (result.success === true) {
        await checkSession();
        setLoading(false);
        Alert.sheet("Success", "Your profile photo has been updated.");
      } else {
        throw new Error(result.message || "Server error.");
      }
    } catch (e) {
      setLoading(false);
      Alert.sheet("Error", e.message);
    }
  };

  // --- CAMERA INTERFACE ---
  if (isCameraOpen) {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        <View style={styles.cameraOverlay}>
          <TouchableOpacity onPress={() => setIsCameraOpen(false)} style={styles.closeBtn}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <View style={styles.shutterContainer}>
            <TouchableOpacity onPress={takeAndUpload} style={styles.shutterBtn}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <Text style={styles.shutterText}>Capture Photo</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- MAIN UI ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent={true} />
      <LinearGradient colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]} style={styles.flex1}>
        
        <ScreenHeader 
          title="Update Photo" 
          backgroundColor={colors.surface} 
          textColor={colors.textPrimary} 
        />
        
        <LoadingScreen visible={loading} message={loadingMessage} />

        <View style={styles.content}>
          <View style={styles.imageFrame}>
             <Image 
               source={{ uri: profileImage?.url || 'https://paysmart.com.ng/assets/brand-logos/bitmap.png' }} 
               style={styles.mainImage} 
             />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>Profile Picture</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose a method to update your profile photo
          </Text>

          <View style={styles.grid}>
            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.card, { backgroundColor: colors.card }]} 
              onPress={handleOpenCamera}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="camera" size={16} color={colors.accent} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Open Camera</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>Take a selfie now</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.card, { backgroundColor: colors.card }]} 
              onPress={handleOpenGallery}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="images" size={16} color={colors.accent} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Open Gallery</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>Choose from files</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.grid, { marginTop: 10 }]}>
            <TouchableOpacity 
              activeOpacity={0.7}
              style={[styles.card, { width: '100%', backgroundColor: colors.card }]} 
              onPress={openAvatarSheet}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="happy-outline" size={16} color={colors.accent} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Choose Avatar</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>Pick a ready-made profile character</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Avatar Sheet Modal */}
      <Modal
        visible={isSheetVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeAvatarSheet}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              activeOpacity={1} 
              onPress={closeAvatarSheet} 
            />
          </Animated.View>

          <Animated.View 
            style={[
              styles.sheetContainer,
              { backgroundColor: colors.surface, transform: [{ translateY: animValue }] }
            ]}
          >
            <View style={styles.dragIndicator} />
            
            <SafeAreaView style={styles.safeAreaSheet}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetMainTitle, { color: colors.textPrimary }]}>Select Avatar</Text>
              </View>

              <View style={styles.sheetSearchContainer}>
                <SearchBar
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  placeholder="Search avatar"
                  containerStyle={styles.sheetSearchBar}
                />
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.bankScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.avatarGrid}>
                  {AVATARS.filter((item) => {
                    const query = searchQuery.toLowerCase().trim();
                    if (!query) return true;
                    return `${item.title} ${item.subtitle}`.toLowerCase().includes(query);
                  }).map((item) => (
                    <GridActionCard
                      key={item.id}
                      onPress={() => selectAvatar(item.url)}
                      actionLabel="Use"
                      previewUrl={item.url}
                      containerStyle={styles.avatarGridCard}
                      aspectId={2}
                    />
                  ))}
                </View>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  imageFrame: { width: 170 * scale, height: 170 * scale, borderRadius: 85 * scale, borderWidth: 5, borderColor: 'white', elevation: 12, overflow: 'hidden', marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  mainImage: { width: '100%', height: '100%' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  subtitle: { fontSize: 13, color: TEXT_MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 40, paddingHorizontal: 20 },
  
  grid: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  card: {
    width: (width - 42) / 2,
    borderRadius: 12,
    padding: 12,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  cardDesc: { fontSize: 10, lineHeight: 14 },
  
  cameraContainer: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 25 },
  closeBtn: { marginTop: Platform.OS === 'ios' ? 40 : 50, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  shutterContainer: { width: '100%', alignItems: 'center', marginBottom: 50 },
  shutterBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'white' },
  shutterText: { color: 'white', marginTop: 15, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },

  // Modal / Sheet Styles
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    width: '100%',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    paddingBottom: 40,
    maxHeight: screenHeight * 0.73,
  },
  dragIndicator: { 
    width: 40 * scale,  
    height: 5 * scale, 
    backgroundColor: '#E0E0E0', 
    borderRadius: 3, 
    alignSelf: 'center', 
    marginTop: 15 * scale 
  },
  safeAreaSheet: { width: '100%' },
  sheetHeader: { alignItems: 'center', paddingTop: 10 * scale, paddingBottom: 10 * scale },
  sheetMainTitle: { fontSize: 18 * scale, fontWeight: '700' },
  sheetSearchContainer: { paddingHorizontal: 20 * scale, paddingBottom: 10 * scale },
  sheetSearchBar: { paddingHorizontal: 0 },
  bankScrollContent: { paddingHorizontal: 20 * scale, paddingBottom: 30, paddingTop: 10 },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12 * scale,
  },
  avatarGridCard: {
    width: (width - 52 * scale) / 2,
    marginBottom: 0,
  },
  avatarPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});

export default ProfilePhotoUploadScreen;