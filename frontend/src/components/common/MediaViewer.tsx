import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Video } from 'expo-av';
import { Asset } from 'expo-asset';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');
const MEDIA_TYPES = new Set(['image', 'video', 'pdf']);

const toSource = (item, sourceType) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    if (item.uri || item.source) return item.source || item;
  }

  if (sourceType === 'local') return item;
  return { uri: item };
};

const PdfPage = ({ item, sourceType, style }) => {
  const [uri, setUri] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const source = toSource(item, sourceType);
    const sourceUri = typeof source === 'object' ? source.uri : source;

    if (typeof sourceUri === 'string') {
      setUri(sourceUri);
      return () => {
        mounted = false;
      };
    }

    Asset.fromModule(sourceUri)
      .downloadAsync()
      .then((asset) => {
        if (mounted) setUri(asset.localUri || asset.uri);
      })
      .catch(() => {
        if (mounted) setError(true);
      });

    return () => {
      mounted = false;
    };
  }, [item, sourceType]);

  if (error) return <MediaError message="Unable to open this PDF." />;
  if (!uri) return <ActivityIndicator size="large" color="#FFFFFF" />;

  return <WebView source={{ uri }} style={[styles.pdf, style]} startInLoadingState />;
};

const MediaError = ({ message }) => (
  <View style={styles.errorState}>
    <Text style={styles.errorText}>{message}</Text>
  </View>
);

const MediaPage = ({ type, item, sourceType, active, imageStyle, videoProps, mediaStyle }) => {
  const source = toSource(item, sourceType);

  if (type === 'image') {
    return <Image source={source} style={[styles.image, imageStyle, mediaStyle]} resizeMode="contain" />;
  }

  if (type === 'video') {
    return (
      <Video
        source={source}
        style={[styles.video, mediaStyle]}
        useNativeControls
        resizeMode="contain"
        shouldPlay={active}
        isLooping={false}
        {...videoProps}
      />
    );
  }

  if (type === 'pdf') {
    return <PdfPage item={item} sourceType={sourceType} style={mediaStyle} />;
  }

  return <MediaError message={`Unsupported media type: ${type}`} />;
};

const MediaViewer = ({
  type = 'image',
  items = [],
  multiple = false,
  source = 'remote',
  visible = true,
  onClose,
  style,
  imageStyle,
  mediaStyle,
  videoProps,
  initialIndex = 0,
  onIndexChange,
  showPagination = true,
}) => {
  const [activeIndex, setActiveIndex] = useState(Math.max(0, initialIndex));
  const [isOpen, setIsOpen] = useState(visible);
  const normalizedType = String(type).toLowerCase();
  const mediaItems = useMemo(() => (Array.isArray(items) ? items : [items]).filter(Boolean), [items]);
  const visibleItems = multiple ? mediaItems : mediaItems.slice(0, 1);
  const pageWidth = screenWidth;

  useEffect(() => {
    setActiveIndex(Math.min(Math.max(0, initialIndex), Math.max(visibleItems.length - 1, 0)));
  }, [initialIndex, visibleItems.length]);

  useEffect(() => {
    setIsOpen(visible);
  }, [visible]);

  if (!isOpen || !MEDIA_TYPES.has(normalizedType) || visibleItems.length === 0) return null;

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleScroll = (event) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (nextIndex === activeIndex) return;
    setActiveIndex(nextIndex);
    onIndexChange?.(nextIndex);
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.toolbar}>
            <Text style={styles.counterText}>
              {multiple && visibleItems.length > 1 ? `${activeIndex + 1} / ${visibleItems.length}` : ''}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={[styles.container, style]}>
      {multiple ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          contentOffset={{ x: activeIndex * pageWidth, y: 0 }}
          style={styles.pager}
        >
          {visibleItems.map((item, index) => (
            <View key={`${index}-${String(item)}`} style={[styles.page, { width: pageWidth }]}>
              <MediaPage
                type={normalizedType}
                item={item}
                sourceType={source}
                active={index === activeIndex}
                imageStyle={imageStyle}
                videoProps={videoProps}
                mediaStyle={mediaStyle}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.page}>
          <MediaPage
            type={normalizedType}
            item={visibleItems[0]}
            sourceType={source}
            active
            imageStyle={imageStyle}
            videoProps={videoProps}
            mediaStyle={mediaStyle}
          />
        </View>
      )}

      {multiple && showPagination && visibleItems.length > 1 && (
        <View style={styles.pagination}>
          {visibleItems.map((item, index) => (
            <View key={`${index}-${String(item)}`} style={[styles.dot, index === activeIndex && styles.activeDot]} />
          ))}
        </View>
      )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.94)' },
  safeArea: { flex: 1 },
  toolbar: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  container: { flex: 1, width: '100%', overflow: 'hidden', backgroundColor: 'transparent', justifyContent: 'center' },
  pager: { width: '100%' },
  page: { width: '100%', minHeight: 220, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  image: { width: '100%', height: 260 },
  video: { width: '100%', height: 260 },
  pdf: { width: '100%', height: 520, backgroundColor: '#FFFFFF' },
  pagination: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  activeDot: { width: 18, backgroundColor: '#FFFFFF' },
  errorState: { width: '100%', minHeight: 180, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#FFFFFF', textAlign: 'center', fontSize: 13 },
});

export default MediaViewer;
