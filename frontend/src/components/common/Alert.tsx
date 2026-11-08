import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
} from 'react-native';
import {
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  Construction,
  Copy,
  Info,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from 'lucide-react-native';

const { height: screenHeight } = Dimensions.get('window');
const BRAND_COLOR = '#0E3C2E';

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive' | object;
  textStyle?: object;
};

type AlertRequest = {
  title: string;
  message: string;
  buttons: AlertButton[];
};

const queuedSheets: AlertRequest[] = [];
let presentSheet: ((request: AlertRequest) => void) | null = null;

const normalizeButtons = (buttons: AlertButton[] | (() => void) = []) => {
  if (Array.isArray(buttons)) return buttons;
  return [{ text: 'OK', onPress: buttons }];
};

export const Alert = {
  sheet: (title: string, message = '', buttons: AlertButton[] | (() => void) = []) => {
    const request = { title, message, buttons: normalizeButtons(buttons) };
    if (presentSheet) presentSheet(request);
    else queuedSheets.push(request);
  },
  dialog: () => {
    // Placeholder for a future dialog-style alert.
  },
  banner: () => {
    // Placeholder for a future banner alert.
  },
  toast: () => {
    // Placeholder for a future toast alert.
  },
  snackbar: () => {
    // Placeholder for a future snackbar alert.
  },
};

