import React, { useRef, useEffect, useState } from 'react';
import { 
  View, 
  Image, 
  Dimensions, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  FlatList 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';
import Browser from '@components/common/Browser';

const api = apiConfig.baseUrl;

const { width } = Dimensions.get('window');
const sliderWidth = width - 32;
const sliderHeight = sliderWidth * (500 / 1500);

const DISCOVERY_URL = `${api}/v1/campaigns/discovery/list.php`;
const TRACKING_URL = `${api}/v1/campaigns/tracking/analytics.php`;
const campaignCacheKey = 'cachedCampaignSlides';

// Optimized static content placeholder component wrapped in React.memo to completely bypass unnecessary layout passes
const StaticAdvertPlaceholder = React.memo(() => (
  <View style={styles.staticContainer} />
));

export default function AdvertSlider({ renderTab }) {
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const [imageSlides, setImageSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trackedViews, setTrackedViews] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [browserDetails, setBrowserDetails] = useState(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const loadCachedCampaigns = async () => {
    try {
      const cached = await AsyncStorage.getItem(campaignCacheKey);
      if (!cached) return;

      const cachedCampaigns = JSON.parse(cached);
      if (!Array.isArray(cachedCampaigns) || cachedCampaigns.length === 0) return;

      setImageSlides(cachedCampaigns);
      setIsLoading(false);
      trackActivity(cachedCampaigns[0].id, 'impression');
    } catch (error) {
      console.error('Error loading cached campaigns:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const token = await getSessionToken();
      const query = new URLSearchParams({ platform: 'app' });
      if (token) query.set(config.sessionToken, token);

      const response = await fetch(`${DISCOVERY_URL}?${query.toString()}`);
      const res = await response.json();
      if (res.success === true && Array.isArray(res.data)) {
        setImageSlides(res.data);
        await AsyncStorage.setItem(campaignCacheKey, JSON.stringify(res.data));
        if (res.data[0]) {
          trackActivity(res.data[0].id, 'impression');
        }
      }
    } catch (error) {
      console.log('Network error fetching campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initializeCampaigns = async () => {
      await loadCachedCampaigns();
      await fetchCampaigns();
    };

    initializeCampaigns();
  }, []);

  const trackActivity = async (campaignId, event) => {
    if (event === 'view' && trackedViews.has(campaignId)) return;

    try {
      const token = await getSessionToken();
      if (!token) return;

      const response = await fetch(TRACKING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.sessionToken]: token,
          campaignId,
          event
        }),
      });

      if (response.ok && event === 'view') {
        setTrackedViews(prev => new Set(prev).add(campaignId));
      }

      return response.ok;
    } catch (error) {
      console.error(`Error tracking ${event}:`, error);
      return false;
    }
  };

  useEffect(() => {
    if (imageSlides.length === 0 || isLoading) return;

    const timer = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= imageSlides.length) {
        nextIndex = 0;
      }

      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });

      setCurrentIndex(nextIndex);
      trackActivity(imageSlides[nextIndex].id, 'view');
    }, 5000);

    return () => clearInterval(timer);
  }, [currentIndex, imageSlides, isLoading]);

  const handlePress = async (item) => {
    await trackActivity(item.id, 'click');

    if (item.actionType === 'navigate') {
      navigation.navigate(item.destination);
    } else if (item.actionType === 'url' && /^https?:\/\//i.test(item.destination || '')) {
      setBrowserDetails({ url: item.destination, title: item.title });
    }
  };

  const onMomentumScrollEnd = (event) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / sliderWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      if (imageSlides[newIndex]) {
        trackActivity(imageSlides[newIndex].id, 'view');
      }
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => handlePress(item)}
      style={{ width: sliderWidth, height: sliderHeight }}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.image} />
    </TouchableOpacity>
  );

  // Split-gate layout tree isolation
  if (isLoading) {
    return <StaticAdvertPlaceholder />;
  }

  if (imageSlides.length === 0) return null;

  return (
    <View style={styles.outerContainer}>
      <FlatList
        ref={flatListRef}
        data={imageSlides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={sliderWidth}
        snapToAlignment="center"
      />

      <View style={styles.paginationInside}>
        {imageSlides.map((_, index) => {
          const isActive = index === currentIndex;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                isActive ? styles.activeDot : null
              ]}
            />
          );
        })}
      </View>
      {browserDetails && (
        <Browser
          visible
          url={browserDetails.url}
          title={browserDetails.title}
          onClose={() => setBrowserDetails(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 13,
    alignSelf: 'center',
    width: sliderWidth,
    height: sliderHeight,
    backgroundColor: '#fff',
  },
  staticContainer: {
    marginVertical: 10,
    borderRadius: 12,
    marginHorizontal: 13,
    alignSelf: 'center',
    width: sliderWidth,
    height: sliderHeight,
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: sliderWidth,
    height: sliderHeight,
    resizeMode: 'cover',
  },
  paginationInside: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  dot: {
    backgroundColor: 'rgba(204, 204, 204, 0.5)',
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: '#022c22',
    width: 12,
    height: 4,
    borderRadius: 3,
  },
});