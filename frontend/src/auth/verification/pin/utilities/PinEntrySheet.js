import { Alert } from '@components/common/Alert';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';

const PinEntrySheet = ({ visible, onClose, action, title, successMessage, requestId, requiresOldPin = false }) => {
  const [pin, setPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(requiresOldPin ? 'old' : 'new');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setOldPin('');
      setConfirmPin('');
      setStep(requiresOldPin ? 'old' : 'new');
      setLoading(false);
    }
  }, [visible]);

  const submit = async (nextConfirmPin) => {
    if (pin !== nextConfirmPin) {
      Alert.sheet('PIN Matching Error', 'Confirmation PIN does not match.');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      const token = await getSessionToken();
      const response = await fetch(`${apiConfig.baseUrl}/v1/auth/verification/pin/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          [config.sessionToken]: token,
          ...(requestId ? { requestId } : {}),
          ...(requiresOldPin ? { oldPin } : {}),
          newPin: pin,
          confirmNewPin: nextConfirmPin,
        }),
      });
      const result = await response.json();

      if (response.ok && result?.success === true) {
        Alert.sheet('Success', successMessage, [{ text: 'Done', onPress: onClose }]);
      } else {
        Alert.sheet('PIN Error', result?.message || 'Unable to update your PIN.');
        setPin('');
        setOldPin('');
        setConfirmPin('');
        setStep(requiresOldPin ? 'old' : 'new');
      }
    } catch (error) {
      Alert.sheet('Connection Error', 'Unable to update your PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (value) => {
    if (loading) return;
    const currentValue = step === 'old' ? oldPin : step === 'confirm' ? confirmPin : pin;
    if (currentValue.length >= 4) return;

    const nextValue = currentValue + value;
    if (step === 'old') {
      setOldPin(nextValue);
      if (nextValue.length === 4) setTimeout(() => setStep('new'), 250);
    } else if (step === 'confirm') {
      setConfirmPin(nextValue);
      if (nextValue.length === 4) submit(nextValue);
    } else {
      setPin(nextValue);
      if (nextValue.length === 4) setTimeout(() => setStep('confirm'), 250);
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    if (step === 'old') setOldPin((value) => value.slice(0, -1));
    else if (step === 'confirm') setConfirmPin((value) => value.slice(0, -1));
    else setPin((value) => value.slice(0, -1));
  };

  const currentValue = step === 'old' ? oldPin : step === 'confirm' ? confirmPin : pin;
  const stepTitle = step === 'old' ? 'Enter your current PIN' : step === 'confirm' ? 'Confirm your new PIN' : title;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{stepTitle}</Text>
          <Text style={styles.subtitle}>Enter a new 4-digit transaction PIN</Text>
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={[styles.dot, currentValue.length > index && styles.activeDot]} />
            ))}
          </View>
          <View style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'back'].map((value, index) => (
              <TouchableOpacity
                key={`${value}-${index}`}
                style={styles.key}
                disabled={value === null || loading}
                onPress={() => value === 'back' ? handleBackspace() : handlePress(String(value))}
              >
                {value === 'back' ? <Ionicons name="backspace-outline" size={24} color="#333" /> : value !== null ? <Text style={styles.keyText}>{value}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, alignItems: 'center' },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB', marginBottom: 20 },
  title: { color: '#111827', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#6B7280', fontSize: 13, marginTop: 6 },
  dots: { flexDirection: 'row', gap: 14, marginVertical: 24 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#E5E7EB' },
  activeDot: { backgroundColor: '#0E3C2E' },
  keypad: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  key: { width: '30%', height: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderRadius: 14, backgroundColor: '#F3F4F6' },
  keyText: { color: '#111827', fontSize: 22, fontWeight: '600' },
  cancel: { color: '#0E3C2E', fontSize: 14, fontWeight: '700', paddingVertical: 8 },
});

export default PinEntrySheet;
