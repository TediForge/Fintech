import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@providers/ThemeProvider';
import { useVisualDelay } from '@hooks/useVisualDelay';
import ScreenHeader from '@components/headers/ScreenHeader';
import TweetCard from './utilities/tweetCard';
import tweetSamples from './utilities/tweetCard.test.json';

const NewsUpdatesScreen = () => {
  const { isDark, colors } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const showPlaceholder = useVisualDelay(loaded, 80);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 80);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={isDark ? [colors.background, colors.background] : [colors.surfaceAlt, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.screen}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <ScreenHeader title="News & Updates" />

      <View style={[styles.container, isDark && styles.containerDark]}>
        {showPlaceholder ? (
          <View style={styles.placeholderBox}>
            <View style={[styles.placeholderLine, isDark && styles.placeholderLineDark, { width: '45%' }]} />
            <View style={[styles.placeholderLine, isDark && styles.placeholderLineDark, { width: '70%', marginTop: 10 }]} />
          </View>
        ) : (
          <TweetCard tweets={tweetSamples} />
        )}
      </View>
    </LinearGradient>
  );
};

export default NewsUpdatesScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  titleDark: {
    color: '#E4E4E4',
  },
  body: {
    fontSize: 14,
    color: '#6b7280',
  },
  bodyDark: {
    color: '#B0B0B0',
  },
  placeholderBox: {
    width: '100%',
    paddingVertical: 16,
  },
  placeholderLine: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  placeholderLineDark: {
    backgroundColor: '#2A2A2A',
  },
});
