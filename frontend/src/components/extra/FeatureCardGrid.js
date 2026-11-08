import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@providers/ThemeProvider';
import { useVisualDelay } from '@hooks/useVisualDelay';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 50) / 2;

const FeatureCardGrid = ({
  items = [],
  navigationEnabled = false,
  navigation,
  navigateTo,
  onPress,
  isLoading = false,
  delayMs = 350,
  itemKey = 'id',
  cardRadius = 12,
}) => {
  const { colors } = useTheme();
  const canNavigate = navigationEnabled && navigation && navigateTo;
  const showSkeleton = useVisualDelay(!isLoading, delayMs);

  if (showSkeleton) {
    return <FeatureCardGridSkeleton />;
  }

  const handlePress = (item, index) => {    if (item?.onPress) {
      item.onPress(item, index);
      return;
    }
    if (onPress) {
      onPress(item, index);
      return;
    }

    if (canNavigate) {
      navigation.navigate(navigateTo, { item });
    }
  };

  if (isLoading) {
    return <FeatureCardGridSkeleton />;
  }

  return (
    <View style={styles.grid}>
      {items.map((item, index) => {
        const key = item[itemKey] ?? `${index}`;
        const isInteractive = !!onPress || canNavigate;
        const Wrapper = isInteractive ? TouchableOpacity : View;

        return (
          <Wrapper
            key={key}
            style={[styles.card, { backgroundColor: colors.card, borderRadius: item.borderRadius ?? cardRadius }]}
            onPress={isInteractive ? () => handlePress(item, index) : undefined}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}> 
              {item.imageUri || item.image ? (
                <Image
                  source={{ uri: item.imageUri || item.image }}
                  style={styles.itemImage}
                  resizeMode="contain"
                />
              ) : item.icon ? (
                <Ionicons name={item.icon} size={16} color={colors.accent} />
              ) : null}
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.desc}
            </Text>
          </Wrapper>
        );
      })}
    </View>
  );
};

const FeatureCardGridSkeleton = React.memo(() => (
  <View style={styles.grid}>
    {Array.from({ length: 6 }).map((_, index) => (
      <View key={`skeleton-${index}`} style={[styles.card, styles.skeletonCard]}>
        <View style={styles.skeletonIconBox} />
        <View style={[styles.skeletonLine, { width: '65%' }]} />
        <View style={[styles.skeletonLine, { width: '100%', marginTop: 8 }]} />
      </View>
    ))}
  </View>
));

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemImage: { width: 24, height: 24, borderRadius: 12 },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 10,
    lineHeight: 14,
  },
  skeletonCard: {
    backgroundColor: '#F8FAFC',
  },
  skeletonIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
});

export default FeatureCardGrid;
