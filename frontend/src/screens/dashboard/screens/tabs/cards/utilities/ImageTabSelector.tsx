import React from 'react';
import { View, TouchableOpacity, Image, Text, StyleSheet } from 'react-native';

const CARD_ASPECT_RATIO = 1.586;

const ImageTabSelector = ({
  tabs = [],
  selectedValue = null,
  onSelect = () => {},
  itemSize = 60,
  gap = 10,
}) => {
  const itemHeight = Math.round(itemSize / CARD_ASPECT_RATIO);
  const borderRadius = Math.round(itemSize * 0.18);

  if (!Array.isArray(tabs) || tabs.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {tabs.map((tab, index) => {
        const imageUrl = tab.imageUrl || tab.image || tab.src;
        const value = tab.value ?? tab.id ?? index;
        const isSelected = value === selectedValue;
        const sizeMultiplier = isSelected ? 1.18 : 1;
        const tabWidth = Math.round(itemSize * sizeMultiplier);
        const tabHeight = Math.round(itemHeight * sizeMultiplier);
        const tabRadius = Math.round(tabWidth * 0.10);

        return (
          <TouchableOpacity
            key={value}
            style={[
              styles.tab,
              {
                width: tabWidth,
                height: tabHeight,
                marginRight: index === tabs.length - 1 ? 0 : gap,
                borderRadius: tabRadius,
              },
              isSelected && styles.selectedTab,
            ]}
            activeOpacity={0.8}
            onPress={() => onSelect(value, tab)}
          >
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.emptyPlaceholder} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8faf8',
    borderWidth: 0,
  },
  selectedTab: {
    backgroundColor: '#eef7f2',
    borderWidth: 1,
    borderColor: 'rgba(14, 60, 46, 0.25)',
    shadowColor: '#0E3C2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emptyPlaceholder: {
    width: '60%',
    height: '60%',
    backgroundColor: '#d9d9d9',
    borderRadius: 8,
  },
});

export default ImageTabSelector;
