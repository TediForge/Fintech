import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PICKER_HEIGHT = 250;
const ITEM_HEIGHT = 48;
const CENTER_SPACING = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

type DatePickerProps = {
  visible: boolean;
  onClose: () => void;
  selectedMonth: string;
  selectedYear: string;
  onConfirm: (month: string, year: string) => void;
  months: string[];
  years: string[];
};

type WheelPickerProps = {
  values: string[];
  selectedValue: string;
  onChange: (value: string) => void;
};

function WheelPicker({ values, selectedValue, onChange }: WheelPickerProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const isInteracting = useRef(false);
  const lastConfirmedValue = useRef(selectedValue);
  const [activeIndex, setActiveIndex] = useState(values.indexOf(selectedValue));

  useEffect(() => {
    if (selectedValue !== lastConfirmedValue.current && !isInteracting.current) {
      const index = values.indexOf(selectedValue);
      if (index !== -1) {
        lastConfirmedValue.current = selectedValue;
        setActiveIndex(index);
        scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
      }
    }
  }, [selectedValue, values]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(values.length - 1, index));
    if (clampedIndex !== activeIndex) setActiveIndex(clampedIndex);
  };

  const onSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isInteracting.current = false;
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(values.length - 1, index));
    const value = values[clampedIndex];

    if (value && value !== lastConfirmedValue.current) {
      lastConfirmedValue.current = value;
      onChange(value);
    }
  };

  return (
    <View style={styles.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        bounces
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => { isInteracting.current = true; }}
        onMomentumScrollBegin={() => { isInteracting.current = true; }}
        onMomentumScrollEnd={onSettle}
        onScrollEndDrag={onSettle}
        onLayout={() => {
          const index = values.indexOf(selectedValue);
          scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
        }}
        contentContainerStyle={styles.wheelContent}
      >
        {values.map((value, index) => (
          <View key={`${value}-${index}`} style={styles.wheelItem}>
            <Text style={[styles.wheelText, index === activeIndex ? styles.wheelTextSelected : styles.wheelTextMuted]}>
              {value}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function DatePicker({
  visible,
  onClose,
  selectedMonth,
  selectedYear,
  onConfirm,
  months,
  years,
}: DatePickerProps) {
  const [sheetHeight, setSheetHeight] = useState(0);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [tempMonth, setTempMonth] = useState(selectedMonth);
  const [tempYear, setTempYear] = useState(selectedYear);

  useEffect(() => {
    setTempMonth(selectedMonth);
    setTempYear(selectedYear);
  }, [selectedMonth, selectedYear]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: sheetHeight || SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 20,
            mass: 0.8,
            stiffness: 140,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) setSheetHeight(height);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
        </Animated.View>
        <Animated.View onLayout={onLayout} style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.dragArea} {...panResponder.panHandlers}>
            <View style={styles.drag} />
          </View>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Select Period</Text>
              <TouchableOpacity onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close date picker">
                <X size={24} color="#ccc" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerRow}>
              <View style={styles.selectionIndicator} pointerEvents="none" />
              <LinearGradient
                colors={['#fff', 'rgba(255,255,255,0)']}
                style={styles.topGradient}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['rgba(255,255,255,0)', '#fff']}
                style={styles.bottomGradient}
                pointerEvents="none"
              />
              <WheelPicker values={months} selectedValue={tempMonth} onChange={setTempMonth} />
              <WheelPicker values={years} selectedValue={tempYear} onChange={setTempYear} />
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(tempMonth, tempYear)}>
                <Text style={styles.confirmText}>Confirm Selection</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 8,
    width: '100%',
  },
  safeArea: { width: '100%' },
  dragArea: { width: '100%', height: 35, alignItems: 'center', justifyContent: 'center' },
  drag: { width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '800', color: '#0E3C2E' },
  pickerRow: { flexDirection: 'row', height: PICKER_HEIGHT, overflow: 'hidden', backgroundColor: '#fff', marginVertical: 10 },
  selectionIndicator: {
    position: 'absolute',
    top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
    height: ITEM_HEIGHT,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(47, 184, 109, 0.08)',
    borderRadius: 12,
    zIndex: 0,
  },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 1 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, zIndex: 1 },
  footer: { paddingBottom: Platform.OS === 'ios' ? 30 : 35, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 8 },
  confirmBtn: { backgroundColor: '#0E3C2E', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  wheelColumn: { flex: 1 },
  wheelContent: { paddingVertical: CENTER_SPACING },
  wheelItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  wheelText: { fontSize: 16, color: '#0E3C2E', fontWeight: '500' },
  wheelTextMuted: { color: '#99B2A9', fontSize: 14, opacity: 0.6 },
  wheelTextSelected: { color: '#2FB86D', fontWeight: '800', fontSize: 18 },
});
