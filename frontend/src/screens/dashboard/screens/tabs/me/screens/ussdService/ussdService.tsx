import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import ScreenHeader from '@components/headers/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import CustomSwitch from '@components/common/Switch';
import { useTheme } from '@providers/ThemeProvider';
import { getSessionToken } from '@hooks/useAuth';
import * as Clipboard from 'expo-clipboard';
import OptionCard from '@components/extra/OptionCard';
import { Linking } from 'react-native';
import config from '@config/app';
import { apiConfig } from '@config/api';

const { width } = Dimensions.get('window');
const scale = width / 410;

const ussdCodes = [
  {
    title: 'Check Balance',
    code: '*123*1#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
  {
    title: 'Send Money',
    code: '*123*2#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
  {
    title: 'Buy Airtime',
    code: '*123*3#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
  {
    title: 'Buy Data',
    code: '*123*4#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
  {
    title: 'Pay Bills',
    code: '*123*5#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
  {
    title: 'Bank Transfer',
    code: '*123*6#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
  {
    title: 'Generate Token',
    code: '*123*7#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
  {
    title: 'Reset PIN',
    code: '*123*8#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
  {
    title: 'Customer Support',
    code: '*123*9#',
    image: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png',
  },
];

export default function UssdServiceScreen() {
  const { colors, isDark } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [copyingCode, setCopyingCode] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const syncUssdStatus = useCallback(async () => {
    setLoading(true);
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        Alert.sheet('Session unavailable', 'Please log in again.');
        return;
      }

      const response = await fetch(`${apiConfig.baseUrl}/v1/user/settings/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionToken,
          setting: 'ussdAccess',
        }),
      });

      const data = await response.json();
      if (data?.status === 'success' && typeof data.details?.enabled === 'boolean') {
        setEnabled(data.details.enabled);
      } else {
        throw new Error(data?.message || 'Failed to fetch USSD status');
      }
    } catch (error) {
      Alert.sheet('Sync Failed', 'Could not retrieve the current USSD status. Please try again.');
    } finally {
      setLoading(false);
      setIsReady(true);
    }
  }, []);

  const toggleUssd = async (value) => {
    setEnabled(value);
    setLoading(true);

    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        Alert.sheet('Session unavailable', 'Please log in again and try again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiConfig.baseUrl}/v1/user/settings/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: sessionToken,
          setting: 'ussdAccess',
          enabled: value,
        }),
      });

      const data = await response.json();
      if (data?.status !== 'success') {
        throw new Error('Failed to update USSD setting');
      }
    } catch (error) {
      Alert.sheet('Unable to update', 'Please check your connection and try again.');
      setEnabled(!value);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      syncUssdStatus();
    }, [syncUssdStatus])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    syncUssdStatus().finally(() => setRefreshing(false));
  }, [syncUssdStatus]);

  const handleCopy = async (code) => {
    setCopyingCode(code);
    try {
      await Clipboard.setStringAsync(code);
      setTimeout(() => {
        Alert.sheet('Copied', `"${code}" has been copied to your clipboard.`);
        setCopyingCode(null);
      }, 300); // A brief delay to make the loading indicator visible
    } catch (error) {
      Alert.sheet('Copy Failed', 'Could not copy the code. Please try again.');
      setCopyingCode(null);
    }
  };

  const handleDial = async (code) => {
    try {
      // Encode the hash character for tel: URI
      const tel = `tel:${code.replace(/#/g, '%23')}`;
      const supported = await Linking.canOpenURL(tel);
      if (supported) {
        await Linking.openURL(tel);
        return;
      }
    } catch (err) {
      // fallback to copying
    }

    // If dialing isn't supported, copy to clipboard as a fallback
    await handleCopy(code);
  };
  const accentColor = colors.accent;
  const cardBackground = colors.card;
  const textColor = colors.textPrimary;
  const mutedText = colors.textSecondary;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

        <ScreenHeader title="USSD Service" backgroundColor={colors.surface} textColor={textColor} iconColor={textColor} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
        <View style={[styles.settingCard, { backgroundColor: cardBackground }]}>
          <View style={styles.settingRow}>
            <ImageBackground
              source={{ uri: 'https://paysmart.com.ng/assets/images/plain.png' }}
              style={[styles.leftIcons, { tintColor: colors.surface }]}
              imageStyle={styles.leftIcons}
            >
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/2111/2111607.png' }}
                style={[styles.icon, { tintColor: colors.textPrimary }]}
              />
            </ImageBackground>

            <View style={styles.settingTextWrap}>
              <Text style={[styles.settingTitle, { color: textColor }]}>USSD Banking</Text>
              <Text style={[styles.settingDescription, { color: mutedText }]}>Send cash, pay bills via USSD</Text>
            </View>

            <View style={styles.switchWrapper}>
              <CustomSwitch
                value={isReady ? enabled : false}
                onValueChange={toggleUssd}
                width={40}
                height={28}
              />
            </View>
          </View>
        </View> 

        <View style={styles.wrapper}>
          <View style={styles.topRow}>
            <Text style={[styles.title, { color: colors.textSecondary }]}>USSD Codes</Text>
          </View>
        </View>

        {ussdCodes.map((item, index) => (
          <OptionCard
            key={`${item.title}-${index}`}
            item={item}
            onPress={() => handleDial(item.code)}
            imageUri={item.image}
            title={item.title}
            subtitle={item.code}
            renderRight={({ selected, item: it }) => (
              <TouchableOpacity
                onPress={() => handleDial(it.code)}
                disabled={!!copyingCode}
              >
                {copyingCode === it.code ? (
                  <ActivityIndicator size="small" color={accentColor} />
                ) : (
                  <Ionicons name="call" size={16} color={accentColor} />
                )}
              </TouchableOpacity>
            )}
          />
        ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  settingCard: {
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 24,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftIcons: {
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    height: 32,
    width: 32,
    resizeMode: 'contain',
  },
  icon: {
    width: 15,
    height: 15,
    resizeMode: 'contain',
  },
  settingTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  switchWrapper: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  settingTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  settingDescription: {
    marginTop: 1.5,
    fontSize: 10,
    lineHeight: 14,
  },
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
  codeCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  codeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
  },
  copyButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 50,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  codeValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  codeDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
