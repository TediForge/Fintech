import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  PanResponder,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import useApiClient from '@hooks/apiClient';
import { openLoginSheet } from '@hooks/useAuth';
import { useAuthState } from '@hooks/useAuth';

const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;

const BRAND_COLOR = '#0c5b3f';
const ACTIVE_COLOR = '#9FC8BA';
const INACTIVE_COLOR = '#ECF6F3';

const HORIZONTAL_PADDING = 16 * scale;
const DYNAMIC_ITEM_WIDTH = (width - (HORIZONTAL_PADDING * 2)) / 5;

const MenuActionItem = ({ title, description, onPress }) => {
  const itemScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(itemScale, { toValue: 0.98, useNativeDriver: true, tension: 150, friction: 5 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(itemScale, { toValue: 1, useNativeDriver: true, tension: 150, friction: 5 }).start();
  };

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={[styles.actionItem, { transform: [{ scale: itemScale }] }]}>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionDescription}>{description}</Text>
        </View>
        <View style={styles.sheetArrow} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const HomeQuickActions = ({ renderTab, isAuthResolved = true }) => {
  const { user } = useApiClient();
  const navigation = useNavigation();
  const { isAuthenticated } = useAuthState();
  
  const [viewMode, setViewMode] = useState('none');
  const [focusedButtonId, setFocusedButtonId] = useState('deposit');
  const [buttons] = useState([
    {
      id: 'transfer',
      label: 'Transfers',
      imageMain: { uri: 'https://cdn-icons-png.flaticon.com/128/3916/3916831.png' },
      actionType: 'sheet',
      route: 'TransferScreen',
      isPill: true,
      rotate: true,
      rotateAngle: -45,
      iconSize: 24,
      isActive: false,
      options: [
        {
          title: 'Transfer',
          description: 'Send money to any bank or internal account',
          route: 'TransferScreen',
          isActive: true,
          isNavigateable: true,
        },
      ],
    },
    {
      id: 'deposit',
      label: 'Deposit',
      imageMain: { uri: 'https://cdn-icons-png.flaticon.com/128/3916/3916831.png' },
      actionType: 'navigate',
      route: 'AddMoneyScreen',
      rotate: true,
      rotateAngle: -225,
      iconSize: 24,
      isActive: true,
      options: [],
    },
    {
      id: 'giftcard',
      label: 'Gift Card',
      imageMain: { uri: 'https://cdn-icons-png.flaticon.com/128/3997/3997852.png' },
      actionType: 'sheet',
      route: 'GiftCardBuyScreen',
      rotate: false,
      customScale: 0.9,
      badge: {
        status: true,
        text: 'Hot',
        color: 'red',
        textColor: '#fff',
      },
      iconSize: 24,
      isActive: true,
      options: [
        {
          title: 'Buy Gift Card',
          description: 'Purchase gift cards instantly',
          route: 'GiftCardBuyScreen',
          isActive: true,
          isNavigateable: true,
        },
        {
          title: 'Sell Gift Card',
          description: 'Convert your gift cards to cash',
          route: 'SellGiftCard',
          isActive: true,
          isNavigateable: true,
        },
      ],
    },
    {
      id: 'rates',
      label: 'Rates',
      imageMain: { uri: 'https://cdn-icons-png.flaticon.com/128/16497/16497878.png' },
      actionType: 'navigate',
      route: 'FaceVerificationScreen',
      rotate: false,
      badge: {
        status: true,
        text: 'Hot',
        color: 'red',
        textColor: '#fff',
      },
      isActive: false,
      options: [],
    },
    {
      id: 'bills',
      label: 'Bills',
      imageMain: { uri: 'https://cdn-icons-png.flaticon.com/128/16774/16774132.png' },
      actionType: 'navigate',
      route: 'Bills',
      rotate: false,
      iconSize: 30,
      badge: {
        status: false,
      },
      isActive: true,
      options: [],
    },
  ]);

  const visibleButtons = buttons.filter((btn) => btn.isActive);

  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openSheet = (mode) => {
    setViewMode(mode);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSheet = (callback) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { 
        toValue: 0, 
        duration: 200, 
        useNativeDriver: true 
      }),
      Animated.timing(animValue, { 
        toValue: screenHeight, 
        duration: 200, 
        easing: Easing.in(Easing.cubic), 
        useNativeDriver: true 
      })
    ]).start(() => {
      setViewMode('none');
      callback?.();
    });
  };

  const handlePress = (btn) => {
    // DO NOT REMOVE: home quick actions on the first dashboard screen must require auth.
    if (!isAuthenticated) {
      openLoginSheet();
      return;
    }

    setFocusedButtonId(btn.id);

    if (btn.actionType === 'navigate') {
      navigation.navigate(btn.route);
    } else if (btn.actionType === 'sheet') {
      const activeOptions = (btn.options ?? []).filter((option) => option.isActive);

      if (activeOptions.length === 1) {
        navigation.navigate(activeOptions[0].route);
      } else {
        openSheet(btn.id);
      }
    }
  };

  const handleOptionPress = (opt) => {
    if (!isAuthenticated) {
      openLoginSheet();
      return;
    }

    if (opt.isNavigateable) {
      closeSheet(() => {
        navigation.navigate(opt.route);
      });
    } else {
      closeSheet();
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          animValue.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          Animated.timing(animValue, { 
            toValue: 0, 
            duration: 200, 
            easing: Easing.out(Easing.cubic), 
            useNativeDriver: true 
          }).start();
        }
      },
    })
  ).current;

  const currentOptions = (buttons.find((btn) => btn.id === viewMode)?.options ?? []).filter((opt) => opt.isActive);

  if (!isAuthResolved) {
    return (
      <View style={styles.placeholderShell}>
        <View style={styles.placeholderRow} />
        <View style={styles.placeholderGrid}>
          {[1, 2, 3, 4, 5].map((item) => (
            <View key={`quick_action_placeholder_${item}`} style={styles.placeholderBlock} />
          ))}
        </View>
      </View>
    );
  }

  const renderIcon = (btn, isActive) => {
    // Decide tint color based on active state
    const tintColor = isActive ? '#D9E9E4' : BRAND_COLOR;

    if (btn.ionicIcon) {
      return (
        <Ionicons 
          name={btn.ionicIcon} 
          size={(btn.iconSize || 22) * scale} 
          color={tintColor} 
        />
      );
    }

    return (
      <Image
        source={btn.imageMain}
        style={[
          styles.icon,
          btn.iconSize ? { width: btn.iconSize * scale, height: btn.iconSize * scale } : null,
          btn.rotate
            ? { transform: [{ rotate: `${btn.rotateAngle}deg` }] }
            : { transform: [{ scale: btn.customScale || 0.75 }] },
        ]}
        tintColor={tintColor} // <-- now dynamically uses isActive
      />
    );
  };

  return (
    <View style={styles.mainWrapper}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Quick Actions</Text>
        <TouchableOpacity
          style={styles.seeAllContainer}
          onPress={() => navigation.navigate('AllServic')}
        >
          <Text style={styles.seeAll}>More</Text>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/128/271/271228.png' }}
            style={styles.seeAllIcon}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {visibleButtons.map((btn) => {
          const isFocused = focusedButtonId === btn.id;
          const bgColor = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;
          const tintColor = isFocused ? '#3F6F5F' : BRAND_COLOR;

          return (
            <TouchableOpacity
              key={btn.id}
              style={styles.actionItemButton}
              onPress={() => handlePress(btn)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
                {renderIcon(btn, isFocused)}
                {btn.badge?.status && (
                  <View style={[styles.badge, { backgroundColor: btn.badge.color }]}>
                    <Text style={[styles.badgeText, { color: btn.badge.textColor }]}>
                      {btn.badge.text}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { color: BRAND_COLOR }]} numberOfLines={1}>{btn.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal
        visible={viewMode !== 'none'}
        transparent={true}
        animationType="none"
        onRequestClose={() => closeSheet()}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => closeSheet()}>
            <Animated.View style={[styles.backdrop, { opacity: overlayOpacity }]} />
          </TouchableWithoutFeedback>

          <Animated.View 
            style={[
              styles.sheetContainer, 
              { transform: [{ translateY: animValue }] }
            ]}
          >
            <View {...panResponder.panHandlers} style={styles.dragHandleZone}>
              <View style={styles.dragHandleBar} />
            </View>

            <View style={styles.menuItemsList}>
              {currentOptions.map((opt, idx) => (
                <MenuActionItem 
                  key={idx}
                  title={opt.title}
                  description={opt.description}
                  onPress={() => handleOptionPress(opt)}
                />
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: { marginVertical: 10 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8 * scale,
    marginBottom: 8 * scale,
    paddingHorizontal: 5 * scale,
    marginHorizontal: HORIZONTAL_PADDING,
  },
  title: { fontWeight: 'bold', color: '#222', fontSize: 13 },
  seeAllContainer: { flexDirection: 'row', alignItems: 'center' },
  seeAll: {
    color: BRAND_COLOR,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    lineHeight: 11,
  },
  seeAllIcon: { width: 8, height: 8, marginLeft: 3, tintColor: BRAND_COLOR },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: HORIZONTAL_PADDING,
    borderRadius: 12,
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  actionItemButton: { width: DYNAMIC_ITEM_WIDTH, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { 
    width: 46 * scale, 
    height: 46 * scale, 
    borderRadius: 10 * scale, 
    alignItems: 'center', 
    justifyContent: 'center',
    position: 'relative',
  },
  icon: { 
    width: 22 * scale, 
    height: 22 * scale, 
    resizeMode: 'contain' 
  },
  label: { 
    marginTop: 6 * scale, 
    fontSize: 10 * scale, 
    fontWeight: '600', 
    textAlign: 'center', 
    width: '100%' 
  },
  badge: {
    position: 'absolute',
    top: -5 * scale,
    right: -5 * scale,
    borderRadius: 8 * scale,
    paddingHorizontal: 4,
    paddingVertical: 1 * scale,
    minWidth: 16 * scale,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  badgeText: { fontWeight: 'bold', fontSize: 7 * scale },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: screenHeight * 0.7,
  },
  dragHandleZone: {
    width: '100%',
    height: 24,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 40, 34, 0.15)',
  },
  menuItemsList: {
    paddingHorizontal: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fcfdfd',
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 40, 34, 0.10)',
  },
  actionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1c2824',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    color: '#657b73',
  },
  sheetArrow: {
    width: 6,
    height: 6,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#a3b8b0',
    transform: [{ rotate: '45deg' }],
  },
});

export default HomeQuickActions;