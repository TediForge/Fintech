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
  Modal,
  Animated,
  PanResponder,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@components/headers/ScreenHeader';
import * as ImagePicker from 'expo-image-picker';
import LoadingScreen from '@components/Loading/LoadingScreen';

import config from '@config/app';
import { brandConfig } from '@config/brand';

const { width, height: screenHeight } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';
const BACKGROUND_COLOR = '#F5F8F7';

const BUG_CATEGORIES = [
  'App Crash', 'Login', 'Registration', 'Wallet', 'Payments', 'Deposit', 
  'Withdrawal', 'Transfer', 'Transactions', 'Cards', 'Rewards', 
  'Notifications', 'Security', 'Settings', 'Performance', 'User Interface', 'Other'
];
const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const CategoryPicker = ({ options, onSelect, selectedValue, placeholder }) => {
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const sheetAnim = React.useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setIsSheetVisible(true);
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: screenHeight, duration: 300, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setIsSheetVisible(false));
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: Animated.event([null, { dy: sheetAnim }], {
        useNativeDriver: false,
        listener: (_, gestureState) => {
          if (gestureState.dy < 0) sheetAnim.setValue(0);
        },
      }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 40 }).start();
        }
      },
    })
  ).current;

  return (
    <>
      <TouchableOpacity style={styles.pickerInput} onPress={openSheet}>
        <Text style={[styles.pickerText, !selectedValue && styles.pickerPlaceholder]}>
          {selectedValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>
      <Modal visible={isSheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={styles.sheetRoot}>
          <Animated.View style={[styles.sheetOverlay, { opacity: overlayOpacity }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSheet} />
          </Animated.View>
          <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetAnim }] }]} {...panResponder.panHandlers}>
            <View style={styles.dragIndicator} />
            <Text style={styles.sheetMainTitle}>Select an Option</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollContent}>
              {options.map(option => (<TouchableOpacity key={option} style={styles.sheetOption} onPress={() => { onSelect(option); closeSheet(); }}><Text style={styles.sheetOptionText}>{option}</Text></TouchableOpacity>))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const ReportBugScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const [bugData, setBugData] = useState({
    title: '',
    category: '',
    severity: '',
    description: '',
    steps: '',
    expected: '',
    actual: '',
    attachments: [],
  });

  const handleBugDataChange = (field, value) => {
    setBugData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const { title, category, severity, description, steps, expected, actual } = bugData;

    if (!title.trim() || !category || !severity || !description.trim() || !steps.trim() || !expected.trim() || !actual.trim()) {
      Alert.sheet('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (description.trim().length < 30) {
      Alert.sheet('Description Too Short', 'Please provide at least 30 characters in the description.');
      return;
    }

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      Alert.sheet(
        'Bug Report Submitted',
        'Thank you for your feedback! Our team will investigate the issue.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }, 2000);
  };

  const addAttachment = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.sheet("Permission Denied", "We need access to your gallery to add attachments.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Allow videos and images
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const newAttachments = result.assets.map(asset => ({
        id: asset.assetId || `${Date.now()}-${Math.random()}`,
        uri: asset.uri,
        type: asset.type,
      }));
      handleBugDataChange('attachments', [...bugData.attachments, ...newAttachments]);
    }
  };

  const removeAttachment = (uri) => {
    handleBugDataChange('attachments', bugData.attachments.filter(a => a.uri !== uri));
  };

  const renderAttachments = (attachments) => (
    <View style={styles.attachmentGrid}>
      {attachments.map(attachment => (
        <View key={attachment.uri} style={styles.imagePreviewWrapper}>
          {attachment.type === 'video' ? (
            <View style={styles.videoPreview}>
              <Ionicons name="videocam-outline" size={32} color={BRAND_COLOR} />
            </View>
          ) : (
            <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
          )}
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeAttachment(attachment.uri)}>
            <Ionicons name="close-circle" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />

      <ScreenHeader
        title="Report a Bug"
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
            <Text style={styles.label}>Bug Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="A short summary of the issue"
              placeholderTextColor="#A1A1A1"
              maxLength={80}
              value={bugData.title}
              onChangeText={(val) => handleBugDataChange('title', val)}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
              <CategoryPicker
                options={BUG_CATEGORIES}
                selectedValue={bugData.category}
                onSelect={(val) => handleBugDataChange('category', val)}
                placeholder="Select category"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Severity <Text style={styles.required}>*</Text></Text>
              <CategoryPicker
                options={SEVERITY_LEVELS}
                selectedValue={bugData.severity}
                onSelect={(val) => handleBugDataChange('severity', val)}
                placeholder="Select severity"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the issue in detail (min. 30 characters)"
              placeholderTextColor="#A1A1A1"
              multiline
              maxLength={5000}
              value={bugData.description}
              onChangeText={(val) => handleBugDataChange('description', val)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Steps to Reproduce <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea, { height: 140 }]}
              placeholder={"1. Open the Wallet screen\n2. Tap Deposit\n3. App closes unexpectedly"}
              placeholderTextColor="#A1A1A1"
              multiline
              value={bugData.steps}
              onChangeText={(val) => handleBugDataChange('steps', val)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Expected Result <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              placeholder="What should have happened?"
              placeholderTextColor="#A1A1A1"
              multiline
              value={bugData.expected}
              onChangeText={(val) => handleBugDataChange('expected', val)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Actual Result <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              placeholder="What actually happened?"
              placeholderTextColor="#A1A1A1"
              multiline
              value={bugData.actual}
              onChangeText={(val) => handleBugDataChange('actual', val)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Attachments (Optional)</Text>
            {renderAttachments(bugData.attachments)}
            <TouchableOpacity style={styles.attachmentButton} onPress={addAttachment}>
              <Ionicons name="attach" size={16} color={BRAND_COLOR} />
              <Text style={styles.attachmentButtonText}>Add Screenshot or Recording</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimerText}>
            By submitting this bug report you agree that the information and attachments you provide may be used by {brandConfig.brandName} to investigate, reproduce, and resolve the reported issue.
          </Text>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Bug Report</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <LoadingScreen visible={loading} message="Submitting Report..." />
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
    paddingTop: 20,
    paddingBottom: 40,
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
    minHeight: 50,
    fontSize: 14,
    color: '#1A1A1A',
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  pickerInput: {
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
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 12 * scale,
    backgroundColor: '#F0F5F3',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12 * scale,
    backgroundColor: '#E8F2EE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(14, 60, 46, 0.2)',
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
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
  pickerText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  pickerPlaceholder: {
    color: '#A1A1A1',
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
  sheetMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 15,
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

export default ReportBugScreen;