import { Alert } from '@components/common/Alert';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  Text,
  Image,
  TouchableOpacity,
  Linking,
  RefreshControl,
  TextInput,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatDate as sharedFormatDate, formatTime as sharedFormatTime } from '@lib/utils/format';
import ScreenHeader from '@components/headers/ScreenHeader';
import SearchBar from '@components/common/SearchBar';
import Tabs from '@components/extra/Tabs';
import LoadingScreen from '@components/Loading/LoadingScreen';
import config from '@config/app';
import { apiConfig } from '@config/api';
import NotificationCard from './utilities/notificationCard';

const api = apiConfig.baseUrl;

const { width } = Dimensions.get('window');
const sliderWidth = width - 32;
const sliderHeight = sliderWidth * (500 / 1500);
const BRAND_DARK = "#0E3C2E";
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";

const notificationTabs = [
  { label: 'General', value: 'general' },
  { label: 'Transactions', value: 'transaction' },
  { label: 'Security', value: 'security' },
];

const BACKEND_URL = `${api}/v1/user/activity/notification`;
const DEFAULT_PROFILE = 'https://paysmart.com.ng/assets/brand-logos/bitmap.png';

const formatNotificationDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const time = sharedFormatTime(date);

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;

  const formatted = sharedFormatDate(date);
  return `${formatted} ${time}`;
};

