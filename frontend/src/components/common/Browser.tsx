import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Platform, 
  TouchableOpacity, 
  StatusBar,
  Dimensions,
  Animated,
  Modal,
  Image,
  Text,
  RefreshControl,
  Linking
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import { useNavigation } from '@react-navigation/native';

const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

export default function Browser({
  visible = false,
  onClose,
  url,
  title: initialTitle,
  callbackRoute,
  callbackParams = {},
  callbackUrlPrefix,
}) {
  const navigation = useNavigation();
  const webViewRef = useRef(null);

  // Dynamic title (max 17 characters)
  const [displayTitle, setDisplayTitle] = useState(initialTitle || 'External Link');

  // Custom Sheet Animation Refs
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const callbackHandledRef = useRef(false);

  const resolveExternalUrl = (targetUrl) => {
    if (!targetUrl || !targetUrl.startsWith('intent://')) return targetUrl;

    const intentStart = targetUrl.indexOf('#Intent;');
    const intentPath = targetUrl.slice('intent://'.length, intentStart >= 0 ? intentStart : undefined);
    const intentOptions = intentStart >= 0
      ? targetUrl.slice(intentStart + '#Intent;'.length).replace(/;end$/, '')
      : '';
    const fallbackMatch = intentOptions.match(/(?:^|;)S\.browser_fallback_url=([^;]*)/);

    if (fallbackMatch?.[1]) {
      return decodeURIComponent(fallbackMatch[1]);
    }

    const schemeMatch = intentOptions.match(/(?:^|;)scheme=([^;]+)/);
    if (!schemeMatch?.[1] || !intentPath) return null;

    return `${schemeMatch[1]}://${intentPath}`;
  }; 

  const openExternalUrl = async (targetUrl) => {
    const resolvedUrl = resolveExternalUrl(targetUrl);
    if (!resolvedUrl) return false;

    try {
      await Linking.openURL(resolvedUrl);
    } catch (error) {
      console.warn('Unable to open external URL:', resolvedUrl, error);
    }

    return false;
  };

  const handleRefresh = () => {
    if (!webViewRef.current) return;
    setIsRefreshing(true);
    webViewRef.current.reload();
    closeOptionsSheet();
  };

  const handleLoadEnd = () => {
    setIsRefreshing(false);
  };

  const handleShouldStartLoad = (request) => {
    const targetUrl = request?.url;
    if (!targetUrl) return false;

    const isWebUrl = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
    if (isWebUrl) return true;

    openExternalUrl(targetUrl);
    return false;
  };

  const handleOpenWindow = ({ nativeEvent }) => {
    openExternalUrl(nativeEvent?.targetUrl);
  };

  // JavaScript to extract real page title and send it back
  const injectedJS = `
    (function() {
      const sendTitle = () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'TITLE',
          title: document.title || ''
        }));
      };
      sendTitle();
      // Also send on any title change
      const observer = new MutationObserver(sendTitle);
      observer.observe(document.querySelector('title') || document.documentElement, {
        childList: true,
        subtree: true
      });
    })();
    true;
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'TITLE' && data.title) {
        let newTitle = data.title.trim();
        // Limit to exactly 20 characters max
        if (newTitle.length > 20) {
          newTitle = newTitle.substring(0, 20) + '..';
        }
        setDisplayTitle(newTitle);
      }
    } catch (e) {
      // Silent fail
    }
  };

  const handleGoBack = () => {
    if (webViewRef.current && canGoBack) webViewRef.current.goBack();
    closeOptionsSheet();
  };

  const handleGoForward = () => {
    if (webViewRef.current && canGoForward) webViewRef.current.goForward();
    closeOptionsSheet();
  };

  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);

    if (!callbackRoute || callbackHandledRef.current || !callbackUrlPrefix) return;
    if (navState.url.startsWith(callbackUrlPrefix)) {
      callbackHandledRef.current = true;
      onClose?.();
      navigation.replace(callbackRoute, {
        ...callbackParams,
        callbackUrl: navState.url,
      });
    }
  };

  const openOptionsSheet = () => {
    setIsSheetVisible(true);
    Animated.parallel([
      Animated.timing(animValue, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const closeOptionsSheet = () => {
    Animated.parallel([
      Animated.timing(animValue, { toValue: screenHeight, duration: 300, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setIsSheetVisible(false));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Background Gradient */}
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

      <ScreenHeader 
        title={displayTitle} 
        backgroundColor="#eff7f4" 
        textColor="#000" 
        iconColor="#000" 
        onBack={onClose}
        rightComponent={
          <TouchableOpacity 
            onPress={openOptionsSheet} 
            activeOpacity={0.6}
            style={styles.rightAction}
          >
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/128/10172/10172167.png' }} 
              style={styles.menuIcon}
            />
          </TouchableOpacity>
        }
      />

      <View style={styles.browserContainer}>
        <WebView 
          ref={webViewRef}
          source={{ uri: url }} 
          originWhitelist={['*']}
          startInLoadingState={true}
          pullToRefreshEnabled={Platform.OS === 'android'}
          injectedJavaScript={injectedJS}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onOpenWindow={handleOpenWindow}
          setSupportMultipleWindows={false}
          onLoadEnd={handleLoadEnd}
          javaScriptCanOpenWindowsAutomatically={true}
          thirdPartyCookiesEnabled={true}
          mixedContentMode="compatibility"
          allowsFullscreenVideo={true}
          mediaPlaybackRequiresUserAction={false}
          allowsBackForwardNavigationGestures={true}
          cacheEnabled={true}
          sharedCookiesEnabled={true}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={BRAND_COLOR}
              colors={[BRAND_COLOR]}
            />
          )}
          renderLoading={() => (
            <View style={styles.loaderWrapper}>
              <ActivityIndicator color={BRAND_COLOR} size="large" />
            </View>
          )}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={styles.webview}
        />
      </View>
 
      {/* --- Options Sheet --- */}
      <Modal
        visible={isSheetVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeOptionsSheet}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              activeOpacity={1} 
              onPress={closeOptionsSheet} 
            />
          </Animated.View>

          <Animated.View 
            style={[
              styles.sheetContainer, 
              { transform: [{ translateY: animValue }] }
            ]}
          >
            <View style={styles.dragIndicator} />
            
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetMainTitle}>Browser Options</Text>
              </View>

              <View style={styles.sheetContent}>
                <TouchableOpacity 
                  style={styles.optionCard} 
                  onPress={handleRefresh}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconCircleWrapper}>
                    <Image 
                      source={{ uri: 'https://cdn-icons-png.flaticon.com/128/3917/3917765.png' }} 
                      style={styles.sheetOptionIcon}
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.optionTitleText}>Reload Page</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.optionCard, !canGoBack && { opacity: 0.5 }]} 
                  onPress={handleGoBack}
                  disabled={!canGoBack}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconCircleWrapper}>
                    <Ionicons name="arrow-back-outline" size={22} color={BRAND_COLOR} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.optionTitleText}>Go Back</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.optionCard, !canGoForward && { opacity: 0.5 }]} 
                  onPress={handleGoForward}
                  disabled={!canGoForward}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconCircleWrapper}>
                    <Ionicons name="arrow-forward-outline" size={22} color={BRAND_COLOR} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.optionTitleText}>Go Forward</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  browserContainer: { 
    flex: 1, 
    marginTop: 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  webview: {
    flex: 1,
  },
  loaderWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  rightAction: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    width: 20,
    height: 20,
    tintColor: BRAND_COLOR,
    resizeMode: 'contain',
  },
  // --- Modal / Sheet Styles ---
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    paddingBottom: 40,
    maxHeight: 400,
  },
  dragIndicator: { 
    width: 40 * scale,  
    height: 5 * scale, 
    backgroundColor: '#E0E0E0', 
    borderRadius: 3, 
    alignSelf: 'center', 
    marginTop: 15 * scale 
  },
  safeArea: { width: '100%' },
  sheetHeader: { alignItems: 'center', paddingTop: 10 * scale, paddingBottom: 15 * scale },
  sheetMainTitle: { fontSize: 18 * scale, fontWeight: '700', color: '#1A1A1A' },
  sheetContent: { paddingHorizontal: 20 * scale, paddingTop: 10 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16 * scale,
    borderRadius: 20 * scale,
    marginBottom: 12 * scale,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    elevation: 0.1,
  },
  iconCircleWrapper: {
    width: 45 * scale,
    height: 45 * scale,
    borderRadius: 23 * scale,
    backgroundColor: '#F0F7F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetOptionIcon: {
    width: 22 * scale,
    height: 22 * scale,
    resizeMode: 'contain',
    tintColor: BRAND_COLOR,
  },
  textContainer: { flex: 1, marginLeft: 15 * scale },
  optionTitleText: { fontSize: 15 * scale, fontWeight: '700', color: '#1A1C1E' },
});