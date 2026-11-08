import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@providers/ThemeProvider';

const ProfileDetailRow = ({ icon, iconColor, label, value, valueColor, isLast = false, editable = false, onPress, colors, isDark }) => (
  <TouchableOpacity
    style={[styles.detailRow, isLast && styles.rowLast, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}
    onPress={editable ? onPress : undefined}
    activeOpacity={editable ? 0.7 : 1}
    disabled={!editable}
  >
    <View style={styles.detailLabelGroup}>
      <Ionicons name={icon} size={16} color={iconColor || colors.textSecondary} style={styles.icon} />
      <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>{label}</Text>
    </View>
    <View style={styles.valueGroup}>
      <Text style={[styles.detailValue, { color: valueColor || colors.textSecondary }]}>{value || 'Not Set'}</Text>
      {editable ? <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} style={styles.chevron} /> : null}
    </View>
  </TouchableOpacity>
);

export const ProfileDetailsSection = ({ title, items, onNavigate }) => {
  const { colors, isDark } = useTheme();
  
  return (
    <View style={styles.sectionWrapper}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.detailsCard, { backgroundColor: colors.card }]}>
        {items.map((item, index) => (
          <ProfileDetailRow
            key={item.key}
            icon={item.icon}
            iconColor={item.iconColor}
            label={item.label}
            value={item.value}
            valueColor={item.valueColor}
            isLast={index === items.length - 1}
            editable={item.editable}
            onPress={() => item.screenName && onNavigate?.(item.screenName)}
            colors={colors}
            isDark={isDark}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionWrapper: { marginVertical: 10 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  detailsCard: {
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.3,
  },
  rowLast: { borderBottomWidth: 0 },
  detailLabelGroup: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  valueGroup: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 8 },
  detailLabel: { fontSize: 11, fontWeight: '500' },
  detailValue: { fontSize: 10, fontWeight: '700', lineHeight: 14, textAlign: 'right' },
  chevron: { marginLeft: 3, marginRight: -5 },
});

export default ProfileDetailsSection;
