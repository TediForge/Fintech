import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CustomSwitch from '@components/common/Switch';
import { useTheme } from '@providers/ThemeProvider';

export const SectionShell = ({ title, isDark, children }) => (
  <View>
    <Text style={[styles.sectionHeader, isDark && styles.darkSectionHeader]}>{title}</Text>
    <View style={[styles.sectionContainer, isDark ? styles.sectionContainerDark : styles.sectionContainerLight]}>
      {children}
    </View>
  </View>
);

export const FeatureRow = ({
  title,
  description,
  iconTop,
  iconBottom,
  isDark,
  isSwitch = false,
  switchValue,
  onSwitchChange,
  onPress,
  isLast,
  showChevron = true,
  disabled = false,
  loading = false,
  disabledLabel = 'Unavailable',
}) => {
  const { colors } = useTheme();
  const isDisabled = Boolean(disabled);

  return (
    <View>
      {isSwitch && !isDisabled ? (
        <View style={styles.itemContainer}>
          <FeatureIcon iconBottom={iconBottom} iconTop={iconTop} isDark={isDark} />
          <FeatureCopy title={title} description={description} isDark={isDark} compact={!isSwitch} />
          <CustomSwitch value={switchValue ?? false} onValueChange={onSwitchChange} width={40} height={28} />
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={isDisabled ? undefined : onPress}
          disabled={isDisabled}
        >
          <View style={[styles.itemContainer, isDisabled && styles.itemContainerDisabled]}>
            <FeatureIcon iconBottom={iconBottom} iconTop={iconTop} isDark={isDark} />
            <FeatureCopy title={title} description={description} isDark={isDark} compact={!isSwitch} />
            {isSwitch ? (
              <View style={styles.trailingSection}>
                <CustomSwitch value={switchValue ?? false} onValueChange={onSwitchChange} width={40} height={28} disabled />
              </View>
            ) : (
              showChevron && <Ionicons name="chevron-forward" size={15} color="#999" style={styles.chevron} />
            )}
          </View>
        </TouchableOpacity>
      )}
      {!isLast && <View style={[styles.separator, isDark && styles.separatorDark]} />}
    </View>
  );
};

const FeatureIcon = ({ iconTop: Icon, iconBottom, isDark }) => (
  <ImageBackground
    source={iconBottom}
    style={[styles.leftIcons, isDark && styles.darkIconBackground]}
    imageStyle={styles.leftIcons}
  >
    <Icon size={15} color={isDark ? '#E4E4E4' : '#262626'} />
  </ImageBackground>
);

const FeatureCopy = ({ title, description, isDark, compact }) => (
  <View style={[styles.textContainer, compact && styles.textContainerCompact]}>
    <Text style={[styles.title, isDark && styles.darkTitle]}>{title}</Text>
    {description ? <Text style={[styles.description, isDark && styles.darkDescription]}>{description}</Text> : null}
  </View>
);

export const FeatureSkeleton = React.memo(({ isDark, colors, sectionCount = 3, rowCount = 3 }) => (
  <View>
    {Array.from({ length: sectionCount }).map((_, sectionIndex) => (
      <View key={`feature-skeleton-section-${sectionIndex}`} style={styles.skeletonSectionWrapper}>
        <View style={[styles.sectionHeaderPlaceholder, isDark ? styles.staticLineDark : { backgroundColor: colors?.border || '#E5E7EB' }]} />
        <View style={[styles.skeletonContainer, isDark ? styles.skeletonContainerDark : styles.sectionContainerLight]}>
          {Array.from({ length: rowCount }).map((__, rowIndex) => (
            <View key={`feature-skeleton-row-${sectionIndex}-${rowIndex}`} style={styles.itemContainer}>
              <View style={[styles.placeholderIcon, isDark ? styles.placeholderIconDark : { backgroundColor: colors?.border || '#E5E7EB' }]} />
              <View style={styles.textContainer}>
                <View style={[styles.placeholderLine, isDark ? styles.staticLineDark : { backgroundColor: colors?.border || '#E5E7EB' }, { width: '50%', height: 10 }]} />
                <View style={[styles.placeholderLine, isDark ? styles.staticLineDark : { backgroundColor: colors?.border || '#E5E7EB' }, { width: '72%', height: 8, marginTop: 6 }]} />
              </View>
              <View style={[styles.placeholderChevron, isDark ? styles.placeholderChevronDark : { backgroundColor: colors?.border || '#E5E7EB' }]} />
            </View>
          ))}
        </View>
      </View>
    ))}
  </View>
));

export default SectionShell;

const styles = StyleSheet.create({
  sectionHeader: { fontSize: 12, fontWeight: '600', color: '#8c8c8c', marginTop: 14, marginBottom: 8, marginLeft: 8 },
  darkSectionHeader: { color: '#B0B0B0' },
  sectionContainer: { borderRadius: 15, overflow: 'hidden' },
  sectionContainerLight: { backgroundColor: '#fff', borderWidth: 0.1, borderColor: '#f5f5f5' },
  sectionContainerDark: { backgroundColor: '#1E1E1E', borderWidth: 0, borderColor: 'transparent' },
  itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  itemContainerDisabled: { opacity: 0.7 },
  leftIcons: { marginRight: 14, justifyContent: 'center', alignItems: 'center', height: 32, width: 32, resizeMode: 'contain', tintColor: '#f0f0f0' },
  darkIconBackground: { tintColor: '#242424' },
  textContainer: { flex: 1 },
  textContainerCompact: { marginRight: 4 },
  trailingSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevron: { marginLeft: 4, marginRight: 2 },
  disabledLabel: { fontSize: 9 },
  title: { fontSize: 12, fontWeight: '500', color: '#6E6E6E' },
  darkTitle: { color: '#E4E4E4' },
  description: { marginTop: 1.5, fontSize: 10, color: '#A1A1A1' },
  darkDescription: { color: '#B0B0B0' },
  separator: { height: 1.5, backgroundColor: '#f5f5f5' },
  separatorDark: { backgroundColor: '#242424' },
  skeletonSectionWrapper: { marginBottom: 6 },
  skeletonContainer: { paddingHorizontal: 12, borderRadius: 12, marginVertical: 6, paddingVertical: 4 },
  skeletonContainerDark: { backgroundColor: '#1E1E1E' },
  sectionHeaderPlaceholder: { width: 90, height: 10, borderRadius: 999, marginTop: 14, marginBottom: 8, marginLeft: 8 },
  placeholderIcon: { width: 32, height: 32, borderRadius: 10, marginRight: 14 },
  placeholderIconDark: { backgroundColor: '#2A2A2A' },
  placeholderLine: { borderRadius: 999 },
  staticLineDark: { backgroundColor: '#2A2A2A' },
  placeholderChevron: { width: 16, height: 10, borderRadius: 999 },
  placeholderChevronDark: { backgroundColor: '#2A2A2A' },
});
