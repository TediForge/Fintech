import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const baseWidth = 410; // smallest device baseline
const scale = width / baseWidth;

const brandColor = '#0c5b3f';

const financeProducts = [
  {
    id: 'spend-save',
    title: 'Spend & Save',
    description: 'Spend confidently, save automatically, and build toward your goals.',
    yield: '23.00%',
    actionLabel: 'Start with ₦500',
    route: 'SpendSaveScreen',
    badge: 'HOT',
  },
  {
    id: 'smart-lock',
    title: 'SmartLock',
    description: 'Lock your money securely and earn high interest returns.',
    yield: '24.50%',
    actionLabel: 'Lock Now',
    route: 'SmartLockScreen',
  },
];

export default function GrowthCards({ renderTab, isAuthResolved = true }) {
  const navigation = useNavigation();

  if (!isAuthResolved) {
    return (
      <View style={styles.placeholderWrapper}>
        <View style={styles.placeholderCard} />
        <View style={styles.placeholderCard} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.cardRow}>
        {financeProducts.slice(0, 2).map((product) => (
          <TouchableOpacity
            key={product.id}
            style={styles.card}
            onPress={() => navigation.navigate(product.route)}
          >
            {product.badge && (
              <View style={styles.hotBadge}>
                <Text style={styles.hotText}>{product.badge}</Text>
              </View>
            )}
            <Text style={styles.title}>{product.title}</Text>
            <Text style={styles.desc}>{product.description}</Text>
            <Text style={styles.yield}>{product.yield}</Text>
            <Text style={styles.yieldLabel}>Annual Yield</Text>
            <View style={styles.actionBtn}>
              <Text style={styles.actionText}>{product.actionLabel}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => navigation.replace('Dashboard', { tab: 'Finance' })}
        style={styles.moreLink}
      >
        <Text style={styles.moreText}>More Finance Products</Text>
        <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/128/271/271228.png' }}
            style={styles.seeAllIcon}
          />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholderWrapper: {
    backgroundColor: '#fff',
    borderRadius: 18 * scale,
    marginHorizontal: 16 * scale,
    marginVertical: 10 * scale,
    padding: 14 * scale,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  placeholderCard: {
    width: '48%',
    height: 140 * scale,
    borderRadius: 16 * scale,
    backgroundColor: '#F1F6F3',
  },
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: 18 * scale,
    marginHorizontal: 16 * scale,
    marginVertical: 10 * scale,
    padding: 14 * scale,
  },

  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  card: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16 * scale,
    width: '48%',
    padding: 12 * scale,
    position: 'relative',
  },

  title: {
    fontWeight: '600',
    fontSize: 15 * scale,
    color: '#0E3C2E',
    marginBottom: 6 * scale,
  },

  desc: {
    fontSize: 12 * scale,
    color: '#555',
    marginBottom: 10 * scale,
  },

  yield: {
    fontSize: 22 * scale,
    fontWeight: 'bold',
    color: '#17b169',
    marginBottom: 4 * scale,
  },

  yieldLabel: {
    fontSize: 12 * scale,
    color: '#888',
    marginBottom: 10 * scale,
  },

  actionBtn: {
    backgroundColor: '#0E3C2E',
    borderRadius: 16 * scale,
    paddingVertical: 5 * scale,
    paddingHorizontal: 10 * scale,
    alignSelf: 'flex-start',
  },

  actionText: {
    color: '#fff',
    fontSize: 12 * scale,
    fontWeight: '600',
  },

  hotBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#dfe8e5',
    paddingHorizontal: 6 * scale,
    paddingVertical: 2 * scale,
    borderTopRightRadius: 16 * scale,
    borderBottomLeftRadius: 10 * scale,
    zIndex: 10,
  },

  hotText: {
    fontSize: 7,
    color: '#5a9a8e',
    fontWeight: 'bold',
    padding: 1,
  },

  moreLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14 * scale,
  },

  moreText: {
    fontSize: 11,
    color: '#777',
  },

  seeAllIcon: {
    width: 6,
    height: 6,
    marginLeft: 3,
            tintColor: brandColor,
    marginTop: 2,
  },
});