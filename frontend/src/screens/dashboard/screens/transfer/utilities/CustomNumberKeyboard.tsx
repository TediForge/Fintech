import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  Platform 
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

// Adaptive constants for cross-platform spacing
const IS_TALL_SCREEN = height > 750;
const SAFE_BOTTOM = Platform.OS === 'ios' ? (IS_TALL_SCREEN ? 40 : 25) : 20;

// Original refined palette
const TEXT_PRIMARY = '#1A2F28';
const ACTION_PRIMARY = '#1B4D3E';
const BORDER_SOFT = '#E2E9E7';
const BG_KEYBOARD = '#FFFFFF';

export const CustomNumberKeyboard = ({ onKeyPress, onNext, isNextDisabled }) => {
  
  const Key = ({ value }) => (
    <TouchableOpacity 
      style={styles.key} 
      onPress={() => onKeyPress(value)}
      activeOpacity={0.4}
    >
      {value === 'delete' ? (
        <Ionicons name="backspace-outline" size={24} color={TEXT_PRIMARY} />
      ) : (
        <Text style={styles.keyText}>{value}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.inner}>
        {/* Row-based layout ensures perfect grid alignment */}
        <View style={styles.row}>
          <Key value="1" />
          <Key value="2" />
          <Key value="3" />
        </View>

        <View style={styles.row}>
          <Key value="4" />
          <Key value="5" />
          <Key value="6" />
        </View>

        <View style={styles.row}>
          <Key value="7" />
          <Key value="8" />
          <Key value="9" />
        </View>

        <View style={styles.row}>
          <Key value="." />
          <Key value="0" />
          <Key value="delete" />
        </View>

        <View style={styles.footerArea}>
          <TouchableOpacity 
            style={[styles.nextBtn, isNextDisabled && styles.nextBtnDisabled]} 
            onPress={onNext}
            disabled={isNextDisabled}
            activeOpacity={0.8}
          >
            <Text style={styles.nextBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    width: width,
    backgroundColor: BG_KEYBOARD,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 0.5,
    borderColor: BORDER_SOFT,
    paddingBottom: SAFE_BOTTOM, // Responsive bottom padding
  },
  inner: {
    paddingVertical: 10,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginVertical: 2, // Tight spacing between rows
  },
  key: {
    width: width / 3.2,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 23,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  footerArea: {
    marginTop: 15,
    paddingHorizontal: 24,
  },
  nextBtn: {
    backgroundColor: ACTION_PRIMARY,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: '#D1DCD9',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CustomNumberKeyboard;