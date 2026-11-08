import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  Pressable, 
  Dimensions,
  Animated 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionToken } from '@hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import config from '@config/app';
import { apiConfig } from '@config/api';

const api = apiConfig.baseUrl;
const { width } = Dimensions.get('window');
const API_URL = `${api}/v1/utilities/daily-checkin/daily_checkin`;
const BRAND_COLOR = '#0E3C2E';
const PAYSMART_PURPLE = '#6C35FF';
const STREAK_ORANGE = '#FF6B35';
const STREAK_FIRE = '#FF9500';

export default function DailyCheckIn() {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [canClaimReward, setCanClaimReward] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);
  const [daysThisWeek, setDaysThisWeek] = useState(0);
  const scaleAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('No session token');

      const response = await fetch(`${API_URL}?${encodeURIComponent(config.sessionToken)}=${encodeURIComponent(token)}`);
      const res = await response.json();

      if (res.status === 'success') {
        setCurrentStreak(res.currentStreak || 0);
        setDaysThisWeek(res.daysThisWeek || 0);
        setCanClaimReward(res.canClaimReward || false);
        setRewardAmount(res.rewardAmount || 0);

        // Show modal if streak is active or completable
        if (res.currentStreak > 0 || res.canClaimReward) {
          setIsVisible(true);
          // Gentle pulse animation when shown
          Animated.loop(
            Animated.sequence([
              Animated.timing(scaleAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
              Animated.timing(scaleAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
            ])
          ).start();
        }
      }
    } catch (e) {
      console.error('Streak fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!canClaimReward) return;

    setClaiming(true);
    try {
      const token = await getSessionToken();
      const formData = new FormData();
      formData.append(config.sessionToken, token);

      const response = await fetch(API_URL, { method: 'POST', body: formData });
      const text = await response.text();
      let res = null;
      if (text && text.trim()) {
        try {
          res = JSON.parse(text);
        } catch {
          res = { status: 'error', message: text.trim() };
        }
      }

      if (res?.status === 'success') {
        Alert.sheet("Streak Complete!", `₦${res.rewardGiven} added to your cashback!`);
        setCanClaimReward(false);
        setCurrentStreak(0); // Reset UI streak after claim
        setIsVisible(false);
      } else {
        Alert.sheet("Error", res.message || "Could not claim reward");
      }
    } catch (e) {
      Alert.sheet("Error", "Network error. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const getDayStatus = (day) => {
    if (day < currentStreak) return 'completed';
    if (day === currentStreak) return 'active';
    return 'pending';
  };

  if (loading || !isVisible) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={() => setIsVisible(false)}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.dimmer} onPress={() => setIsVisible(false)} />
        
        <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.card}>
            <TouchableOpacity 
              style={styles.headerClose}
              onPress={() => setIsVisible(false)}
            >
              <Ionicons name="close-outline" size={28} color="#D1D1D1" />
            </TouchableOpacity>

            <View style={styles.header}>
              <Ionicons name="flame" size={32} color={STREAK_FIRE} />
              <Text style={styles.title}>Keep Your Streak Alive!</Text>
            </View>

            <Text style={styles.subtitle}>
              Check in every day to build your streak — miss one and it resets!
            </Text>

            <View style={styles.streakGrid}>
              {[1,2,3,4,5,6,7].map((day) => {
                const status = getDayStatus(day);
                return (
                  <View 
                    key={day}
                    style={[
                      styles.streakDay,
                      status === 'completed' && styles.completedDay,
                      status === 'active' && styles.activeDay,
                      status === 'pending' && styles.pendingDay,
                    ]}
                  >
                    {status === 'completed' ? (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    ) : status === 'active' ? (
                      <Ionicons name="flame" size={24} color="#fff" />
                    ) : (
                      <Text style={styles.dayNumber}>{day}</Text>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {currentStreak === 0 
                  ? "Start your streak today!" 
                  : currentStreak === 7 
                    ? "Streak complete! Claim your reward" 
                    : `Day ${currentStreak} of 7 • Keep going!`}
              </Text>
              
              {canClaimReward && rewardAmount > 0 && (
                <Text style={styles.rewardReveal}>
                  Reward unlocked: <Text style={styles.rewardAmount}>₦{rewardAmount}</Text>
                </Text>
              )}
            </View>

            {canClaimReward ? (
              <TouchableOpacity
                style={[styles.claimBtn, claiming && styles.btnDisabled]}
                onPress={handleClaim}
                disabled={claiming}
              >
                {claiming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.claimBtnText}>Claim ₦{rewardAmount} Reward</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.checkInBtn}
                onPress={() => {
                  // Optional: trigger check-in from here if you want
                  setIsVisible(false);
                }}
              >
                <Text style={styles.checkInBtnText}>
                  {currentStreak === 0 ? "Start Streak Today" : "Keep the Streak Going"}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.footerNote}>
              Streaks reset if you miss a day. Check in between 00:00 – 23:59 daily!
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalContent: {
    width: '88%',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  headerClose: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: STREAK_FIRE,
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  streakGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  streakDay: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  completedDay: {
    backgroundColor: STREAK_ORANGE,
    borderColor: STREAK_ORANGE,
  },
  activeDay: {
    backgroundColor: STREAK_FIRE,
    borderColor: '#fff',
    shadowColor: STREAK_FIRE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  pendingDay: {
    backgroundColor: '#F0F0F0',
    borderColor: '#E0E0E0',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#888',
  },
  progressInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginBottom: 8,
  },
  rewardReveal: {
    fontSize: 16,
    color: '#333',
  },
  rewardAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: STREAK_FIRE,
  },
  claimBtn: {
    backgroundColor: STREAK_FIRE,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: STREAK_FIRE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  btnDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  claimBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  checkInBtn: {
    backgroundColor: PAYSMART_PURPLE,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  checkInBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    lineHeight: 18,
  },
});