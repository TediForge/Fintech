import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  FlatList,
  Platform,
  Dimensions,
  ScrollView, 
  Image,
  Linking 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import SocialAccess from '@components/extra/SocialAccess';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';
import { formatDate as sharedFormatDate } from '@lib/utils/format';
import Constants from 'expo-constants';
import HelpBanner from '@components/extra/HelpBanner';
import LoadingScreen from '@components/Loading/LoadingScreen';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';

const BRAND_COLOR = '#0E3C2E';
const api = apiConfig.baseUrl;
const chatEndpoint = `${api}/v1/help/support/chat/index.php`;
const { width } = Dimensions.get('window');
const baseWidth = 410; // smallest device baseline
const scale = width / baseWidth;

export default function CustomerService({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [socialLinks, setSocialLinks] = useState(null);
  const [supportLoading, setSupportLoading] = useState(true); // only for support section
  const [hasActiveChat, setHasActiveChat] = useState(false);
  const [showFABText, setShowFABText] = useState(true); // controls floating button text

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchChats);
    fetchSocialLinks(); // runs in parallel, doesn't block chat loading
    return unsubscribe;
  }, [navigation]);

  const fetchSocialLinks = async () => {
    setSupportLoading(true);
    try {
      const res = await fetch(`${api}/v1/help/socials/index.php`);
      const json = await res.json();
      if (json?.success && json?.data) {
        const support = json.data.support || {};
        const normalizedLinks = {
          support_whatsapp: support.whatsapp,
          support_phone: support.phone,
          support_email: support.email,
        };
        setSocialLinks(normalizedLinks);
        console.log('Loaded social links:', normalizedLinks);
      }
    } catch (err) {
      console.log('Failed to load social links:', err);
      // no fallback — will show "Not available" on tap
    } finally {
      setSupportLoading(false); // support section ready quickly
    }
  };

  const fetchChats = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getSessionToken();
      const query = new URLSearchParams({
        action: 'getChat',
        ...(token ? { [config.sessionToken]: token } : {}),
      });
      const res = await fetch(`${chatEndpoint}?${query.toString()}`);
      const text = await res.text();
      if (!text.trim()) {
        setErrorMsg("Empty response from server");
        setChats([]);
        setLoading(false);
        return;
      }
      const json = JSON.parse(text);
      if (json.status === "success") {
        const sortedChats = (json.data || []).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        setChats(sortedChats.slice(0, 3));
        setHasActiveChat(sortedChats.some(chat => chat.chat_state !== 'closed'));
        if (sortedChats.length === 0) {
          setErrorMsg("No active support chats found");
        }
      } else {
        setErrorMsg(json.message || "Failed to load chats");
        setChats([]);
        setHasActiveChat(false);
      }
    } catch (e) {
      setErrorMsg("Network error: " + (e.message || "Unknown error"));
      setChats([]);
      setHasActiveChat(false);
    } finally {
      setLoading(false); // chat list ready independently
    }
  };

  const startNewChat = async () => {
    if (hasActiveChat) {
      Alert.sheet(
        "Wait for Resolution",
        "You have an ongoing chat"
      );
      return; 
    }
    try {
      const token = await getSessionToken();
      const res = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'startChat',
          [config.sessionToken]: token || '',
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        navigation.navigate('ChatRoom', { chatId: json.data.chatId, ticketId: json.data.ticketId });
      } else {
        alert(json.message || "Unable to start chat.");
      }
    } catch (e) {
      alert("Failed to start chat.");
    }
  };

  // Support contact actions — ALL from backend JSON, no hardcoded values
  const openWhatsApp = () => {
    if (!socialLinks?.support_whatsapp) {
      alert("WhatsApp support not available at the moment");
      return;
    }
    const message = encodeURIComponent("Hello Tediwave Support, I need help with...");
    Linking.openURL(`${socialLinks.support_whatsapp}?text=${message}`)
      .catch(() => alert("Cannot open WhatsApp"));
  };

  const callSupport = () => {
    if (!socialLinks?.support_phone) {
      alert("Phone support not available at the moment");
      return;
    }
    Linking.openURL(`tel:${socialLinks.support_phone}`)
      .catch(() => alert("Cannot make call"));
  };

  const emailSupport = () => {
    if (!socialLinks?.support_email) {
      alert("Email support not available at the moment");
      return;
    }
    const subject = encodeURIComponent("Customer Support Request");
    const body = encodeURIComponent("Hello Tediwave Team,\n\nI would like assistance with...\n\nThank you.");
    Linking.openURL(`mailto:${socialLinks.support_email}?subject=${subject}&body=${body}`)
      .catch(() => alert("Cannot open email"));
  };

  const renderChatItem = ({ item }) => {
    const lastUpdated = item.updated_at ? new Date(item.updated_at) : null;
    const timeAgo = lastUpdated ? formatTimeAgo(lastUpdated) : '';
    return (
      <TouchableOpacity
        style={styles.chatCard}
        onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, ticketId: item.ticketId })}
      >
        <View style={[styles.statusIcon, { backgroundColor: getStatusBg(item.status) }]}>
          <Image
            source={{
              uri: item.status === 'escalated'
                ? 'https://paysmart.com.ng/assets/brand-logos/bitmap.png'
                : 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRB38k3L8mMi01-271cYp8mP4uCJa6cmrWNHA&s'
            }}
            style={[styles.supportIconImage, { width: 32, height: 32, borderRadius: 9, }]}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={styles.subject} numberOfLines={1}>{item.subject || 'No subject yet'}</Text>
           <Text
              style={[
                styles.escalatedTag,
                getStatusColors(item.status)
              ]}
            >
              {item.ticketId || 'Generating...'}
            </Text>
          </View>
          
         <View style={styles.row}>
            <Text
              style={{ width: '60%', fontSize: 10, color: '#999' }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.status === 'escalated'
                ? 'Chat Escalated'
                : item.status === 'closed'
                ? 'Chat Closed'
                : 'Chat with AI'}
            </Text>
            <Text
              style={{ width: '40%', textAlign: 'right', fontSize: 10, color: '#999' }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {timeAgo ? `${timeAgo}` : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getStatusColors = (status) => {
    switch (status) {
      case 'escalated':
        return { backgroundColor: 'rgba(194, 65, 12, 0.15)', color: '#C2410C' };
      case 'closed':
        return { backgroundColor: 'rgba(75, 85, 99, 0.15)', color: '#4B5563' };
      default: // AI or any other
        return { backgroundColor: 'rgba(30, 58, 138, 0.15)', color: '#1E3A8A' };
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'escalated':
        return 'rgba(194, 65, 12, 0.15)';
      case 'closed':
        return 'rgba(75, 85, 99, 0.15)';
      default:
        return 'rgba(30, 58, 138, 0.15)';
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    return sharedFormatDate(date);
  };

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <View>{renderSupportCard()}</View>
      <SocialAccess />
    </View>
  );

const renderSupportCard = () => {
    const supportItems = [
      {
        id: 'whatsapp',
        title: 'WhatsApp Support',
        desc: 'Reply usually within seconds',
        icon: 'logo-whatsapp',
        onPress: openWhatsApp,
      },
      {
        id: 'phone',
        title: 'Call Support',
        desc: 'Mon–Fri, 9AM–5PM',
        icon: 'call',
        onPress: callSupport,
      },
      {
        id: 'email',
        title: 'Email Support',
        desc: 'Reply usually within 12 hours',
        icon: 'mail',
        onPress: emailSupport,
      },
      {
        id: 'offices',
        title: 'Our Offices',
        desc: 'Visit any of our regional branches',
        icon: 'location-sharp',
        onPress: () => navigation.navigate('FindUsScreen'),
      },
    ];

    const visibleItems = supportItems.filter((item) => {
      if (item.id === 'whatsapp' && !socialLinks?.support_whatsapp) return false;
      if (item.id === 'phone' && !socialLinks?.support_phone) return false;
      if (item.id === 'email' && !socialLinks?.support_email) return false;
      return true;
    });

    return (
      <View style={styles.supportSection}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Help Desk</Text>
        </View>

        {supportLoading ? (
          <FeatureCardGrid
            items={Array.from({ length: 4 }).map((_, idx) => ({ id: `placeholder-${idx}` }))}
            isLoading={true}
            delayMs={350}
          />
        ) : visibleItems.length > 0 ? (
          <FeatureCardGrid
            items={visibleItems}
            onPress={(item) => item.onPress?.()}
            delayMs={0}
          />
        ) : (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: '#888', fontSize: 12 }}>No support channels available</Text>
          </View>
        )}
      </View>
    );
  };

  return ( 
    <>
      <LoadingScreen visible={loading} message="Please Wait.." />
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

        <ScreenHeader
          title="Customer Service"
          backgroundColor="#eff7f4"
          textColor="#1A1A1A"
          iconColor="#1A1A1A"
          rightComponent={null} // removed new chat button from header
        />

        <FlatList
          data={chats}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.content, styles.scrollContent]}
          renderItem={renderChatItem}
          ListHeaderComponent={
            <>
              <HelpBanner />
              <View style={styles.topRow}>
                <Text style={styles.title}>Live Chats</Text>
              </View>
            </>
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !loading ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: '#888', fontSize: 12 }}>{errorMsg}</Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setShowFABText(false)}
          onMomentumScrollEnd={() => setTimeout(() => setShowFABText(true), 3000)}
          bounces={true}
          overScrollMode="never"
          decelerationRate="normal"
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />

        {/* FLOATING NEW CHAT BUTTON - always at bottom right */}
        <TouchableOpacity 
          style={[
            styles.fabButton,
            !showFABText && styles.fabButtonCollapsed
          ]} 
          onPress={startNewChat}
          activeOpacity={0.9}
        >
          <View style={styles.fabContent}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#FFF" />
          </View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingVertical: 10,
    paddingBottom: 40,
  },
  content: { 
    paddingHorizontal: 16, 
    paddingTop: 20, 
    paddingBottom: 100 
  },
  newBtn: {},
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
  chatCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  statusIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  ticketId: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND_COLOR,
    letterSpacing: 1
  },
  escalatedTag: {
    fontSize: 8,
    color: '#FF5A5F',
    fontWeight: 'bold',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4
  },
  subject: { fontWeight: '700', fontSize: 12, color: '#333' },
  preview: { fontSize: 10, color: '#999' },
  empty: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  footerContainer: { marginTop: 10 },
  // Support section (exact match to permissionCard styling)
  supportSection: {
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginBottom: 4,
  },
  supportSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  // ────────────────────────────────────────
  // Permission card styles
  permissionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  cardInternalWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  leftInfoSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconWrapper: {
    width: 35,
    height: 35,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  supportIconImage: {
    width: 18,
    height: 18,
  },
  textMetadataContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_COLOR,
    marginBottom: 2,
  },
  permissionDesc: {
    fontSize: 10,
    color: "#64748B",
    lineHeight: 16,
  },
  supportNewImage: {
    width: 20,
    height: 20,
    opacity: 0.9,
  },
  liveChatsHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  liveChatsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
  },

  // FLOATING ACTION BUTTON
  fabButton: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    backgroundColor: BRAND_COLOR,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  fabButtonCollapsed: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 7,
  },
}); 