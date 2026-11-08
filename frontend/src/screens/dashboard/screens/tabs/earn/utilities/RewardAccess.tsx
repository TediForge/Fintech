import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@providers/ThemeProvider';

const { width } = Dimensions.get('window');
const baseWidth = 410; // smallest device baseline
const scale = width / baseWidth;

const rewardData = [
  {
    id: 'hotstreak',
    title: 'Hot Streak',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/3916/3916984.png' },
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'StreakScreen',
    hasBadge: false,
    useTint: true,
    customSize: 16.5,
  },
  {
    id: 'swap_bonus',
    title: 'Swap Bonus',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/16497/16497878.png' }, // Professional withdrawal/money-out icon
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'walletTransfer',
    params: { source: 'CASHBACK' },
    hasBadge: false,
    useTint: true,
    customSize: 15.5,
  },
  {
    id: 'myhistory',
    title: 'Activities',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/6785/6785394.png' },
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'TransactionHistoryScreen',
    params: { walletType: 'CASHBACK' },
    hasBadge: false,
    useTint: true,
    customSize: 16,
  },
];

const RewardAccess = ({ renderTab }) => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const handleAction = (type, page, params) => {
    if (type === 'navigate') {
      navigation.navigate(page, params);
    } else if (type === 'render') {
      renderTab(page);
    }
  };

  const renderService = ({ item }) => (
    <TouchableOpacity
      style={[styles.serviceBox, { backgroundColor: isDark ? colors.surface : colors.card }]}
      onPress={() => handleAction(item.type, item.page, item.params)}
    >
      <View style={styles.serviceContent}>
        <View style={styles.iconWrapper}>
          <Image
            source={item.iconBottom}
            style={[styles.iconBottom, { tintColor: colors.accentSoft }]}
          />
          <Image
            source={item.image}
            style={[
              styles.mainIcon,
              item.useTint !== false && { tintColor: colors.accent },
              item.customSize ? { width: item.customSize * scale, height: item.customSize * scale } : null
            ]}
          />
          {item.hasBadge && (
            <View style={[styles.badge, { backgroundColor: item.badgeColor }]}>
              <Text style={[styles.badgeText, { color: item.badgeTextColor }]}>
                {item.badgeText}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>My Perks</Text>
      </View>

      <FlatList
        data={rewardData}
        renderItem={renderService}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.servicesGrid}
        scrollEnabled={false}
      />
    </View>
  );
};

export default RewardAccess;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 3 * scale,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8 * scale,
    marginBottom: 8 * scale,
    paddingHorizontal: 5 * scale,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  servicesGrid: {},
  row: {
    justifyContent: 'space-between',
  },
  serviceBox: {
    width: (width - 50) / 3,
    height: 47 * scale,
    marginBottom: 7 * scale,
    borderRadius: 10 * scale,
    justifyContent: 'center',
    paddingLeft: 10 * scale,
  },
  serviceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7 * scale,
  },
  iconWrapper: {
    width: 28 * scale,
    height: 28 * scale,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBottom: {
    width: 28 * scale,
    height: 28 * scale, 
  },
  mainIcon: {
    width: 16 * scale,
    height: 16 * scale,
    position: 'absolute',
    resizeMode: 'contain',
  },
  label: {
    fontWeight: '600',
    fontSize: 10 * scale,
    marginLeft: 3 * scale,
  },
  badge: {
    position: 'absolute',
    top: -5.5 * scale,
    right: -5 * scale,
    borderRadius: 8 * scale,
    paddingHorizontal: 4,
    paddingVertical: 1 * scale,
    minWidth: 16 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 6,
  },
});