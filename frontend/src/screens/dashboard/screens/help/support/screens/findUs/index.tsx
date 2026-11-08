import { Alert } from '@components/common/Alert';
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  LayoutAnimation,
  UIManager,
  StatusBar,
  Dimensions,
  Linking,
} from 'react-native'; 
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import SearchBar from '@components/common/SearchBar';
import Tabs from '@components/extra/Tabs';
import config from '@config/app';
import { apiConfig } from '@config/api';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const scale = width / 410;
const BRAND_DARK = "#0E3C2E";
const TEXT_MUTED = "#64748B";
const BORDER_COLOR = "#E2E8F0";
const FIND_US_ENDPOINT = `${apiConfig.baseUrl}/v1/help/support/findUs`;

// Haversine formula to calculate distance in KM
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const FindUsScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('OFFICES');
  const [userLocation, setUserLocation] = useState(null);
  const [offices, setOffices] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let watcher = null;
    let isMounted = true;

    const loadLocations = async () => {
      try {
        const response = await fetch(FIND_US_ENDPOINT, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        const payload = await response.json();

        if (!isMounted) {
          return;
        }

        if (payload?.status === 'success') {
          setOffices(Array.isArray(payload.office) ? payload.office : []);
          setAgents(Array.isArray(payload.agents) ? payload.agents : []);
        } else {
          setOffices([]);
          setAgents([]);
        }
      } catch (error) {
        if (isMounted) {
          setOffices([]);
          setAgents([]);
          Alert.sheet('Error', 'Unable to load locations right now.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    (async () => {
      await loadLocations();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
        },
        (location) => {
          setUserLocation(location.coords);
        }
      );
    })();

    return () => {
      isMounted = false;
      if (watcher) watcher.remove();
    };
  }, []);

  const handleOpenMap = (item) => {
    const mapLink = item?.map?.link;
    if (!mapLink) return;

    Linking.openURL(mapLink).catch(() => {
      alert("Could not open maps. Please check your internet connection.");
    });
  };

  const handleCopyAddress = async (address) => {
    if (!address) {
      Alert.sheet("Error", "Address not available to copy.");
      return;
    }
    await Clipboard.setStringAsync(address);
    Alert.sheet("Copied!", "Address copied to clipboard.");
  };

  const handleSearch = (text) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchQuery(text);
  };

  const filteredOffices = useMemo(() => {
    const data = offices.map((item) => ({
      ...item,
      computedDistance: userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, item?.map?.lat, item?.map?.lng) : null,
    }));

    return data
      .filter((item) => {
        const branch = String(item?.branch || '').toLowerCase();
        const address = String(item?.address || '').toLowerCase();
        const query = String(searchQuery || '').toLowerCase();
        return branch.includes(query) || address.includes(query);
      })
      .sort((a, b) => (a.computedDistance || 9999) - (b.computedDistance || 9999));
  }, [offices, searchQuery, userLocation]);

  const filteredAgents = useMemo(() => {
    const data = agents.map((item) => ({
      ...item,
      computedDistance: userLocation ? calculateDistance(userLocation.latitude, userLocation.longitude, item?.map?.lat, item?.map?.lng) : null,
    }));

    return data
      .filter((item) => {
        const branch = String(item?.branch || '').toLowerCase();
        const address = String(item?.address || '').toLowerCase();
        const query = String(searchQuery || '').toLowerCase();
        return branch.includes(query) || address.includes(query);
      })
      .sort((a, b) => (a.computedDistance || 9999) - (b.computedDistance || 9999));
  }, [agents, searchQuery, userLocation]);

  const renderOfficeCard = ({ item }) => (
    <View style={styles.officeCard}>
      <View style={styles.cardLeftContent}>
        <View style={styles.headerText}>
          <Text style={styles.branchName} numberOfLines={1}>{item.branch}</Text>
          <TouchableOpacity
            style={styles.addressRow}
            onPress={() => handleCopyAddress(item.address)}
            activeOpacity={0.7}
          >
            <Text style={styles.addressTextValue} numberOfLines={2}>{item.address}</Text>
            <Ionicons name="copy-outline" size={14} color={TEXT_MUTED} style={styles.copyIcon} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={TEXT_MUTED} />
            <Text style={[styles.hoursText, { marginLeft: 10, marginTop: 0 }]}>{item.hours}</Text>
          </View>
        </View>

        {activeTab === 'AGENTS' && (
          <View style={styles.agentBadge}><Text style={styles.agentBadgeText}>Verified</Text></View>
        )}
      </View>

      <View style={styles.cardRightContent}>
        <Image source={{ uri: item.image }} style={styles.locationImage} resizeMode="cover" />
        <TouchableOpacity 
          style={styles.distanceBadge} 
          onPress={() => handleOpenMap(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={12} color="#FFF" />
          <Text style={styles.distanceText}>
            {item.computedDistance ? `${item.computedDistance.toFixed(1)}km` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      
      <ScreenHeader 
        title="Find Us"
        backgroundColor="#eff7f4"
        textColor="#000"
        iconColor="#000"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.mainWrapper}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={handleSearch}
          placeholder={activeTab === 'OFFICES' ? "Search offices" : "Search agents"}
          containerStyle={{ marginBottom: 15 }}
        />

        <Tabs 
          tabs={[
            { label: "Our Offices", value: "OFFICES" },
            { label: "Agents", value: "AGENTS" }
          ]} 
          activeTab={activeTab} 
          onTabChange={(val) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setActiveTab(val);
          }} 
          loading={loading}
        />

        <FlatList
          key={activeTab}
          data={activeTab === 'OFFICES' ? filteredOffices : filteredAgents}
          keyExtractor={(item) => item.id}
          renderItem={renderOfficeCard}
          showsVerticalScrollIndicator={false}
          bounces={true}
          overScrollMode="always"
          decelerationRate="normal"
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={BORDER_COLOR} />
              <Text style={styles.emptyText}>
                {loading
                  ? 'Loading locations…'
                  : `No ${activeTab === 'OFFICES' ? 'offices' : 'agents'} found matching "${searchQuery}"`}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  mainWrapper: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  listContent: {
    marginTop: 10,
    paddingBottom: 40,
  },
  officeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 20 * scale,
    padding: 14 * scale,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'flex-start',
  },
  cardLeftContent: { flex: 1, paddingRight: 10 * scale },
  cardRightContent: { alignItems: 'center' },

  headerText: { flex: 1, marginBottom: 4 },
  branchName: { fontSize: 14 * scale, fontWeight: '700', color: BRAND_DARK },
  hoursText: { fontSize: 10 * scale, color: '#10B981', fontWeight: '600', marginTop: 1 },
  
  detailsSection: { marginTop: 12 * scale },
  agentBadge: {
    backgroundColor: '#10B98115',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  agentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailText: { 
    fontSize: 11.5 * scale, 
    color: '#475569', 
    marginLeft: 10, 
    flex: 1,
    lineHeight: 16 * scale 
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4, // Spacing from branchName
    flexShrink: 1, // Allow the row to shrink if needed
  },
  addressTextValue: {
    fontSize: 11.5 * scale,
    color: '#475569',
    flex: 1, // Allow text to take up most space
    lineHeight: 16 * scale,
    marginRight: 4, // Small margin before the icon
  },
  copyIcon: {}, // No specific margin needed if addressTextValue has marginRight
  
  locationImage: {
    width: 70,
    height: 70,
    borderRadius: 15 * scale,
    backgroundColor: '#F1F5F9',
  },

  distanceBadge: {
    backgroundColor: BRAND_DARK, 
    paddingHorizontal: 10 * scale,
    paddingVertical: 6 * scale,
    borderRadius: 20 * scale,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10 * scale,
  },
  distanceText: {
    color: '#FFF',
    fontSize: 10 * scale,
    fontWeight: '800',
    marginLeft: 4,
  },
  
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: 13 * scale,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default FindUsScreen;