import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@providers/ThemeProvider';
import { Alert } from '@components/common/Alert';

const ScreenHeader = ({ 
  title, 
  backgroundColor,
  textColor,
  iconColor,
  rightComponent = null,
  rightText = null,
  onRightPress = null,
  onBack,
  rightImages = null,
  style // Allow custom container styling if needed
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const [headerHeight, setHeaderHeight] = useState(0);

  const effectiveBackground = backgroundColor ?? colors.surface;
  const effectiveTextColor = textColor ?? (isDark ? colors.textPrimary : colors.textPrimary);
  const effectiveIconColor = iconColor ?? (isDark ? colors.textPrimary : colors.textPrimary);

  useEffect(() => {
    StatusBar.setBackgroundColor(effectiveBackground);
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
  }, [effectiveBackground, isDark]);

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View 
      style={[
        styles.headerContainer, 
        { 
          backgroundColor: effectiveBackground, 
          paddingTop: insets.top,
          ...(isDark && { elevation: 0, shadowOpacity: 0, borderBottomWidth: 0 }) 
        },
        style,
      ]}
      onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
    >
      <View style={styles.contentWrapper}>
        <View style={styles.leftSection}>
          <TouchableOpacity 
            onPress={handleBackPress} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={effectiveIconColor} />
          </TouchableOpacity>
          
          <Text style={[styles.headerText, { color: effectiveTextColor }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.rightSection}>
          {rightComponent ? (
            rightComponent
          ) : rightImages && Array.isArray(rightImages) && rightImages.length > 0 ? (
            <View style={styles.rightImagesContainer}>
              {rightImages.map((imgItem, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={imgItem.onPress}
                  style={styles.rightImageButton}
                  activeOpacity={0.7}
                >
                  <Image 
                    source={{ uri: imgItem.url }} 
                    style={[styles.rightImageStyle, imgItem.style]} 
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : rightText ? (
            <TouchableOpacity 
              onPress={onRightPress} 
              style={styles.rightTextButton}
              activeOpacity={0.7}
            >
              <Text style={[styles.rightButtonText, { color: effectiveTextColor }]}>{rightText}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    // Flow Layout: No longer absolute, pushes content down naturally
    width: '100%',
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    borderBottomWidth: Platform.OS === 'ios' ? 0.5 : 0,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  contentWrapper: {
    height: 50, 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', 
  },
  backButton: {
    width: 44, 
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSection: {
    minWidth: 44,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10, 
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    flexShrink: 1, 
  },
  rightTextButton: {
    paddingHorizontal: 8,
  },
  rightButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0E3C2E',
  },
  rightImagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  rightImageButton: {
    paddingHorizontal: 6,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightImageStyle: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
});

export default ScreenHeader;

/*
=============================================================================
                  USAGE DOCUMENTATION EXAMPLES
=============================================================================

1. Standard Usage (Simple Back Button and Title):
-----------------------------------------------------------------------------
<ScreenHeader title="Account Settings" />


2. Custom Text Button on Right Side:
-----------------------------------------------------------------------------
<ScreenHeader 
  title="Transaction History" 
  rightText="Download" 
  onRightPress={() => handleDownloadCSV()} 
/>


3. Single Remote Image Icon on Right Side:
-----------------------------------------------------------------------------
<ScreenHeader
  title="Profile"
  rightImages={[
    {
      url: 'https://example.com/icons/settings-gear.png',
      onPress: () => navigation.navigate('Settings', { page: 'system' })
    }
  ]}
/>


4. Multiple Image Icons on Right Side (Well spaced using global standards):
-----------------------------------------------------------------------------
<ScreenHeader
  title="Dashboard"
  backgroundColor="#eff7f4"
  textColor="#000"
  iconColor="#000"
  rightImages={[
    {
      url: 'https://example.com/icons/notification-bell.png',
      onPress: () => navigation.navigate('Notifications')
    },
    {
      url: 'https://example.com/icons/help-circle.png',
      onPress: () => handleOpenHelpCenter(),
      style: { tintColor: '#0E3C2E' } // Optional custom override styling per image
    }
  ]}
/>


5. Intercepting Back Press Event (Custom Back Logic Override):
-----------------------------------------------------------------------------
<ScreenHeader 
  title="Create Post" 
  onBack={() => Alert.sheet('Discard changes?', 'Your progress will be lost.', [
    { text: 'Keep Editing', style: 'cancel' },
    { text: 'Discard', onPress: () => navigation.pop() }
  ])} 
/>


6. Direct Custom Component Rendering Injection on Right Side:
-----------------------------------------------------------------------------
<ScreenHeader 
  title="Live Stream" 
  rightComponent={
    <View style={{ backgroundColor: 'red', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>LIVE</Text>
    </View>
  } 
/>
*/