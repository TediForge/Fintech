import { Alert } from '@components/common/Alert';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import LoadingScreen from '@components/Loading/LoadingScreen';
import { getSessionToken } from '@hooks/useAuth';
import Constants from 'expo-constants';

import config from '@config/app';
import { apiConfig } from '@config/api';
const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';
const BACKGROUND_COLOR = '#F5F8F7';

const SUGGESTION_CATEGORIES = [
  { label: 'Feature', value: 'feature' },
  { label: 'Improvement', value: 'improvement' },
  { label: 'Bug idea', value: 'bugIdea' },
  { label: 'Other', value: 'other' },
];

const CategoryPicker = ({ options, onSelect, selectedValue, placeholder }) => {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(option => option.value === selectedValue);

  return (
    <View>
      <TouchableOpacity style={styles.input} onPress={() => setOpen(current => !current)}>
        <Text style={[styles.pickerText, !selectedValue && styles.pickerPlaceholder]}>
          {selectedOption?.label || placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
      </TouchableOpacity>
      {open && (
        <View style={styles.categoryOptions}>
          {options.map(option => (
            <TouchableOpacity key={option.value} style={styles.categoryOption} onPress={() => { onSelect(option.value); setOpen(false); }}>
              <Text style={styles.categoryOptionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const SuggestFeatureScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10 || trimmedMessage.length > 1000) {
      Alert.sheet('Invalid message', 'Please enter 10 to 1000 characters.');
      return;
    }

    setLoading(true);
    try {
      const sessionToken = await getSessionToken();
      const payload = {
        message: trimmedMessage,
        ...(category ? { category } : {}),
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        appVersion: Constants.expoConfig?.version || Constants.manifest?.version || 'unknown',
        ...(sessionToken ? { [config.sessionToken]: sessionToken } : {}),
      };
      const response = await fetch(`${apiConfig.baseUrl}/v1/feedback/suggest/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.message || 'Unable to submit feedback.');
      Alert.sheet('Thank you', result.message || 'Your suggestion was received.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.sheet('Submission failed', error.message || 'Unable to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

      <ScreenHeader
        title="Send Feedback"
        backgroundColor="#eff7f4"
        textColor="#000"
        iconColor="#000"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Message <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us what you think (10 to 1000 characters)"
              placeholderTextColor="#A1A1A1"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <CategoryPicker
              options={SUGGESTION_CATEGORIES}
              selectedValue={category}
              onSelect={setCategory}
              placeholder="Select a category (optional)"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Send Feedback</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <LoadingScreen visible={loading} message="Submitting..." />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
    backgroundColor: '#eff7f4',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A4A4A',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 14,
    color: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  pickerText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  pickerPlaceholder: {
    color: '#A1A1A1',
  },
  categoryOptions: {
    marginTop: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F2EE',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 60, 46, 0.2)',
    borderStyle: 'dashed',
  },
  attachmentButtonText: {
    color: BRAND_COLOR,
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 13,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10 * scale,
  },
  imagePreviewWrapper: {
    width: 80 * scale,
    height: 80 * scale,
    borderRadius: 12 * scale,
    overflow: 'visible', // Allow button to be outside
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 12 * scale,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8, right: -8,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  submitButton: {
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#A1A1A1',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 20,
    paddingHorizontal: 10,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#f5f8f7',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    maxHeight: screenHeight * 0.6,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  dragIndicator: {
    width: 40 * scale,
    height: 5 * scale,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 15 * scale,
  },
  sheetHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 15,
    alignItems: 'center',
  },
  sheetMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  sheetOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sheetOptionText: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },
});

export default SuggestFeatureScreen;