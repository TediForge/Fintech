import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Animated, 
  StyleSheet, 
  Modal, 
  Platform, 
  Dimensions,
  PanResponder,
  SafeAreaView,
  StatusBar,
  ScrollView
} from 'react-native';
import SearchBar from '@components/common/SearchBar';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FilterSheet = ({ visible, onClose, categories, selectedCategory, onApply }) => {
  const [sheetHeight, setSheetHeight] = useState(0);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [localCategory, setLocalCategory] = useState(selectedCategory);
  const [searchQuery, setSearchQuery] = useState('');

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: sheetHeight || SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 2;
      },
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
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
    })
  ).current;

  useEffect(() => {
    setLocalCategory(selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { 
        toValue: 0,
        damping: 20,
        mass: 0.8,
        stiffness: 140,
        useNativeDriver: true, 
      }).start();
    } else {
      translateY.setValue(SCREEN_HEIGHT);
    }
  }, [visible, translateY]);

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

const filteredCategories = categories.filter((cat) =>
    cat.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const onSelectCategory = (cat) => {
    setLocalCategory(cat);
    onApply(cat);
    dismiss();
  };

  const onLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) setSheetHeight(height);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}> 
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
        </Animated.View>
        <Animated.View 
          onLayout={onLayout}
          style={[styles.container, { transform: [{ translateY }] }]}
        >
          <View style={styles.dragArea} {...panResponder.panHandlers}>
            <View style={styles.drag} />
          </View>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.contentWrapper}>
              <Text style={styles.title}>Filter Transactions</Text>
              <SearchBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                placeholder="Search categories"
              />

              <Text style={styles.subLabel}>Category</Text>
              <ScrollView
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryList}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {filteredCategories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => onSelectCategory(cat)}
                    style={[styles.item, localCategory === cat && styles.activeItem]}
                  >
                    <Text style={[styles.itemText, localCategory === cat && styles.activeText]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { 
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    paddingHorizontal: 20,
    paddingTop: 8,
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  safeArea: { width: '100%' },
  contentWrapper: { paddingBottom: Platform.OS === 'ios' ? 20 : 35 },
  dragArea: { width: '100%', height: 35, alignItems: 'center', justifyContent: 'center' },
  drag: { width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3 },
  title: { fontSize: 15, fontWeight: '800', textAlign: 'center', color: '#0E3C2E', marginBottom: 10 },
  subLabel: { fontSize: 12, fontWeight: '800', color: '#999', marginTop: 12, marginBottom: 8, textTransform: 'uppercase' },
  categoryScroll: { maxHeight: SCREEN_HEIGHT * 0.45 },
  categoryList: { paddingBottom: 4 },
  item: { width: '100%', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F5F8F7', alignItems: 'center', borderWidth: 1, borderColor: '#EEE', marginBottom: 8 },
  activeItem: { backgroundColor: '#0E3C2E', borderColor: '#0E3C2E' },
  itemText: { fontSize: 13, fontWeight: '700', color: '#555' },
  activeText: { color: '#FFF' }
});

export default FilterSheet;
