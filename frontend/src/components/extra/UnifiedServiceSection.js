import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@providers/ThemeProvider';

const StaticRow = ({ colors, isDark, showAction, isLast }) => (
  <View style={[styles.row, { marginBottom: isLast ? 0 : 10, backgroundColor: isDark ? colors.card : colors.accentSoft }]}>
    <View style={[styles.placeholderIcon, { backgroundColor: colors.muted }]} />
    <View style={styles.placeholderCopy}>
      <View style={[styles.placeholderLine, { width: 120, backgroundColor: colors.muted }]} />
      <View style={[styles.placeholderLine, { width: 140, marginTop: 6, backgroundColor: colors.muted }]} />
    </View>
    {showAction && <View style={[styles.placeholderAction, { backgroundColor: colors.muted }]} />}
  </View>
);

const formatTime = (value) => String(value || '00').padStart(2, '0');

const UnifiedServiceSection = ({
  title,
  items = [],
  onItemPress,
  onHeaderAction,
  headerActionLabel = 'View all',
  renderItem,
  rowMode = 'button',
  showSteps = false,
  showTimer = false,
  timeLeft,
  isLoading = false,
  marginTop = 0,
  marginVertical = 10,
  showEmptyState = false,
  emptyStateTitle = 'No records available',
  emptyStateSubtitle = 'There is nothing to show yet.',
  renderEmpty,
}) => {
  const { colors, isDark } = useTheme();
  const [localTimeLeft, setLocalTimeLeft] = useState({ h: '00', m: '00', s: '00' });

  useEffect(() => {
    if (!showTimer || timeLeft) return undefined;

    const updateTime = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      setLocalTimeLeft({
        h: Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0'),
        m: Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0'),
        s: Math.floor((diff / 1000) % 60).toString().padStart(2, '0'),
      });
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [showTimer, timeLeft]);

  const timer = timeLeft || localTimeLeft;
  const showAction = rowMode === 'button';
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <View style={[styles.sectionCard, { backgroundColor: isDark ? colors.surface : colors.card, marginVertical }, marginTop ? { marginTop } : null]}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
        {onHeaderAction && (
          <TouchableOpacity onPress={onHeaderAction} activeOpacity={0.7}>
            <Text style={[styles.headerAction, { color: colors.accent }]}>{headerActionLabel}</Text>
          </TouchableOpacity>
        )}
        {showTimer && (
          <View style={styles.timerContainer}>
            <Text style={[styles.timerPrefix, { color: colors.textSecondary }]}>Ends in</Text>
            <View style={[styles.timeWrapper, { backgroundColor: isDark ? colors.background : colors.accentSoft }]}>
              <Text style={[styles.timeDigit, { color: isDark ? colors.textPrimary : colors.accent }]}>{formatTime(timer.h)}</Text>
            </View>
            <Text style={[styles.timeSeparator, { color: colors.textPrimary }]}>:</Text>
            <View style={[styles.timeWrapper, { backgroundColor: isDark ? colors.background : colors.accentSoft }]}>
              <Text style={[styles.timeDigit, { color: isDark ? colors.textPrimary : colors.accent }]}>{formatTime(timer.m)}</Text>
            </View>
            <Text style={[styles.timeSeparator, { color: colors.textPrimary }]}>:</Text>
            <View style={[styles.timeWrapper, { backgroundColor: isDark ? colors.background : colors.accentSoft }]}>
              <Text style={[styles.timeDigit, { color: isDark ? colors.textPrimary : colors.accent }]}>{formatTime(timer.s)}</Text>
            </View>
          </View>
        )}
      </View>

      {isLoading ? (
        <>
          {[0, 1, 2].map((index) => (
            <StaticRow
              key={`static-row-${index}`}
              colors={colors}
              isDark={isDark}
              showAction={showAction}
              isLast={index === 2}
            />
          ))}
        </>
      ) : hasItems ? (
        renderItem ? items.map((item, index) => renderItem(item, index)) : items.map((item, index) => {
          const isClaimed = item.status === 'claimed';
          const isLoadingAction = item.isActionLoading;
          const actionLabel = item.actionLabel || (item.status === 'claim' ? 'Claim' : item.status === 'claimed' ? 'Claimed' : 'Go');
          const actionColor = item.status === 'claimed' ? colors.muted : item.status === 'claim' ? colors.warning : colors.accent;

          if (showAction) {
            return (
              <View key={item.id || item.key || `${item.title}-${index}`} style={[styles.row, { marginBottom: index === items.length - 1 ? 0 : 10, backgroundColor: isDark ? colors.card : colors.accentSoft }]}>
                <View style={[styles.imageWrapper, { backgroundColor: colors.accentSoft }]}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={[styles.taskImage, { tintColor: colors.accent }]} resizeMode="contain" />
                  ) : (
                    <Ionicons name={item.icon || 'ellipse-outline'} size={20} color={colors.accent} />
                  )}
                  {showSteps && item.steps && (
                    <View style={[styles.floatingBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.stepText, { color: colors.accent }]}>{item.steps}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.taskButton, { backgroundColor: actionColor }]}
                  onPress={() => onItemPress?.(item)}
                  disabled={isClaimed || isLoadingAction}
                  activeOpacity={0.7}
                >
                  {isLoadingAction ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={[styles.taskButtonText, { color: isClaimed ? colors.textDisabled : '#FFF' }]}>{actionLabel}</Text>}
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={item.id || item.key || `${item.title}-${index}`}
              onPress={() => onItemPress?.(item)}
              activeOpacity={0.8}
              style={[styles.row, { marginBottom: index === items.length - 1 ? 0 : 10, backgroundColor: isDark ? colors.card : colors.accentSoft }]}
            >
              <View style={[styles.imageWrapper, { backgroundColor: colors.accentSoft }]}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={[styles.taskImage, { tintColor: colors.accent }]} resizeMode="contain" />
                ) : (
                  <Ionicons name={item.icon || 'ellipse-outline'} size={20} color={colors.accent} />
                )}
                {showSteps && item.steps && (
                  <View style={[styles.floatingBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.stepText, { color: colors.accent }]}>{item.steps}</Text>
                  </View>
                )}
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
              </View>
              <View style={styles.chevronButton}>
                <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
              </View>
            </TouchableOpacity>
          );
        })
      ) : showEmptyState ? (
        renderEmpty ? (
          renderEmpty()
        ) : (
          <View style={[styles.emptyStateContainer, { backgroundColor: isDark ? colors.card : colors.accentSoft }]}>
            <Ionicons name="folder-open-outline" size={24} color={colors.textDisabled} />
            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>{emptyStateTitle}</Text>
            <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>{emptyStateSubtitle}</Text>
          </View>
        )
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionCard: { borderRadius: 16, padding: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  sectionHeader: { fontSize: 11, fontWeight: '700', textTransform: 'none', letterSpacing: 0.5, opacity: 0.8 },
  headerAction: { fontSize: 11, fontWeight: '700' },
  timerContainer: { flexDirection: 'row', alignItems: 'center' },
  timerPrefix: { fontSize: 10, fontWeight: '600', marginRight: 6 },
  timeWrapper: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  timeDigit: { fontSize: 10, fontWeight: '700' },
  timeSeparator: { fontSize: 10, fontWeight: '700', marginHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderRadius: 12, paddingHorizontal: 12 },
  imageWrapper: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  taskImage: { width: '45%', height: '45%' },
  floatingBadge: { position: 'absolute', bottom: -4, right: -4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, borderWidth: 1 },
  textContainer: { flex: 1, marginLeft: 12 },
  title: { fontSize: 13, fontWeight: '600' },
  subtitle: { fontSize: 10, marginTop: 1 },
  stepText: { fontSize: 8, fontWeight: '800' },
  taskButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 70, minWidth: 70, alignItems: 'center', justifyContent: 'center' },
  taskButtonText: { fontSize: 11, fontWeight: '700' },
  chevronButton: { padding: 4 },
  placeholderIcon: { width: 38, height: 38, borderRadius: 10 },
  placeholderCopy: { flex: 1, marginLeft: 12 },
  placeholderLine: { height: 10, borderRadius: 4 },
  placeholderAction: { width: 70, height: 28, borderRadius: 70 },
  emptyStateContainer: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 12,
  },
  emptyStateTitle: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  emptyStateSubtitle: { fontSize: 11, marginTop: 4, textAlign: 'center' },
});

export default UnifiedServiceSection;