function AlertSheetView({ title, message, buttons = [], onDismiss }) {
  const animValue = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // 1. Logic to derive the title with priority filtering
  const deriveTitle = (currentTitle, msg) => {
    const text = (msg || '').toLowerCase();
    const genericTitles = ['notice', 'alert', 'message', 'notification', 'system'];
    const currentTitleLower = (currentTitle || '').toLowerCase();

    // High Priority Message Filter
    // If these words are in the message, they define the title regardless of the input
    if (text.includes('copy') || text.includes('copied')) return 'Copied';
    if (text.includes('limit') || text.includes('restricted')) return 'Restricted';

    // If a specific/non-generic title was provided and no high-priority match found, use it
    if (currentTitle && currentTitle.trim().length > 0 && !genericTitles.includes(currentTitleLower)) {
        return currentTitle;
    }

    return 'Notice'; // Ultimate fallback
  };

  // Logic to format the message: trim trailing punctuation and adjust casing
  const formatMessage = (msg) => {
    if (!msg) return '';
    
    // Trim punctuation at the end (., !, ?)
    let formatted = msg.trim().replace(/[.!?,]+$/, "");

    // Process casing: Each word's first letter capital, rest small, 
    // UNLESS the word is already fully capital letters.
    return formatted.split(' ').map(word => {
      if (word.length === 0) return word;
      // Check if word is already all caps (and has at least one letter)
      if (word === word.toUpperCase() && /[A-Z]/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  };

  // 2. Logic to determine icon based on the final derived title
  const getIconInfo = (displayTitle) => {
    const lowerTitle = (displayTitle || '').toLowerCase();
    
    if (lowerTitle.includes('error') || lowerTitle.includes('failed')) {
      return { Icon: CircleAlert, tint: '#B42318' };
    }
    if (lowerTitle.includes('success') || lowerTitle.includes('complete')) {
      return { Icon: CircleCheck, tint: '#16804A' };
    }
    if (lowerTitle.includes('copy') || lowerTitle.includes('copied')) {
      return { Icon: Copy, tint: BRAND_COLOR };
    }
    if (lowerTitle.includes('restricted')) {
      return { Icon: ShieldAlert, tint: '#B42318' };
    } 
    if (lowerTitle.includes('update')) {
      return { Icon: RefreshCw, tint: BRAND_COLOR };
    }
    if (lowerTitle.includes('no internet')) {
      return { Icon: WifiOff, tint: '#B42318' };
    }
    if (lowerTitle.includes('fee')) {
      return { Icon: CircleDollarSign, tint: BRAND_COLOR };
    }
    if (lowerTitle.includes('building') || lowerTitle.includes('soon')) {
      return { Icon: Construction, tint: BRAND_COLOR };
    }
    return { Icon: Info, tint: BRAND_COLOR };
  };

  const finalTitle = deriveTitle(title, message);
  const formattedMessage = formatMessage(message);
  const iconInfo = getIconInfo(finalTitle);
  const AlertIcon = iconInfo.Icon;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animValue, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const closeSheet = (callback?) => {
    Animated.parallel([
      Animated.timing(animValue, { 
        toValue: screenHeight, 
        duration: 250, 
        useNativeDriver: true 
      }),
      Animated.timing(overlayOpacity, { 
        toValue: 0, 
        duration: 250, 
        useNativeDriver: true 
      }),
    ]).start(() => {
      callback?.();
      onDismiss?.();
    });
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={() => closeSheet()}
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
    >
      <View style={styles.container} pointerEvents="box-none">
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="box-none">
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => closeSheet()} 
          />
        </Animated.View>

        <Animated.View 
          style={[
            styles.sheetContainer, 
            { transform: [{ translateY: animValue }] }
          ]}
        >
          <View style={styles.dragIndicator} />
          
          <View style={styles.content}>
            <View style={styles.topSection}>
              <View style={styles.iconContainer}>
                <AlertIcon size={30} color={iconInfo.tint} />
              </View>

              <Text style={styles.title}>{finalTitle}</Text>
              <Text style={styles.message}>{formattedMessage}</Text>
            </View>

            <View style={styles.footer}>
              <View style={[
                styles.buttonsContainer, 
                buttons.length > 1 && styles.buttonsRowContainer
              ]}>
                {buttons.length > 0 ? (
                  buttons.map((btn, idx) => {
                    const isPrimary = buttons.length === 1 || idx === buttons.length - 1;
                    const isDestructive = btn.style === 'destructive';
                    const buttonStyle = typeof btn.style === 'object' ? btn.style : null;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => closeSheet(btn.onPress)}
                        style={[
                          styles.button,
                          buttons.length > 1 && styles.buttonRow,
                          isPrimary ? styles.primaryButton : styles.secondaryButton,
                          isDestructive && styles.destructiveButton,
                          buttonStyle,
                        ]}
                      >
                        <Text style={[
                          styles.buttonText,
                          isPrimary ? styles.primaryText : styles.secondaryText,
                          isDestructive && styles.destructiveText,
                          btn.textStyle,
                        ]}>
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <TouchableOpacity 
                    onPress={() => closeSheet()} 
                    style={[styles.button, styles.primaryButton]}
                  >
                    <Text style={[styles.buttonText, styles.primaryText]}>Dismiss</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function AlertHost() {
  const [activeSheet, setActiveSheet] = React.useState<AlertRequest | null>(null);

  useEffect(() => {
    const presenter = (request: AlertRequest) => {
      setActiveSheet((current) => {
        if (current) {
          queuedSheets.push(request);
          return current;
        }
        return request;
      });
    };

    presentSheet = presenter;
    if (queuedSheets.length > 0) presenter(queuedSheets.shift() as AlertRequest);
    return () => {
      if (presentSheet === presenter) presentSheet = null;
    };
  }, []);

  const handleDismiss = () => setActiveSheet(queuedSheets.shift() || null);

  return activeSheet ? <AlertSheetView {...activeSheet} onDismiss={handleDismiss} /> : null;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2147483647,
    elevation: 2147483647,
    pointerEvents: 'box-none',
  },
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 0,
    elevation: 0,
  }, 
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    minHeight: 100,
    zIndex: 1,
    elevation: 1,
  },
  dragIndicator: { 
    width: 40, 
    height: 5, 
    backgroundColor: '#E0E0E0', 
    borderRadius: 3, 
    alignSelf: 'center', 
    marginTop: 12 
  },
  content: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  topSection: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    backgroundColor: '#F7F7F7',
    borderRadius: 30,
    height: 60,
    width: 60,
    marginTop: 10,
    marginBottom: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0E3C2E',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  footer: {
    width: '100%',
  },
  buttonsContainer: {
    width: '100%', 
  },
  buttonsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 15,
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    width: '48%',
  },
  primaryButton: {
    backgroundColor: '#0E3C2E',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#F0F5F3',
  },
  destructiveButton: {
    backgroundColor: '#FDECEC',
  },
  destructiveText: {
    color: '#B42318',
  },
  secondaryText: {
    color: '#0E3C2E',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonText: {
    fontSize: 14,
  },
});