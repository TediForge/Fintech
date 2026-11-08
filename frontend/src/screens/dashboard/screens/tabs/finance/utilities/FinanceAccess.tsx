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

const BRAND_COLOR = '#0c5b3f';
const INACTIVE_COLOR = '#D1E4DD';

const financeData = [
  {
    id: 'smartwealth',
    title: 'SmartWealth',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/7653/7653246.png' },
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'SmartWealth',
    hasBadge: false,
  },
  {
    id: 'smartlock',
    title: 'SmartLock',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/14897/14897296.png' },
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'PayCable',
    hasBadge: false,
  },
  {
    id: 'spendsave',
    title: 'Spend & Save',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/18855/18855297.png' },
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'SpendSaveScreen',
    hasBadge: true,
    badgeText: 'Hot',
    badgeColor: 'red',
    badgeTextColor: '#fff',
  },
  {
    id: 'SmartBox',
    title: 'SmartBox',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/7653/7653246.png' },
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'ProfilePhotoUploa',
    hasBadge: true,
    badgeText: 'New',
    badgeColor: '#C2E887',
    badgeTextColor: '#0e3c2e',
  },
  {
    id: 'smartloan',
    title: 'Targets',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/18675/18675145.png' },
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'FacialVerification',
    hasBadge: false,
  },
  {
    id: 'insurance',
    title: 'Insurance',
    image: { uri: 'https://cdn-icons-png.flaticon.com/128/16448/16448701.png' },
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    type: 'navigate',
    page: 'InsuranceScreen',
    hasBadge: false,
  },
];

const FinanceAccess = ({ renderTab }) => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const handleAction = (type, page) => {
    if (type === 'navigate') {
      navigation.navigate(page);
    } else if (type === 'render') {
      renderTab(page);
    }
  };

  const renderService = ({ item }) => (
    <TouchableOpacity
      style={[styles.serviceBox, { backgroundColor: isDark ? colors.surface : colors.card }]}
      onPress={() => handleAction(item.type, item.page)}
    >
      <View style={styles.serviceContent}>
        <View style={styles.iconWrapper}>
          <Image
            source={item.iconBottom}
            style={[styles.iconBottom, { tintColor: colors.accentSoft }]}
          />
          <Image
            source={item.image}
            style={[styles.mainIcon, { tintColor: colors.accent }]}
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
        <Text style={[styles.title, { color: colors.textSecondary }]}>My Vaults</Text>
      </View>

      <FlatList
        data={financeData}
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

export default FinanceAccess;

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
    color: '#222',
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
    marginLeft: 2 * scale,
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