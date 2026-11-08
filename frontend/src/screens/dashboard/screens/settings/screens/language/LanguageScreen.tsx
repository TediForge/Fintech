import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import { useTheme } from '@providers/ThemeProvider';
import { useLanguage } from '@context/LanguageContext';

const languageOptions = [
  { code: 'en', label: 'English', nativeLabel: 'English', isActive: true },
  { code: 'fr', label: 'French', nativeLabel: 'Français', isActive: false },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', isActive: false },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', isActive: false },
];

const LanguageScreen = () => {
  const { isDark, colors } = useTheme();
  const { language, changeLanguage } = useLanguage();
  const activeLanguageOptions = languageOptions.filter((option) => option.isActive);

  const handleSelectLanguage = (option) => {
    if (!option.isActive) {
      return;
    }

    changeLanguage(option.code);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title="Language"
          backgroundColor={colors.surface}
          textColor={colors.textPrimary}
          iconColor={colors.textPrimary}
        />

        <View style={styles.content}>
          <Text style={[styles.heading, { color: colors.textPrimary }]}>Choose your preferred language</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>This setting is saved on your device and will be used for the app experience.</Text>

          <FlatList
            data={activeLanguageOptions}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = language === item.code;

              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleSelectLanguage(item)}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: isDark ? colors.surface : '#FFFFFF',
                      borderColor: isSelected ? colors.primary : isDark ? '#2A2A2A' : '#E5E7EB',
                      shadowColor: isDark ? '#000000' : '#0F172A',
                    },
                  ]}
                >
                  <View style={styles.optionRow}>
                    <View style={styles.textWrap}>
                      <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>{item.label}</Text>
                      <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>{item.nativeLabel}</Text>
                    </View>

                    {isSelected ? (
                      <View style={[styles.selectionBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.selectionText}>✓</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

export default LanguageScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  optionCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  selectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
