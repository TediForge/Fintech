import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '@components/common/SearchBar';
import OptionCard, { OptionCardSkeleton } from '@components/extra/OptionCard';
import FeatureCardGrid from '@components/extra/FeatureCardGrid';

const BRAND_COLOR = '#0E3C2E';

const BillProviderSelection = ({
  isDark = false,
  onClose,
  eyebrow,
  title,
  description,
  searchQuery,
  setSearchQuery,
  searchPlaceholder,
  items = [],
  isLoading = false,
  skeletonCount = 4,
  itemKey,
  itemTitle,
  itemSubtitle,
  itemImage,
  selectedItem,
  onSelect,
  emptyLabel = 'No results found for',
  headerIcon = 'close',
  refreshControl,
  cardRadius = 12,
}) => {
  const [viewMode, setViewMode] = React.useState('list');
  const gridItems = items.map((item) => ({
    id: itemKey(item),
    imageUri: itemImage(item),
    icon: item.icon,
    title: itemTitle(item),
    desc: itemSubtitle(item),
    source: item,
  }));

  return (
    <View style={styles.container}>
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
      backgroundColor="transparent"
      translucent
    />
    <LinearGradient
      colors={isDark ? ['#121212', '#121212'] : ['#e8f0ec', '#f5faf8']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, isDark && styles.darkCloseButton]}
          >
            <Ionicons name={headerIcon} size={18} color={isDark ? '#E4E4E4' : BRAND_COLOR} />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.introSection}>
          <View style={styles.heroSection}>
            <Text style={[styles.eyebrow, isDark && styles.darkSecondaryText]}>{eyebrow}</Text>
            <Text style={[styles.title, isDark && styles.darkPrimaryText]}>{title}</Text>
            <Text style={[styles.description, isDark && styles.darkSecondaryText]}>{description}</Text>
          </View>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            placeholder={searchPlaceholder}
            containerStyle={styles.searchBar}
          />
        </View>

        <View style={styles.viewModeRow}>
          <TouchableOpacity
            accessibilityLabel="List view"
            onPress={() => setViewMode('list')}
            style={[styles.viewModeButton, viewMode === 'list' && styles.activeViewModeButton]}
          >
            <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? BRAND_COLOR : '#64748B'} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Grid view"
            onPress={() => setViewMode('grid')}
            style={[styles.viewModeButton, viewMode === 'grid' && styles.activeViewModeButton]}
          >
            <Ionicons name="grid-outline" size={18} color={viewMode === 'grid' ? BRAND_COLOR : '#64748B'} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {isLoading ? (
            Array.from({ length: skeletonCount }).map((_, index) => (
              <OptionCardSkeleton key={`provider-skeleton-${index}`} isDark={isDark} />
            ))
          ) : viewMode === 'grid' ? (
            <FeatureCardGrid
              items={gridItems}
              onPress={(gridItem) => onSelect(gridItem.source)}
              isLoading={false}
              cardRadius={cardRadius}
            />
          ) : (
            items.map((item) => (
              <OptionCard
                key={itemKey(item)}
                item={item}
                onPress={() => onSelect(item)}
                selected={selectedItem ? itemKey(selectedItem) === itemKey(item) : false}
                title={itemTitle(item)}
                subtitle={itemSubtitle(item)}
                imageUri={itemImage(item)}
                isDark={isDark}
                delayMs={0}
              />
            ))
          )}

          {!isLoading && items.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{emptyLabel} "{searchQuery}"</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  </View>
  );
};

export default React.memo(BillProviderSelection);

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  safeArea: { flex: 1, paddingTop: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 50,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  darkCloseButton: { backgroundColor: '#1E1E1E', borderColor: '#2E2E2E' },
  headerSpacer: { width: 32 },
  introSection: { paddingTop: 15 },
  heroSection: { marginBottom: 15, paddingHorizontal: 16 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND_COLOR,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '800', color: BRAND_COLOR, lineHeight: 24, marginBottom: 6 },
  description: { fontSize: 11, color: '#64748B', lineHeight: 17 },
  darkPrimaryText: { color: '#E4E4E4' },
  darkSecondaryText: { color: '#B0B0B0' },
  searchBar: { paddingHorizontal: 16, marginBottom: 10 },
  viewModeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
    gap: 6,
  },
  viewModeButton: {
    width: 34,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeViewModeButton: {
    backgroundColor: '#E8F2EE',
    borderColor: '#C9DED4',
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 5 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
});
