import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Dimensions,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import config from '@config/app';
import { apiConfig } from '@config/api';

const { width } = Dimensions.get('window');
const baseWidth = 410; // smallest device baseline
const scale = width / baseWidth;

const BRAND_COLOR = '#0c5b3f';
const INACTIVE_COLOR = '#D1E4DD';

const socialData = [
  {
    id: 'facebook',
    title: 'Facebook',
    icon: 'facebook-f',
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    hasBadge: false,
  },
  {
    id: 'instagram',
    title: 'Instagram',
    icon: 'instagram',
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    hasBadge: true,
    badgeText: 'Live',
    badgeColor: BRAND_COLOR,
    badgeTextColor: '#fff',
  },
  {
    id: 'twitter',
    title: 'Twitter (X)',
    icon: 'twitter',
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    hasBadge: false,
  },
  {
    id: 'linkedin',
    title: 'LinkedIn',
    icon: 'linkedin-in',
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    hasBadge: false,
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    icon: 'tiktok',
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    hasBadge: false,
  },
  {
    id: 'youtube',
    title: 'YouTube',
    icon: 'youtube',
    iconBottom: { uri: 'https://paysmart.com.ng/assets/images/plain.png' },
    hasBadge: true,
    badgeText: 'New',
    badgeColor: 'red',
    badgeTextColor: '#fff',
  },
];

const SocialAccess = () => {
  const [remoteLinks, setRemoteLinks] = useState({});

  useEffect(() => {
    const fetchSocialLinks = async () => {
      try {
        const response = await fetch(`${apiConfig.baseUrl}/v1/help/socials/index.php`);
        const data = await response.json();
        if (data?.success && data?.data?.social) {
          setRemoteLinks(data.data.social);
        }
      } catch (error) {
        console.log("Error loading remote socials:", error);
      }
    };
    fetchSocialLinks();
  }, []);

  const handleSocialPress = (item) => {
    const targetUrl = remoteLinks[item.id];
    if (targetUrl) {
      Linking.openURL(targetUrl).catch(err => console.error("Couldn't load page", err));
    } else {
      Alert.sheet('Notice', 'Link is temporarily unavailable.');
    }
  };

  const renderSocial = ({ item }) => (
    <TouchableOpacity
      style={styles.serviceBox}
      onPress={() => handleSocialPress(item)}
    >
      <View style={styles.serviceContent}>
        <View style={styles.iconWrapper}>
          <Image
            source={item.iconBottom}
            style={styles.iconBottom}
          />
          <View style={styles.socialIconContainer}>
            <FontAwesome5 name={item.icon} size={14 * scale} color={BRAND_COLOR} />
          </View>
          {item.hasBadge && (
            <View style={[styles.badge, { backgroundColor: item.badgeColor }]}>
              <Text style={[styles.badgeText, { color: item.badgeTextColor }]}>
                {item.badgeText}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.label}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Our Socials</Text>
      </View>

      <FlatList
        data={socialData}
        renderItem={renderSocial}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.servicesGrid}
        scrollEnabled={false}
      />
    </View>
  );
};

export default SocialAccess;

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 15,
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
    height: 45 * scale,
    backgroundColor: '#fff',
    marginBottom: 7 * scale,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f2f2f2',
    justifyContent: 'center',
    paddingLeft: 10 * scale,
  },
  serviceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7 * scale,
  },
  iconWrapper: {
    width: 26 * scale,
    height: 26 * scale,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBottom: {
    width: 26 * scale,
    height: 26 * scale,
    tintColor: INACTIVE_COLOR,
  },
  socialIconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: '#111',
    fontWeight: '500',
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