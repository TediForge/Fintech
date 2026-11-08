import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import { useTheme } from '@providers/ThemeProvider';

const EditPhoneNumberScreen = () => {
  const { isDark, colors } = useTheme();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title="Edit Phone Number"
          backgroundColor={colors.surface}
          textColor={colors.textPrimary}
          iconColor={colors.textPrimary}
        />
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Update your phone number</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>This screen is ready for your phone number update form.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default EditPhoneNumberScreen;
