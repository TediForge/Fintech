import { Alert } from '@components/common/Alert';
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ImageBackground,
  Animated,
  Image,
  FlatList,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import useApiClient from '@hooks/apiClient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@providers/ThemeProvider';

// Calculate responsive dimensions based on parent container width
const { width: windowWidth } = Dimensions.get('window');
const HORIZONTAL_PADDING = 20;
const CARD_WIDTH = windowWidth - (HORIZONTAL_PADDING * 2);
const BASE_WIDTH = 410;
const BASE_HEIGHT = 470;
const scale = CARD_WIDTH / BASE_WIDTH;
const CARD_HEIGHT = BASE_HEIGHT * scale;

// Scaling helpers for layout and snapping
const s = (size) => size * scale;
const CARD_MARGIN = s(15);
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN;

const BankCard = ({ onAccountsAvailable }) => {
  const { accounts } = useApiClient();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Refs for capturing specific cards
  const itemRefs = useRef([]);

  // Account data array for easy scaling
  const accountCards = (accounts || []).map((entry, index) => {
    const account = entry.account || {};
    const isInternal = entry.provider?.toLowerCase() === 'tediwave';
    return {
      id: `${account.provider || 'account'}-${account.accountNumber || index}`,
      type: isInternal ? 'INTERNAL' : 'EXTERNAL',
      title: isInternal ? 'Receive via Tediwave' : 'Pay with Bank Transfer',
      subtitle: isInternal ? '- Instant, zero-fee internal transfers -' : '- Intelligent, swift and protected transfers -',
      badge: entry.provider || account.bankName || 'Bank Account',
      details: [
        { label: 'Recipient Bank', value: account.bankName || 'N/A' },
        { label: 'Account Number', value: account.accountNumber || 'N/A' },
        { label: 'Account Name', value: account.accountName || 'Loading Details..' },
      ],
      themeColor: isInternal ? '#21053b' : '#0c5b3f',
      bgUri: 'https://paysmart.com.ng//assets/brand-logos/adaptive-background.png',
      iconColor: '#21053bff',
    };
  });

  useEffect(() => {
    onAccountsAvailable?.(accountCards.length > 0);
  }, [accountCards.length, onAccountsAvailable]);

  if (accountCards.length === 0) {
    return null;
  }

  const downloadCardAsImage = async () => {
    if (isDownloading) return;
    
    try {
      setIsDownloading(true);
      await new Promise(resolve => setTimeout(resolve, 150));
      const currentRef = itemRefs.current[activeIndex];
      if (currentRef) {
        const uri = await captureRef(currentRef, {
          format: 'png',
          quality: 1.0,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            dialogTitle: 'Download Account Details',
            mimeType: 'image/png',
          });
        } else {
          alert("Sharing is not available on this device");
        }
      }
    } catch (error) {
      console.error("Capture failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      const activeCard = accountCards[activeIndex];
      const primaryValue = activeCard.details[1].value;
      const primaryLabel = activeCard.details[1].label;
      await Clipboard.setString(primaryValue);
      
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      Alert.sheet(
        'Copied!',
        `${primaryLabel} copied to clipboard.`,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    } catch (error) {
      Alert.sheet('Error', 'Failed to copy.');
    }
  };

  const renderCard = ({ item, index }) => {
    const isInternal = item.type === 'INTERNAL';
    // Remove margin from the very last item so it doesn't create empty scroll space at the end
    const isLastItem = index === accountCards.length - 1;

    return (
      <View style={[
        styles.cardWrapper, 
        !isLastItem && { marginRight: CARD_MARGIN }
      ]}>
        <ImageBackground
          source={{ uri: item.bgUri }}
          ref={(el) => (itemRefs.current[index] = el)}
          collapsable={false}
          style={styles.balanceBox}
          imageStyle={styles.cardImageRadius}
        >
          {/* Design-specific Overlay */}
          <View style={[
            styles.overlay,
            { backgroundColor: item.themeColor },
            isInternal ? styles.overlayInternal : styles.overlayExternal
          ]} />
          {/* Floating Download Button - Hidden during capture */}
          {!isDownloading && (
            <Animated.View style={[styles.floatingDownloadView, { opacity: fadeAnim }]}>
              <TouchableOpacity
                onPress={downloadCardAsImage}
                style={styles.downloadButton}
                disabled={isDownloading}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/128/9252/9252774.png' }}
                  style={[styles.downloadIcon, { tintColor: item.iconColor }]}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
          <View style={styles.balanceContent}>
            {/* SideBadge */}
            <View style={styles.sideBadge}>
              <Text style={[
                styles.badgeText,
                isInternal ? styles.badgeTextInternal : styles.badgeTextExternal
              ]}>
                {item.badge}
              </Text>
            </View>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text style={styles.cardSubtitle}>
                {item.subtitle}
              </Text>
            </View>
            
            {/* Account Card Content Boxes */}
            <View style={styles.boxContentMain}>
              {item.details.map((detail, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  onPress={copyToClipboard}
                  style={[styles.boxContentEach]}
                >
                  <View style={[
                    styles.boxContentUpCenter,
                    { backgroundColor: '#ccc' }
                  ]}>
                    <Text style={[styles.nameText, { color: '#022c22' }]} numberOfLines={1}>
                      {detail.label}
                    </Text>
                  </View>
                  <View style={[styles.boxContentDownCenter, { backgroundColor: '#fff' }]}>
                    <Text
                      style={[
                        styles.bankCardText,
                        detail.label === 'Account Name' ? styles.bankCardTextName : styles.bankCardTextNumber,
                        { color: '#21053b' }
                      ]}
                      numberOfLines={1}
                    >
                      {detail.value}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              
              <Text style={styles.sloganText}>
                Smart Payments for a Smarter Lifestyle
              </Text>
            </View>
            {/* Bottom Footer Section */}
            <View style={[styles.cardFooter, { borderTopColor: 'rgba(255, 255, 255, 0.3)', backgroundColor: 'rgba(200, 214, 209, 0.8)' }]}>
              <View style={styles.footerLeft}>
                <View style={[styles.appIcon, { backgroundColor: '#fff' }]}>
                  <Image
                    source={{ uri: 'https://paysmart.com.ng//assets/brand-logos/icon.png' }}
                    style={styles.iconImage}
                  />
                </View>
              </View>
              <View style={styles.footerRight}>
                <Text style={[styles.footerTextHelp, { color: 'rgba(255, 255, 255, 0.7)' }]}>
                  Need help? Contact us at
                </Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL('mailto:support@paysmart.com.ng')}>
                  <Text style={[styles.footerTextEmail, { color: '#fff' }]}>
                    support@paysmart.com.ng
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ImageBackground>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={accountCards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        snapToAlignment="center"
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
        getItemLayout={(data, index) => ({
          length: SNAP_INTERVAL,
          offset: SNAP_INTERVAL * index,
          index,
        })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
          setActiveIndex(index);
        }}
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
      />

      {/* Animated Pagination Dot Indicator */}
      <View style={styles.paginationContainer}>
        {accountCards.map((_, i) => {
          const width = scrollX.interpolate({
            inputRange: [(i - 1) * SNAP_INTERVAL, i * SNAP_INTERVAL, (i + 1) * SNAP_INTERVAL],
            outputRange: [8, 20, 8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange: [(i - 1) * SNAP_INTERVAL, i * SNAP_INTERVAL, (i + 1) * SNAP_INTERVAL],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width,
                  opacity,
                  backgroundColor: i === activeIndex ? colors.accent : colors.muted,
                }
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

export default BankCard;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 10,
  },
  flatListContent: {
    paddingHorizontal: 3,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBox: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    padding: s(16),
    borderRadius: s(16),
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cardImageRadius: {
    borderRadius: s(16),
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayInternal: {
    opacity: 0.10,
  },
  overlayExternal: {
    opacity: 0.10,
  },
  balanceContent: {
    flexDirection: 'column',
    position: 'relative',
    height: '100%',
    justifyContent: 'space-between',
  },
  boxContentMain: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    bottom: s(70),
    gap: s(15),
  },
  boxContentEach: {
    alignItems: 'center',
    width: '100%',
  },
  boxContentDownCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '81%',
    borderRadius: s(5),
    zIndex: 1,
    height: s(45),
  },
  boxContentUpCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: s(4),
    zIndex: 2,
    height: s(18),
    width: '35%',
    marginBottom: s(-7.5),
  },
  nameText: {
    fontWeight: '700',
    fontSize: s(10),
  },
  bankCardText: {
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
  },
  bankCardTextName: {
    fontSize: s(12),
  },
  bankCardTextNumber: {
    fontSize: s(15),
  },
  sloganText: {
    fontWeight: '400',
    color: '#fff',
    marginTop: -5,
    fontSize: s(10),
  },
  cardFooter: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0.5,
    borderBottomLeftRadius: s(16),
    borderBottomRightRadius: s(16),
    height: s(65),
    bottom: s(-17),
    left: s(-17),
    right: s(-17),
  },
  footerLeft: {
    flex: 1,
    paddingLeft: s(16),
  },
  footerRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: s(16),
  },
  footerTextHelp: {
    textTransform: 'uppercase',
    fontSize: s(9),
  },
  footerTextEmail: {
    textTransform: 'uppercase',
    fontSize: s(7),
    fontWeight: '800',
  },
  appIcon: {
    borderRadius: s(7),
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    width: s(30),
    height: s(30),
  },
  iconImage: {
    height: '100%',
    width: '100%',
    resizeMode: 'cover',
  },
  cardHeader: {
    position: 'absolute',
    right: 0,
    left: 0,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    top: s(60),
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: s(18),
    color: '#fff',
  },
  cardSubtitle: {
    fontWeight: '400',
    fontSize: s(12),
    color: '#fff',
    marginTop: s(4),
  },
  sideBadge: {
    position: 'absolute',
    left: s(-16),
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    zIndex: 3,
    top: s(10),
  },
  badgeText: {
    fontWeight: '700',
    fontSize: s(10),
  },
  badgeTextInternal: {
    color: '#21053b',
  },
  badgeTextExternal: {
    color: '#0c5b3f',
  },
  floatingDownloadView: {
    position: 'absolute',
    zIndex: 10,
    top: s(13),
    right: s(13),
  },
  downloadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 0.5,
    borderColor: 'rgba(33, 5, 59, 0.1)',
    padding: s(10),
    borderRadius: s(30),
  },
  downloadIcon: {
    resizeMode: 'contain',
    width: s(16),
    height: s(16),
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: s(15),
  },
  dot: {
    height: s(8),
    borderRadius: s(4),
    marginHorizontal: s(4),
  },
});