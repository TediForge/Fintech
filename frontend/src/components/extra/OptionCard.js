import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useVisualDelay } from '@hooks/useVisualDelay';

const defaultImage = 'https://cdn-icons-png.flaticon.com/128/1243/1243929.png';

export const OptionCardSkeleton = ({ isDark = false, containerStyle }) => {
  return (
    <View style={[styles.card, isDark && styles.cardDark, containerStyle]}>
      <View style={styles.cardInternalWrapper}>
        <View style={styles.leftInfoSection}>
          <View style={[styles.iconWrapper, isDark ? styles.iconWrapperDark : styles.iconWrapperLight]}>
            <View style={[styles.skeletonIcon, isDark && styles.skeletonIconDark]} />
          </View>
          <View style={styles.textMetadataContainer}>
            <View style={[styles.skeletonLineLong, isDark && styles.skeletonLineDark]} />
            <View style={[styles.skeletonLineShort, isDark && styles.skeletonLineDark]} />
          </View>
        </View>
        <View style={[styles.skeletonRadio, isDark && styles.skeletonRadioDark]} />
      </View>
    </View>
  );
};

const OptionCard = ({
  item,
  onPress,
  selected = false,
  showRadio = true,
  titleKey = 'name',
  subtitleKey = 'description',
  imageKey = 'imageUrl',
  imageStyle,
  containerStyle,
  textStyle,
  subTextStyle,
  disabled = false,
  renderRight,
  title,
  subtitle,
  imageUri,
  loading = false,
  delayMs = 350,
  isDark = false,
  iconWrapperStyle,
  titleStyle,
  subtitleStyle,
}) => {
  const showSkeleton = useVisualDelay(!loading, delayMs);

  const resolvedTitle = useMemo(() => {
    if (title != null) return title;
    if (item?.[titleKey] != null) return item[titleKey];
    return item?.country || item?.label || '';
  }, [item, title, titleKey]);

  const resolvedSubtitle = useMemo(() => {
    if (subtitle != null) return subtitle;
    if (item?.[subtitleKey] != null) return item[subtitleKey];
    if (item?.currency) return item.currency;
    return item?.description || '';
  }, [item, subtitle, subtitleKey]);

  const resolvedImageUri = useMemo(() => {
    if (imageUri != null) return imageUri;
    return item?.[imageKey] || item?.countryLogo || item?.logo || item?.logo_url || defaultImage;
  }, [imageUri, item, imageKey]);

  if (showSkeleton) {
    return <OptionCardSkeleton isDark={isDark} containerStyle={containerStyle} />;
  }

  return (
    <TouchableOpacity
      style={[styles.card, isDark && styles.cardDark, containerStyle]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.cardInternalWrapper}>
        <View style={styles.leftInfoSection}>
          <View style={[styles.iconWrapper, isDark ? styles.iconWrapperDark : styles.iconWrapperLight, iconWrapperStyle]}>
            <Image source={{ uri: resolvedImageUri }} style={[styles.flagIcon, imageStyle]} resizeMode="cover" />
          </View>
          <View style={styles.textMetadataContainer}>
            <Text style={[styles.permissionTitle, isDark && styles.permissionTitleDark, textStyle, titleStyle]} numberOfLines={1}>
              {resolvedTitle}
            </Text>
            <Text style={[styles.permissionDesc, isDark && styles.permissionDescDark, subTextStyle, subtitleStyle]} numberOfLines={1}>
              {resolvedSubtitle}
            </Text>
          </View>
        </View>

        {renderRight ? (
          renderRight({ selected, item })
        ) : showRadio ? (
          <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
            {selected ? <View style={styles.radioInner} /> : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export default OptionCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  cardDark: {
    backgroundColor: '#1E1E1E',
    borderColor: '#242424',
  },
  cardInternalWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  leftInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconWrapperLight: {
    backgroundColor: '#f0f0f0',
  },
  iconWrapperDark: {
    backgroundColor: '#242424',
  },
  flagIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  textMetadataContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0E3C2E',
    marginBottom: 2,
  },
  permissionTitleDark: {
    color: '#E4E4E4',
  },
  permissionDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  permissionDescDark: {
    color: '#B0B0B0',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#10B981',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  skeletonIcon: {
    width: 20,
    height: 20,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  skeletonIconDark: {
    backgroundColor: '#2E2E2E',
  },
  skeletonLineLong: {
    height: 12,
    width: '78%',
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginBottom: 6,
  },
  skeletonLineShort: {
    height: 10,
    width: '50%',
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  skeletonLineDark: {
    backgroundColor: '#2E2E2E',
  },
  skeletonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  skeletonRadioDark: {
    backgroundColor: '#2E2E2E',
  },
});
