import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity,
  Platform, ScrollView, SafeAreaView, Dimensions,
  ActivityIndicator, TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { formatDate as sharedFormatDate } from '@lib/utils/format';
import useApiClient from '@hooks/apiClient';
import LoadingScreen from '@components/Loading/LoadingScreen';
import SearchBar from '@components/common/SearchBar';
import config from '@config/app';
import { apiConfig } from '@config/api';
import PinVerify from '@auth/verification/pin/pinVerify';

const { width, height: screenHeight } = Dimensions.get('window');
const API_BASE = `${apiConfig.baseUrl}/v1`;
const BRAND_DARK = "#0E3C2E";
const BORDER_COLOR = "#E2E8F0";
const TEXT_MUTED = "#64748B";

export default function AccountStatementScreen() {
  const navigation = useNavigation();
  const { user, loading: userLoading, checkSession } = useApiClient();

  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [timeFrame, setTimeFrame] = useState('last_month');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (user && user.email) {
      setUserEmail(user.email);
    } else if (!userLoading) {
      checkSession();
    }
  }, [user, userLoading, checkSession]);

  const calculateDates = () => {
    const today = new Date();
    let start = new Date();

    if (timeFrame === 'last_month') {
      start.setMonth(today.getMonth() - 1);
      start.setDate(1);
    } else if (timeFrame === 'last_3_months') {
      start.setMonth(today.getMonth() - 3);
      start.setDate(1);
    } else {
      return; 
    }

    setStartDate(start);
    setEndDate(today);
  };

  useEffect(() => {
    if (timeFrame !== 'custom') {
      calculateDates();
    }
  }, [timeFrame]);

  const handleGenerateStatement = () => {
    if (!userEmail) {
      Alert.sheet('Error', 'No email found in your profile. Please update it in settings.');
      return;
    }

    setShowPin(true);
  };

  const generateStatement = async () => {

    setLoading(true);

    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        navigation.navigate('Login');
        return;
      }

      const payload = {
        [config.sessionToken]: sessionToken,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        email: userEmail,
      };

      const res = await fetch(`${API_BASE}/user/transactions/statements/generate.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      let data;

      try {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.indexOf('}', jsonStart);

        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error('No JSON object found');
        }

        data = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1));
      } catch (parseError) {
        console.error('Account statement returned invalid JSON:', responseText);
        throw new Error('Invalid server response');
      }

      if (res.ok && (data.success === true || data.success === 'true')) {
        Alert.sheet('Success', data.message || 'Your account statement has been sent');
      } else {
        const msg = data.message || data.error || 'Failed to generate statement';
        Alert.sheet('Error', msg);
      }
    } catch (err) {
      Alert.sheet('Error', 'Network error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePinApproval = (status) => {
    setShowPin(false);
    if (status === 'approved') {
      generateStatement();
    }
  };

  const onStartDateChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setEndDate(selectedDate);
  };

  return (
    <>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      {loading && <LoadingScreen visible={true} message="Generating statement..." />}
      <PinVerify
        visible={showPin}
        onResult={handlePinApproval}
        onClose={() => setShowPin(false)}
      />

      <LinearGradient colors={["#e8f0ec", "#f5faf8"]} style={styles.gradientBackground}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="close" size={18} color={BRAND_DARK} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}></Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 15 }}>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <Text style={styles.heroSubtitle}>Account Services</Text>
              <Text style={styles.heroTitle}>Account Statement</Text>
              <Text style={styles.heroDesc}>
                Generate and receive your transaction history via email
              </Text>
            </View>
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Time Frame Selection */}
            <Text style={styles.sectionLabel}>Time Frame</Text>
            <View style={styles.timeFrameRow}>
              <TouchableOpacity
                style={[
                  styles.timeFrameBtn,
                  timeFrame === 'last_month' && styles.timeFrameBtnActive,
                ]}
                onPress={() => setTimeFrame('last_month')}
              >
                <Text style={[
                  styles.timeFrameText,
                  timeFrame === 'last_month' && styles.timeFrameTextActive,
                ]}>
                  Last Month
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeFrameBtn,
                  timeFrame === 'last_3_months' && styles.timeFrameBtnActive,
                ]}
                onPress={() => setTimeFrame('last_3_months')}
              >
                <Text style={[
                  styles.timeFrameText,
                  timeFrame === 'last_3_months' && styles.timeFrameTextActive,
                ]}>
                  3 Months
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeFrameBtn,
                  timeFrame === 'custom' && styles.timeFrameBtnActive,
                ]}
                onPress={() => setTimeFrame('custom')}
              >
                <Text style={[
                  styles.timeFrameText,
                  timeFrame === 'custom' && styles.timeFrameTextActive,
                ]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Pickers */}
            <View style={styles.dateRow}>
              <View style={styles.dateInputWrapper}>
                <Text style={styles.sectionLabel}>Start Date</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, timeFrame !== 'custom' && styles.inputDisabled]}
                  onPress={() => timeFrame === 'custom' && setShowStartPicker(true)}
                  disabled={timeFrame !== 'custom'}
                >
                  <Text style={styles.dateText}>
                    {sharedFormatDate(startDate)}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>

              <View style={styles.dateInputWrapper}>
                <Text style={styles.sectionLabel}>End Date</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, timeFrame !== 'custom' && styles.inputDisabled]}
                  onPress={() => timeFrame === 'custom' && setShowEndPicker(true)}
                  disabled={timeFrame !== 'custom'}
                >
                  <Text style={styles.dateText}>
                    {sharedFormatDate(endDate)}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Email Display */}
            <Text style={styles.sectionLabel}>Send To Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color={TEXT_MUTED} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={userEmail || (userLoading ? 'Loading...' : 'Not found in profile')}
                editable={false}
                placeholder="Your registered email"
                placeholderTextColor={TEXT_MUTED}
              />
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[
                styles.generateBtn,
                (!userEmail || loading) && styles.generateBtnDisabled,
              ]}
              onPress={handleGenerateStatement}
              disabled={loading || !userEmail}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.generateBtnText}>GENERATE & SEND STATEMENT</Text>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Date Pickers Modals */}
          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={onStartDateChange}
              maximumDate={new Date()}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={onEndDateChange}
              maximumDate={new Date()}
              minimumDate={startDate}
            />
          )}
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 5 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 50,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_DARK,
  },
  heroSection: {
    marginBottom: 15,
  },
  heroSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: BRAND_DARK,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: BRAND_DARK,
    lineHeight: 24,
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 11,
    color: TEXT_MUTED,
    lineHeight: 17,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    paddingTop: 5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_DARK,
    marginBottom: 8,
    marginTop: 10,
  },
  timeFrameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  timeFrameBtn: {
    flex: 1,
    paddingVertical: 14,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  timeFrameBtnActive: {
    backgroundColor: BRAND_DARK,
    borderColor: BRAND_DARK,
  },
  timeFrameText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_MUTED,
  },
  timeFrameTextActive: {
    color: "#fff",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dateInputWrapper: {
    flex: 1,
    marginHorizontal: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  inputDisabled: {
    backgroundColor: "#F1F5F9",
  },
  dateText: {
    fontSize: 13,
    color: BRAND_DARK,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: BRAND_DARK,
    height: "100%",
  },
  generateBtn: {
    backgroundColor: BRAND_DARK,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  generateBtnDisabled: {
    backgroundColor: TEXT_MUTED,
    opacity: 0.7,
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});