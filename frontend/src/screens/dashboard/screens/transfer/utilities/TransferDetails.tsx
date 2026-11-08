import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  ScrollView, 
  Animated, 
  Pressable,
  Easing,
  Keyboard 
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { CustomNumberKeyboard } from './CustomNumberKeyboard';

import config from '@config/app';
const quickNarrations = ["Purchase", "Personal"];
const brandColor = '#0E3C2E';

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  amountContainerMain: {
    gap: 12,
    marginTop: 4,
  },
  amountContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E7EBEA',
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
  },
  customerCardIcon: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipientAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  customerCardContent: {
    flex: 1,
    marginLeft: 15,
  },
  customerLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  customerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  customerAddress: {
    fontSize: 12,
    color: '#94A3B8',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  nairaLarge: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
    marginRight: 10,
  },
  mainAmountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  narrationInput: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
    paddingVertical: 10,
  },
});

export const TransferDetails = ({
  recipientInfo, selectedBank, accountNumber,
  amount, setAmount, narration, setNarration, setCurrentPage, processing, handleProceed
}) => {
  const [isCustomKeyboardVisible, setIsCustomKeyboardVisible] = useState(false);
  const [isSystemKeyboardVisible, setIsSystemKeyboardVisible] = useState(false);
  
  const scrollRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const cursorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setIsSystemKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setIsSystemKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isCustomKeyboardVisible ? 0 : 500,
      duration: 300,
      easing: Easing.bezier(0.33, 1, 0.68, 1),
      useNativeDriver: true,
    }).start();

    if (isCustomKeyboardVisible) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 120, animated: true });
      }, 100);
    }
  }, [isCustomKeyboardVisible]);

  useEffect(() => {
    let animation;
    if (isCustomKeyboardVisible) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(cursorOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      );
      animation.start();
    } else {
      cursorOpacity.setValue(0);
    }
    return () => animation?.stop();
  }, [isCustomKeyboardVisible]);

  const closeAllKeyboards = () => {
    Keyboard.dismiss();
    setIsCustomKeyboardVisible(false);
  };

  const onFinalSubmit = () => {
    closeAllKeyboards();
    handleProceed();
  };

  const isButtonDisabled = !amount || parseFloat(amount) <= 0 || processing;
  const presetAmounts = [500, 1000, 2000, 5000, 10000, 20000];
  const recipientProfilePictureUrl = recipientInfo?.profilePictureUrl || recipientInfo?.avatarUrl;
  const selectedBankName = selectedBank?.bankName || '';

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ flex: 1 }} onPress={closeAllKeyboards}>
        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: isCustomKeyboardVisible ? 400 : 150 }]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag" // Takes out system keyboard on scroll
          onScrollBeginDrag={closeAllKeyboards} // Takes out custom keyboard on scroll
        >
          <View style={{ marginTop: 10 }}>
            <View style={styles.customerCard}>
              <View style={styles.customerCardIcon}>
                {recipientProfilePictureUrl ? (
                  <Image source={{ uri: recipientProfilePictureUrl }} style={styles.recipientAvatar} />
                ) : (
                  <Ionicons name="person-circle" size={20} color={brandColor} />
                )}
              </View>
              <View style={styles.customerCardContent}>
                <Text style={styles.customerLabel}>Beneficiary</Text>
                <Text style={styles.customerName}>{recipientInfo?.name}</Text>
                <Text style={styles.customerAddress}>
                    {`${selectedBankName} • ${accountNumber}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCurrentPage(1)}>
                <Text style={{color: brandColor, fontSize: 12, fontWeight: '700'}}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountContainerMain}>
              <Pressable 
                style={[
                  styles.amountContainer, 
                  isCustomKeyboardVisible && { borderColor: brandColor, borderWidth: 1.5, borderRadius: 12 }
                ]} 
                onPress={() => { Keyboard.dismiss(); setIsCustomKeyboardVisible(true); }}
              >
                <Text style={styles.label}>Enter Amount</Text>
                <View style={localStyles.inputRow}>
                  <Text style={styles.nairaLarge}>₦</Text>
                  <View style={localStyles.textCursorWrapper}>
                    <Text style={[styles.mainAmountInput, { color: amount ? '#111' : '#D1DCD9' }]}>
                      {amount || "0.00"}
                    </Text>
                    {isCustomKeyboardVisible && (
                      <Animated.View style={[localStyles.cursor, { opacity: cursorOpacity }]} />
                    )}
                  </View>
                </View>

                <View style={localStyles.presetGrid}>
                  {presetAmounts.map((preset) => {
                    const isSelected = String(amount) === String(preset);
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[localStyles.presetChip, isSelected && localStyles.presetChipSelected]}
                        onPress={() => setAmount(String(preset))}
                      >
                        <Text style={[localStyles.presetText, isSelected && localStyles.presetTextSelected]}>
                          ₦{preset.toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Pressable>

              <View style={localStyles.narrationCard}>
                <Text style={styles.fieldLabel}>Narration (Optional)</Text>
                <TextInput 
                  style={styles.narrationInput} 
                  placeholder="What is this for?"
                  placeholderTextColor="#D1DCD9"
                  value={narration} 
                  onChangeText={(text) => {
                    const maxLen = 100;
                    setNarration(text.slice(0, maxLen));
                  }}
                  onFocus={() => {
                    setIsCustomKeyboardVisible(false);
                    scrollRef.current?.scrollTo({ y: 200, animated: true });
                  }}
                  onSubmitEditing={() => Keyboard.dismiss()} 
                  blurOnSubmit={true}
                />

                <View style={localStyles.quickNotesGrid}>
                  {quickNarrations.map((item, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={localStyles.noteChip}
                      onPress={() => setNarration(item)}
                    >
                      <Text style={localStyles.noteText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {!isCustomKeyboardVisible && !isSystemKeyboardVisible && (
              <TouchableOpacity 
                style={[localStyles.mainButton, isButtonDisabled && { opacity: 0.5 }]}
                onPress={onFinalSubmit}
                disabled={isButtonDisabled}
              >
                <Text style={localStyles.mainButtonText}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Pressable>

      <Animated.View style={[
        localStyles.keyboardWrapper, 
        { transform: [{ translateY: slideAnim }] }
      ]}>
        <CustomNumberKeyboard
          onKeyPress={(key) => {
            if (key === 'delete') setAmount(prev => prev.slice(0, -1));
            else if (key === '.') {
              if (!amount.includes('.')) setAmount(prev => (prev === '' ? '0.' : prev + '.'));
            } else setAmount(prev => (prev === '0' ? key : prev + key));
          }}
          onNext={onFinalSubmit}
          isNextDisabled={isButtonDisabled}
        />
      </Animated.View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  textCursorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 5,
  },
  cursor: {
    width: 2,
    height: 25,
    backgroundColor: brandColor,
    marginLeft: 2,
  },
  narrationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E7EBEA',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 8,
  },
  presetChip: {
    minWidth: '31%',
    backgroundColor: '#F5F8F7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7EBEA',
  },
  presetChipSelected: {
    backgroundColor: '#EAF5EE',
    borderColor: brandColor,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A5A54',
  },
  presetTextSelected: {
    color: brandColor,
  },
  quickNotesGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noteChip: {
    backgroundColor: '#F0F5F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E8E5',
    minWidth: '48%',
    alignItems: 'center',
  },
  noteText: {
    fontSize: 12,
    color: '#4A5A54',
    fontWeight: '500',
  },
  mainButton: {
    backgroundColor: brandColor,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    alignSelf: 'stretch',
    minHeight: 48,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  keyboardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -15 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    zIndex: 2000,
    paddingBottom: 10,
  }
});