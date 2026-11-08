import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openLoginSheet } from '@hooks/useAuth';
import { useTheme } from '@providers/ThemeProvider';
import { useAuthState } from '@hooks/useAuth';
import { Bot, Gift, House, LayoutGrid, Plus, WalletCards, X } from 'lucide-react-native';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const TAB_BAR_CONTENT_HEIGHT = 68; // Refined for more balanced look
const VERTICAL_PADDING = 6; // Small breathing room above/below the content row
const CENTER_OUTER_SIZE = 64; // Scaled down slightly
const CENTER_INNER_SIZE = 48; // Compact inner button
// (CENTER_OUTER_SIZE - CENTER_INNER_SIZE) / 2 = 10px ring of "halo" visible around the inner button
const CENTER_LIFT = 6; // Lowered lift for sleeker profile
const TAB_NAVIGATOR_HEIGHT = TAB_BAR_CONTENT_HEIGHT + VERTICAL_PADDING * 2;

const getTabNavigatorHeight = (bottomInset = 0) => TAB_NAVIGATOR_HEIGHT + bottomInset;

type TabNavigatorProps = {
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  onCenterPress?: () => void;
  centerActionOpen?: boolean;
  bottomInset?: number;
};

const TABS = [
  { key: 'Home', label: 'Home', icon: House },
  { key: 'Reward', label: 'Rewards', icon: Gift },
  { key: 'assistant', label: 'Assistant', icon: Bot },
  { key: 'Finance', label: 'Finance', icon: WalletCards },
  { key: 'More', label: 'More', icon: LayoutGrid },
];

/**
 * TabNavigator Component.
 */
const TabNavigator = Object.assign(React.memo(({
  activeTab,
  onTabChange,
  onCenterPress,
  centerActionOpen = false,
}: TabNavigatorProps) => {
  const tabItems = useMemo(() => TABS, []);
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthState();
  const { colors } = useTheme();
  const isDark = useTheme().isDark;

  const totalBarHeight = getTabNavigatorHeight(insets.bottom);
  const [panelVisible, setPanelVisible] = useState(centerActionOpen);
  const panelAnimation = useRef(new Animated.Value(centerActionOpen ? 1 : 0)).current;

  useEffect(() => {
    panelAnimation.stopAnimation();

    if (centerActionOpen) {
      setPanelVisible(true);
      panelAnimation.setValue(0);
      Animated.timing(panelAnimation, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      return undefined;
    }

    if (!panelVisible) return undefined;

    Animated.timing(panelAnimation, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPanelVisible(false);
    });

    return undefined;
  }, [centerActionOpen, panelAnimation, panelVisible]);

  const handleTabPress = (tabKey: string) => {
    // DO NOT REMOVE: dashboard tabs must never navigate while logged out.
    if (!isAuthenticated) {
      openLoginSheet();
      return;
    }
    onTabChange(tabKey);
  };

  const handleCenterPress = () => {
    if (!isAuthenticated) {
      openLoginSheet();
      return;
    }
    onCenterPress?.();
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: isDark ? 1 : 0 },
          isDark ? {} : styles.tabBarShadow,
          {
            paddingBottom: VERTICAL_PADDING + insets.bottom,
            height: totalBarHeight,
          },
        ]}
      >
      {tabItems.map((tab) => {
        const isActive = tab.key === activeTab;
        const isCenterAction = tab.key === 'assistant';

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => (isCenterAction ? handleCenterPress() : handleTabPress(tab.key))}
            style={[styles.tabItem, isCenterAction && centerActionOpen && styles.centerActionTab]}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
          >
            {isCenterAction ? (
              /* Floating action button: 72px halo (matches tab bar bg) wrapping a 52px button */
              <View style={[styles.centerButtonOuter, { backgroundColor: colors.surface }]}>
                <View style={[styles.centerButtonInner, { backgroundColor: colors.accent }]}>
                  {centerActionOpen ? <X size={25} color="#FFFFFF" /> : <Plus size={25} color="#FFFFFF" />}
                </View>
              </View>
            ) : (
              /* Your standard layout rendering blocks with upgraded design parameters */
              <>
                <View style={styles.iconWrapper}>
                  <tab.icon
                    size={22}
                    color={isActive ? colors.accent : colors.textDisabled}
                  />
                </View>

                <Text
                  style={[
                    styles.label,
                    { color: isActive ? colors.accent : colors.textDisabled },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>

                <View
                  style={[
                    styles.activeDot,
                    { opacity: isActive ? 1 : 0, backgroundColor: colors.accent },
                  ]}
                />
              </>
            )}
          </TouchableOpacity>
        );
      })}
      {panelVisible && (
        <>
          <Animated.View
            style={[
              styles.centerOverlay,
              { height: screenHeight, opacity: panelAnimation.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
            ]}
            pointerEvents="auto"
          />
          <Animated.View
            style={[
              styles.centerActionPanel,
              {
                width: screenWidth - 20,
                bottom: totalBarHeight + 10,
                opacity: panelAnimation,
                transform: [
                  { scaleX: panelAnimation },
                  { scaleY: panelAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] }) },
                  { translateY: panelAnimation.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) },
                ],
              },
            ]}
            pointerEvents="auto"
          />
        </>
      )}
      </View>
    </View>
  );
}), {
  height: TAB_NAVIGATOR_HEIGHT,
  getHeight: getTabNavigatorHeight,
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    paddingTop: VERTICAL_PADDING, // small vertical padding above icons/labels
    zIndex: 2, // Keeps the cancel action above the dashboard overlay
  },
  centerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 44, 34, 0.28)',
    zIndex: 3,
  },
  centerActionPanel: {
    position: 'absolute',
    left: 10,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    zIndex: 4,
  },
  tabBarShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    flex: 1, // Dynamically chunks workspace into equal columns (your 74px equivalent grids)
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    // height intentionally omitted: stretches to fill the 72px content
    // row between tabBar's top/bottom padding
  },
  centerActionTab: {
    zIndex: 5,
    elevation: 5,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  icon: {
    width: 22, // Tightened icon size
    height: 22,
  },
  label: {
    fontSize: 11, // Reduced label font size
    fontWeight: '500',
    marginTop: 1, // Tightened spacing
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2, // From design: 2px radius dot
    marginTop: 3, // Flows below the label in normal layout
  },
  centerButtonOuter: {
    width: CENTER_OUTER_SIZE, // 72px halo per design
    height: CENTER_OUTER_SIZE,
    borderRadius: CENTER_OUTER_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    top: -CENTER_LIFT, // Floats the whole assembly above the bar's top edge
  },
  centerButtonInner: {
    width: CENTER_INNER_SIZE, // 52px action button per design
    height: CENTER_INNER_SIZE,
    borderRadius: CENTER_INNER_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusSymbol: {
    color: '#ffffff',
    fontSize: 26, // Scaled plus icon
    fontWeight: '300',
    lineHeight: 28,
    textAlign: 'center',
  },
});

export default TabNavigator;      