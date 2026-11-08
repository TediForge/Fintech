import React from 'react';
import {
  View, ScrollView, StyleSheet, StatusBar,
  TouchableOpacity, Text, Image, Dimensions, RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import useApiClient from '@hooks/apiClient';
import LoadingScreen from '@components/Loading/LoadingScreen';
import { ProfileDetailsSection } from './utilities/ProfileDetails';
import { useTheme } from '@providers/ThemeProvider';
import { formatDate } from '@lib/utils/format';
import ProfileTodoSection from './utilities/ProfileTodoSection';

const { width } = Dimensions.get('window');
const scale = width / 410;

const UserProfile = () => {
  const navigation = useNavigation();
  const { user, loading, checkSession, profileImage, tier } = useApiClient();
  const { colors, isDark } = useTheme();

  if (!user) {
    return <LoadingScreen visible={true} message="Syncing Profile..." />;
  }

  const profileSource = profileImage?.type === 'online' 
    ? { uri: profileImage.url } 
    : { uri: 'https://paysmart.com.ng/assets/brand-logos/bitmap.png' };

  const maskEmail = (email) => {
    if (!email) return 'Not Set';
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return name.substring(0, 3) + '***@' + domain;
  };

  const maskValue = (val) => {
    if (!val) return 'Not Set';
    const str = val.toString();
    return str.substring(0, 3) + '**' + str.slice(-2);
  };

  const formatDateWithOrdinal = (dateString) => {
    if (!dateString) return 'Not Set';
    return formatDate(dateString);
  };

  const toTitleCase = (str) => {
    if (!str) return 'Not Set';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const fullName = `${user?.first_name || ''} ${user?.middle_name || ''} ${user?.last_name || ''}`.trim().replace(/\s+/g, ' ');


  const personalInfoItems = [
    { key: 'fullName', icon: 'person-outline', label: 'Full Name', value: fullName, editable: false },
    { key: 'emailAddress', icon: 'mail-outline', label: 'Email Address', value: maskEmail(user?.email), editable: true, screenName: 'EditEmailAddress' },
    { key: 'country', icon: 'globe-outline', label: 'Country', value: user?.countryCode || 'Not Set', editable: false },
    { key: 'memberSince', icon: 'calendar-outline', label: 'Member Since', value: formatDateWithOrdinal(user?.created_at), editable: false },
  ];

  const kycInfoItems = [
    {
      key: 'kycLevel',
      icon: tier === 0 ? 'alert-circle' : 'shield-checkmark-outline',
      iconColor: tier === 0 ? colors.error : undefined,
      label: 'KYC Level',
      value: tier === 0 ? 'Not Verified' : tier === 4 ? 'Merchant' : `Tier ${tier || 1}`,
      valueColor: tier === 0 ? colors.error : undefined,
      editable: true,
      screenName: 'kycScreen'
    },
    { key: 'dateOfBirth', icon: 'calendar-clear-outline', label: 'Date of Birth', value: formatDateWithOrdinal(user?.date_of_birth), editable: false },
    { key: 'gender', icon: 'male-female-outline', label: 'Gender', value: toTitleCase(user?.gender), editable: false },
    { key: 'phoneNumber', icon: 'id-card-outline', label: 'Phone Number', value: maskValue(user?.phone_number), editable: true, screenName: 'EditPhoneNumber' },
  ];

  return (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent={true} />
      <LinearGradient colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]} style={styles.gradientBackground}>
        <View style={styles.wrapper}>
          <LoadingScreen visible={loading} message="Refreshing..." />
          
          <ScreenHeader 
            title="My Profile" 
            backgroundColor={colors.surface} 
            textColor={colors.textPrimary} 
            rightComponent={
              <TouchableOpacity onPress={() => navigation.navigate('Settings', { page: 'account' })} style={{ padding: 0 }}>
                <Image 
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/128/16327/16327901.png' }} 
                  style={{ width: 22, height: 22, tintColor: colors.textPrimary }} 
                />
              </TouchableOpacity>
            }
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={checkSession} tintColor={colors.accent} />
            }
          >
            {/* Header Section */}
            <View style={styles.imageContainer}>
              <Image source={profileSource} style={styles.profilePic} resizeMode="cover" />
              <LinearGradient
                colors={[`rgba(0, 0, 0, 0)`, `rgba(0, 0, 0, 0.15)`, colors.surface]}
                style={StyleSheet.absoluteFillObject}
              />
              
              {/* Profile Image Overlay for Editing */}
              <TouchableOpacity 
                style={styles.editImageOverlay} 
                onPress={() => navigation.navigate('ProfilePhotoUpload')}
                activeOpacity={0.7}
              >
                <View style={styles.cameraIconBg}>
                  <Ionicons name="camera" size={20} color="#FFF" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.padding16}>
              <View style={styles.todoSection}>
                <ProfileTodoSection />
              </View>
              <ProfileDetailsSection title="Personal Information" items={personalInfoItems} onNavigate={(screenName) => navigation.navigate(screenName)} />
              <ProfileDetailsSection title="KYC Information" items={kycInfoItems} onNavigate={(screenName) => navigation.navigate(screenName)} />
            </View>
          </ScrollView>
        </View>
      </LinearGradient>
    </>
  );
};

export default UserProfile;

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  gradientBackground: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40 * scale,
  },
  imageContainer: {
    width: width, height: 320 * scale,
    alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden',
    position: 'relative'
  },
  profilePic: { width: '100%', height: '100%', position: 'absolute' },
  editImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.01)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  cameraIconBg: {
    backgroundColor: 'rgba(14, 60, 46, 0.7)',
    width: 50 * scale,
    height: 50 * scale,
    borderRadius: 25 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  overlayInfo: { alignItems: 'center', marginBottom: 20 * scale, zIndex: 10 },
  userNameText: { fontSize: 24 * scale, fontWeight: '800', textAlign: 'center' },
  tierBadge: {
    flexDirection: 'row',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12, marginTop: 8, alignItems: 'center',
  },
  tierText: { color: '#FFF', fontSize: 11, fontWeight: '700', marginLeft: 4 },
  padding16: { paddingHorizontal: 16 },
  todoSection: { marginVertical: 10 },
  
  statsCard: {
    flexDirection: 'row', borderRadius: 20,
    padding: 20, marginBottom: 25, elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1, height: '100%' },

});