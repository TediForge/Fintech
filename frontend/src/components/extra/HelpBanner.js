// HelpBanner.js
import React from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  StyleSheet,
} from 'react-native';

const { width } = Dimensions.get('window');
const baseWidth = 410; // smallest device baseline
const scale = width / baseWidth;

const sliderWidth = width - 32;
const sliderHeight = sliderWidth * (400 / 1500);

// Hardcoded single image URL (replace with your actual help banner image)
const HELP_BANNER_IMAGE = 'https://paysmart.com.ng/assets/images/help-banner.jpg'; // ← Change this to your real URL

export default function HelpBanner() {
  const handlePress = () => {
    // Add your desired action here (e.g. navigate to help screen, open link, etc.)
    console.log('Help banner pressed');
    // Example: navigation.navigate('HelpScreen');
  };

  return (
    <View style={styles.outerContainer}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
      >
        <Image
          source={{ uri: HELP_BANNER_IMAGE }}
          style={styles.image}
          resizeMode="cover"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    alignSelf: 'center',
    width: sliderWidth,
    height: sliderHeight,
    backgroundColor: '#fff',
  },
  image: {
    width: sliderWidth,
    height: sliderHeight,
    resizeMode: 'cover',
  },
});