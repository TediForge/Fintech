import React from 'react';
import { StyleSheet, SafeAreaView, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import { useTheme } from '@providers/ThemeProvider';

const SpecialOffersScreen = ({ navigation }) => {
  const { isDark, colors } = useTheme();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.background] : [colors.surface, colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader
          title="Special Offers"
          backgroundColor={colors.surface}
          textColor={colors.textPrimary}
          iconColor={colors.textPrimary}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Special Offers</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>Browse current special offers and promotions.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default SpecialOffersScreen;

const styles = StyleSheet.create({
  container: {
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
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
