import React, { useEffect, useRef } from 'react';
import { Animated, View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@providers/ThemeProvider';

const CustomSwitch = ({ value, onValueChange, width = 60, height = 30, disabled = false }) => {
  const thumbSize = height - 4;
  const animation = useRef(new Animated.Value(value ? 1 : 0)).current;
  const { colors } = useTheme();

  useEffect(() => {
    Animated.timing(animation, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [2, width - thumbSize - 2],
  });

  const backgroundColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.muted, colors.accent],
  });

  return (
    <Pressable onPress={() => !disabled && onValueChange?.(!value)} disabled={disabled} style={disabled && styles.disabledPressable}>
      <Animated.View style={[styles.track, { width, height, backgroundColor }, disabled && styles.disabledTrack]}>
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              backgroundColor: colors.card,
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    borderRadius: 20,
    justifyContent: 'center',
  },
  thumb: {
    borderRadius: 100,
  },
  disabledTrack: {
    opacity: 0.65,
  },
  disabledPressable: {
    opacity: 0.9,
  },
});

export default CustomSwitch;