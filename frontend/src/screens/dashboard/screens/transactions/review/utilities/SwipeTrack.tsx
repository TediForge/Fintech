import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

const BUTTON_HEIGHT = 58;
const THUMB_SIZE = 46;
const BUTTON_PADDING = (BUTTON_HEIGHT - THUMB_SIZE) / 2;
const BRAND_COLOR = '#0E3C2E';

export default function SwipeTrack({
  onConfirm,
  label = 'Swipe to Continue',
  finishLabel = 'Release to Proceed',
  thumbColor = BRAND_COLOR,
  trackColor = '#F0F2F5',
  fillColor = BRAND_COLOR,
  disabled = false,
  // number that when changed will reset the track to start (0)
  resetTrigger = 0,
  // number that when changed will force the track to the end (complete)
  completeTrigger = 0,
}) {
  const translateX = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const swipeRange = trackWidth > 0
    ? trackWidth - THUMB_SIZE - BUTTON_PADDING * 2
    : 300 - THUMB_SIZE - BUTTON_PADDING * 2;

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(1)
    .activeOffsetX([-2, 2])
    .failOffsetY([-20, 20])
    .shouldCancelWhenOutside(false)
    .activateAfterLongPress(0)
    .onUpdate((event) => {
      const newX = Math.max(0, Math.min(event.translationX, swipeRange));
      translateX.value = newX;
    })
    .onEnd((event) => {
      const shouldConfirm =
        translateX.value > swipeRange * 0.7 ||
        event.velocityX > 800;

      if (shouldConfirm) {
        translateX.value = withSpring(swipeRange, {}, () => {
          if (typeof onConfirm === 'function') {
            runOnJS(onConfirm)();
          }
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedTrackFillStyle = useAnimatedStyle(() => ({
    width: interpolate(
      translateX.value,
      [0, swipeRange],
      [THUMB_SIZE + BUTTON_PADDING * 2, trackWidth > 0 ? trackWidth : 300],
      Extrapolate.CLAMP
    ),
  }));

  const animatedTextOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, swipeRange * 0.4],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  const animatedFinishTextOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [swipeRange * 0.6, swipeRange],
      [0, 1],
      Extrapolate.CLAMP
    ),
  }));

  // Watch resetTrigger and completeTrigger from JS side and animate accordingly
  const _mountedReset = useRef(false);
  const _mountedComplete = useRef(false);

  useEffect(() => {
    if (!_mountedReset.current) {
      _mountedReset.current = true;
      return;
    }
    // reset to start
    translateX.value = withSpring(0);
  }, [resetTrigger]);

  useEffect(() => {
    if (!_mountedComplete.current) {
      _mountedComplete.current = true;
      return;
    }
    // complete to end if track measured; fallback to max known range
    const to = swipeRange || 0;
    translateX.value = withSpring(to);
  }, [completeTrigger]);

  return (
    <View style={[styles.swipeButtonContainer, disabled && styles.swipeButtonDisabled]}>
      <View
        style={[styles.swipeTrack, { backgroundColor: trackColor }]}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setTrackWidth(width);
        }}
      >
        <Animated.View
          style={[styles.swipeFill, animatedTrackFillStyle, { backgroundColor: fillColor }]}
        />

        <Animated.Text
          pointerEvents="none"
          style={[styles.swipeComplete, animatedFinishTextOpacity]}
        >
          {finishLabel}
        </Animated.Text>

        <GestureDetector gesture={panGesture}>
          <View style={styles.swipeContainer}>
            <Animated.View style={[styles.swipeThumb, animatedThumbStyle, { backgroundColor: thumbColor }]}> 
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Animated.View>
          </View>
        </GestureDetector>

        <Animated.Text
          pointerEvents="none"
          style={[styles.swipeInstruction, animatedTextOpacity]}
        >
          {label}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeButtonContainer: {
    marginTop: 20,
  },
  swipeButtonDisabled: {
    opacity: 0.55,
  },
  swipeTrack: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  swipeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: BUTTON_HEIGHT / 2,
  },
  swipeContainer: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: 'transparent',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    left: BUTTON_PADDING,
  },
  swipeThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeInstruction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '65%',
    textAlign: 'right',
    textAlignVertical: 'center',
    color: '#444',
    fontSize: 13,
    paddingRight: 20,
    fontWeight: '600',
    lineHeight: BUTTON_HEIGHT,
  },
  swipeComplete: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#F0F2F5',
    fontSize: 13,
    fontWeight: '600',
  },
});