const NotificationScreen = ({ navigation }) => {
  const [selectedTab, setSelectedTab] = useState('general');
  const [allNotifications, setAllNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setMessage] = useState('Loading notifications...');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isSyncing = useRef(false);
  const swipeableRefs = useRef(new Map());

  const fetchNotifications = async (isSilent = false) => {
    if (isSyncing.current) return;
    
    try {
      if (!isSilent) {
        setLoading(true);
        setMessage('Loading notifications...');
      }
      isSyncing.current = true;

      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        if (!isSilent) {
          setLoading(false);
          Alert.sheet('Error', 'Session token missing.');
        }
        return;
      }

      const formData = new FormData();
      formData.append(config.sessionToken, sessionToken);

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
      });

      const text = await response.text();
      let json = null;
      if (text && text.trim()) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }

      if (json?.status === 'success') {
        const all = json.data || [];
        setAllNotifications(all);
      } else if (!isSilent) {
        Alert.sheet('Error', json?.message || 'Unable to load notifications right now.');
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
      if (!isSilent) {
        Alert.sheet('Error', error.message);
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
        setMessage('');
      }
      isSyncing.current = false;
    }
  };

  const filteredNotifications = useMemo(() => {
    return allNotifications.filter(item => {
      const itemCat = (item.category || 'general').toLowerCase();
      const matchesCategory = itemCat === selectedTab.toLowerCase();
      
      const searchContent = `${item.title} ${item.message}`.toLowerCase();
      const matchesSearch = searchQuery === '' || searchContent.includes(searchQuery.toLowerCase());
      
      return matchesCategory && matchesSearch;
    });
  }, [allNotifications, selectedTab, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(true);
    setRefreshing(false);
  }, [selectedTab, searchQuery]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) return;

      setAllNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: 1 } : n));

      const formData = new FormData();
      formData.append(config.sessionToken, sessionToken);
      formData.append('notification_id', notificationId);

      const res = await fetch(BACKEND_URL, { method: 'POST', body: formData });
      const json = await res.json();
      if (json.status !== 'success') console.warn('Mark as read failed:', json.message);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) return;

      // Optimistically remove from UI
      setAllNotifications(prev => prev.filter(n => n.id !== notificationId));

      const formData = new FormData();
      formData.append(config.sessionToken, sessionToken);
      formData.append('notification_id', notificationId);
      formData.append('action', 'delete');

      const res = await fetch(BACKEND_URL, { method: 'POST', body: formData });
      const json = await res.json();
      if (json.status !== 'success') {
        console.warn('Archive failed:', json.message);
        fetchNotifications(true); // Re-sync if failed
      }
    } catch (err) {
      console.error('Error archiving notification:', err);
      fetchNotifications(true);
    }
  };

  const handlePress = async (notification) => {
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        Alert.sheet('Not authenticated', 'Please login again.');
        return;
      }

      const notificationId = notification.id;
      
      if (!notification.is_read) {
        await handleMarkAsRead(notificationId);
      }

      const route = notification.action_route;
      const payload = notification.action_data;

      if (!route) return;

      const routeLower = String(route).toLowerCase();
      if (routeLower.startsWith('http')) {
        const supported = await Linking.canOpenURL(route);
        if (supported) await Linking.openURL(route);
        return;
      }

      if (navigation && typeof navigation.navigate === 'function') {
        let params = {};
        if (typeof payload === 'object' && payload !== null) params = payload;
        else {
          try { params = JSON.parse(String(payload)); } catch { params = { data: payload }; }
        }
        navigation.navigate(route, params);
      }
    } catch (err) {
      console.error('Error performing notification action:', err);
    }
  };

  const closeOtherSwipeables = (currentId) => {
    swipeableRefs.current.forEach((ref, id) => {
      if (id !== currentId && ref) {
        ref.close();
      }
    });
  };


  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(true), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!searchQuery) return;
    const searchLower = searchQuery.toLowerCase();
    
    const currentTabHasMatch = allNotifications.some(item => {
      const itemCat = (item.category || 'general').toLowerCase();
      if (itemCat !== selectedTab.toLowerCase()) return false;
      const searchContent = `${item.title} ${item.message}`.toLowerCase();
      return searchContent.includes(searchLower);
    });

    if (!currentTabHasMatch) {
      const alternativeTab = notificationTabs.find(tab => {
        if (tab.value === selectedTab) return false;
        return allNotifications.some(item => {
          const itemCat = (item.category || 'general').toLowerCase();
          if (itemCat !== tab.value.toLowerCase()) return false;
          const searchContent = `${item.title} ${item.message}`.toLowerCase();
          return searchContent.includes(searchLower);
        });
      });

      if (alternativeTab) {
        setSelectedTab(alternativeTab.value);
      }
    }
  }, [searchQuery, allNotifications]);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#e8f2ee', '#f5f8f7']} style={styles.gradientBackground}>
        <SafeAreaView style={styles.container}>
          <ScreenHeader 
            title="Notifications" 
            backgroundColor="#e8f2ee" 
            textColor="#000" 
            iconColor="#000" 
            rightComponent={
              <TouchableOpacity onPress={() => navigation.navigate('Settings', { page: 'system', search: 'Notification' })} style={{ padding: 0 }}>
                <Image 
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/128/16327/16327901.png' }} 
                  style={{ width: 22, height: 22, tintColor: '#0E3C2E' }} 
                />
              </TouchableOpacity>
            }
          />

          <View style={styles.topSection}>
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              placeholder="Search notifications"
              containerStyle={{ marginBottom: 15 }}
            />
            <Tabs
              tabs={notificationTabs}
              activeTab={selectedTab}
              onTabChange={setSelectedTab}
            />
          </View>

          <View style={styles.listWrapper}>
            <FlatList
              data={filteredNotifications}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <NotificationCard
                  item={item}
                  onPress={handlePress}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                  formatDate={formatNotificationDate}
                  swipeableRefs={swipeableRefs}
                  closeOtherSwipeables={closeOtherSwipeables}
                  cardWidth={sliderWidth}
                  cardHeight={sliderHeight}
                />
              )}
              ListEmptyComponent={() => {
                if (loading) return null;
                return (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={50} color="#ccc" />
                    <Text style={styles.emptyText}>
                      {searchQuery.length > 0 ? `No notifications found for "${searchQuery}"` : "No notifications found."}
                    </Text>
                  </View>
                );
              }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              bounces={true}
              overScrollMode="never"
              decelerationRate="normal"
              scrollEventThrottle={16}
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={10}
            />
          </View>
        </SafeAreaView>
        <LoadingScreen visible={loading} message={loadingMessage} />
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  gradientBackground: { flex: 1 },
  container: { flex: 1 },
  topSection: {
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: { paddingTop: 10, paddingBottom: 120 },
  emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.6, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', color: TEXT_MUTED, marginTop: 15, fontSize: 13 },
});

export default NotificationScreen;