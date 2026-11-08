import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';

const { width } = Dimensions.get('window');
const scale = width / 410;

const GridActionCard = ({
  onPress,
  previewUrl,
  title,
  subtitle,
  actionLabel = 'Select',
  disabled = false,
  containerStyle,
  previewStyle,
  actionStyle,
  actionTextStyle,
  titleStyle,
  subtitleStyle,
  previewImageStyle,
  aspectId = 1,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, containerStyle]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <View style={[styles.previewArea, aspectId === 2 ? styles.previewAreaSquare : styles.previewAreaWide, previewStyle]}>
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={[styles.previewImage, previewImageStyle]} />
        ) : null}
      </View>

      <View style={[styles.actionButton, actionStyle]}>
        <Text style={[styles.actionText, actionTextStyle]}>{actionLabel}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default GridActionCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16 * scale,
    padding: 10 * scale,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: 'rgba(0, 0, 0, 0.03)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  previewArea: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: 10 * scale,
  },
  previewAreaWide: {
    height: 112 * scale,
  },
  previewAreaSquare: {
    aspectRatio: 1,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionButton: {
    width: '100%',
    height: 36 * scale,
    borderRadius: 12 * scale,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionText: {
    fontSize: 11.5 * scale,
    fontWeight: '700',
    color: '#0F172A',
  },
});
