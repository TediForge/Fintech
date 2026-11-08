import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useApiClient from '@hooks/apiClient';
import { useTheme } from '@providers/ThemeProvider';
import { useAuthState } from '@hooks/useAuth';
import { openLoginSheet } from '@hooks/useAuth';
import { useVisualDelay } from '@hooks/useVisualDelay';
import { normalize } from '@lib/utils/normalize';
import ScannerSheet from '@components/common/Scanner';

// using shared normalize from hooks

export default function DashboardHeader({
  type = 1,
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { sessionToken, isAuthLoading } = useAuthState();
  const [showScannerSheet, setShowScannerSheet] = useState(false);
  const isLoggedIn = !isAuthLoading && Boolean(sessionToken);
  const {
    headerText,
    user,
    notificationCount,
    profileImage,
    tier,
    supportActive,
    loading,
  } = useApiClient();

  // Progressive loading delays for each section (in milliseconds)
  // Profile photo should load independently from name
  const showProfilePlaceholder = useVisualDelay(!!profileImage?.url || profileImage?.type === 'local', 80);
  const showGreetingPlaceholder = useVisualDelay(!!user?.first_name, 140);
  const showNotificationPlaceholder = useVisualDelay(notificationCount !== null && notificationCount !== undefined, 190);
  const showSupportPlaceholder = useVisualDelay(supportActive !== null && supportActive !== undefined, 240);

  const showSupportBtn = type === 1;
  const rightMostIconType = type === 2 ? 'settings' : 'notification';

  const profileSource =
    profileImage?.type === 'local'
      ? { uri: 'https://paysmart.com.ng/assets/brand-logos/bitmap.png' }
      : { uri: profileImage?.url || 'https://paysmart.com.ng/assets/brand-logos/bitmap.png' };

  const tierBadge = {
    1: 'https://cdn-icons-png.flaticon.com/128/2583/2583344.png',
    2: 'https://cdn-icons-png.flaticon.com/128/2583/2583319.png',
    3: 'https://cdn-icons-png.flaticon.com/128/2583/2583434.png',
    4: 'https://cdn-icons-png.flaticon.com/128/2583/2583434.png',
  };

  const badgeImage = tierBadge[tier] || null;

  const isBirthdayToday = (() => {
    const dobStr = user?.date_of_birth;
    if (!dobStr) return false;
    try {
      const dobDate = new Date(dobStr),
        todayDate = new Date();
      return (
        dobDate.getMonth() === todayDate.getMonth() &&
        dobDate.getDate() === todayDate.getDate()
      );
    } catch {
      return false;
    }
  })();

  const handleHeaderAction = (screenName, params) => {
    if (!isLoggedIn) {
      openLoginSheet();
      return;
    }

    if (screenName === 'ScannerSheet') {
      setShowScannerSheet(true);
      return;
    }

    navigation.navigate(screenName, params);
  };

  return (
    <View 
      style={[
        styles.header, 
        { 
          paddingTop: insets.top + (Platform.OS === 'ios' ? normalize(10) : normalize(12)),
          backgroundColor: isDark ? colors.background : colors.surfaceAlt,
        }
      ]}
    >
      <TouchableOpacity onPress={() => handleHeaderAction('UserProfile')}>
        <View style={[styles.profileBorder, isDark && { borderColor: colors.surface }]}>
          {isAuthLoading || showProfilePlaceholder || (loading && !user?.first_name) ? (
            <View style={[styles.profilePic, styles.profilePicPlaceholder, { backgroundColor: isDark ? colors.surface : '#DCECE6' }]} />
          ) : (
            <>
              <Image source={profileSource} style={styles.profilePic} />
              {isBirthdayToday && (
                <Image
                  source={{ uri: 'https://media.giphy.com/media/BxjxCICUcCm63U5weE/giphy.gif' }}
                  style={styles.birthdayOverlay}
                  resizeMode="cover"
                />
              )}
              {badgeImage && (
                <Image
                  source={{ uri: badgeImage }}
                  style={styles.tierBadge}
                  resizeMode="contain"
                />
              )}
            </>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.welcomeBox}>
        {isLoggedIn ? (
          <View>
            {showGreetingPlaceholder ? (
              <View style={styles.headerPlaceholder} />
            ) : (
              <Text style={[styles.welcome, { color: isDark ? colors.textSecondary : colors.textSecondary }]}>{headerText || ' '}</Text>
            )}
            {showGreetingPlaceholder ? (
              <View style={[styles.headerPlaceholder, styles.headerPlaceholderSmall]} />
            ) : (
              <Text style={[styles.username, { color: isDark ? colors.textPrimary : colors.textPrimary }]}>{user?.first_name || ' '}</Text>
            )}
          </View>
        ) : (isAuthLoading || (loading && !user?.first_name)) ? (
          <View>
            <View style={styles.headerPlaceholder} />
            <View style={[styles.headerPlaceholder, styles.headerPlaceholderSmall]} />
          </View>
        ) : (
          <TouchableOpacity style={styles.loginButton} onPress={() => openLoginSheet()} activeOpacity={0.85}>
            <Text style={[styles.loginButtonText, { color: isDark ? colors.textPrimary : colors.textPrimary }]}>Login</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.iconGroup}>
        {showSupportBtn && (
          <TouchableOpacity onPress={() => handleHeaderAction('CustomerService')}>
            <View>
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/6511/6511790.png' }}
                style={[styles.iconBtn, isDark && { tintColor: colors.textSecondary }]}
              />
              {isLoggedIn && supportActive && !showSupportPlaceholder && <View style={styles.dotBadge} />}
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => handleHeaderAction('ScannerSheet')}>
          <Image
            source={{ uri: 'https://cdn-icons-png.flaticon.com/128/14643/14643572.png' }}
            style={[styles.iconBtn, isDark && { tintColor: colors.textSecondary }]}
          />
        </TouchableOpacity>

        {rightMostIconType === 'notification' ? (
          <TouchableOpacity onPress={() => handleHeaderAction('NotificationScreen')}>
            <View>
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/3239/3239958.png' }}
                style={[styles.iconBtn, isDark && { tintColor: colors.textSecondary }]}
              />
              {isLoggedIn && notificationCount > 0 && !showNotificationPlaceholder && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => handleHeaderAction('Settings', { page: 'system' })}>
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/128/16327/16327901.png' }}
              style={[styles.iconBtn, isDark && { tintColor: colors.textSecondary }]}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScannerSheet visible={showScannerSheet} onClose={() => setShowScannerSheet(false)} mode="qr" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Platform.OS === 'ios' ? normalize(16) : normalize(18),
    paddingBottom: Platform.OS === 'ios' ? normalize(12) : normalize(14),
    backgroundColor: '#e6f2ed',
  },
  profileBorder: {
    position: 'relative',
    borderWidth: 2,
    borderColor: '#eafff5',
    borderRadius: 999,
    padding: normalize(2),
  },
  profilePic: {
    width: normalize(43),
    height: normalize(43),
    borderRadius: normalize(21),
  },
  profilePicPlaceholder: {
    width: normalize(43),
    height: normalize(43),
    borderRadius: normalize(21),
  },
  birthdayOverlay: {
    position: 'absolute',
    top: normalize(2),
    left: normalize(2),
    width: normalize(43),
    height: normalize(43),
    borderRadius: normalize(21),
    zIndex: 1,
  },
  tierBadge: {
    position: 'absolute',
    bottom: -normalize(3),
    right: -normalize(3),
    width: normalize(18),
    height: normalize(18),
    borderRadius: normalize(9),
  },
  welcomeBox: {
    flex: 1,
    marginLeft: normalize(12),
    justifyContent: 'center',
  },
  headerPlaceholder: {
    height: normalize(12),
    width: '70%',
    backgroundColor: '#DCECE6',
    borderRadius: normalize(6),
    marginBottom: normalize(6),
  },
  headerPlaceholderSmall: {
    width: '45%',
    height: normalize(10),
    marginBottom: 0,
  },
  iconPlaceholder: {
    width: Platform.OS === 'ios' ? normalize(36) : normalize(30),
    height: Platform.OS === 'ios' ? normalize(36) : normalize(30),
    borderRadius: normalize(18),
    backgroundColor: '#DCECE6',
  },
  loginButton: {
    height: normalize(43),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: normalize(16),
    borderRadius: normalize(22),
    backgroundColor: '#eaf7ef',
    borderWidth: 1,
    borderColor: '#cfe7d8',
    alignSelf: 'flex-start',
  },
  loginButtonText: {
    fontSize: normalize(13),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  welcome: {
    fontSize: normalize(14.1),
    color: '#666',
  },
  username: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1.5,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.OS === 'ios' ? normalize(15) : normalize(17),
  },
  iconBtn: {
    width: Platform.OS === 'ios' ? normalize(36) : normalize(30),
    height: Platform.OS === 'ios' ? normalize(36) : normalize(30),
    padding: normalize(6),
    resizeMode: 'contain',
    tintColor: '#555',
  },
  badge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? -normalize(1) : -normalize(4),
    right: Platform.OS === 'ios' ? -normalize(1) : -normalize(4),
    backgroundColor: '#ff3b30',
    borderRadius: normalize(10),
    paddingHorizontal: normalize(4),
    minWidth: normalize(16),
    height: normalize(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: normalize(10),
    fontWeight: 'bold',
  },
  dotBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? normalize(0) : normalize(2),
    right: Platform.OS === 'ios' ? normalize(0) : normalize(2),
    width: normalize(7),
    height: normalize(7),
    borderRadius: normalize(3.5),
    backgroundColor: '#ff3b30',
    zIndex: 10,
  },
});