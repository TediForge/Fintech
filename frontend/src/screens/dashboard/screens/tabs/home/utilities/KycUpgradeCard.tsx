import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useApiClient from '@hooks/apiClient';
import { useTheme } from '@providers/ThemeProvider';
import { useAuthState } from '@hooks/useAuth';

const KycUpgradeCard = ({ isAuthResolved = true }) => {
  const { tier, loading } = useApiClient();
  const { colors } = useTheme();
  const { sessionToken, isAuthLoading } = useAuthState();
  const navigation = useNavigation();

  // Hide during auth loading
  if (isAuthLoading) {
    return <View style={styles.placeholderCard} />;
  }

  // Hide if not authenticated
  if (!sessionToken) {
    return null;
  }

  // Hide while loading tier data
  if (!isAuthResolved || loading || tier === null || tier === undefined) {
    return <View style={styles.placeholderCard} />;
  }

  const grade = tier;

  const tierTextMap = {
    0: {
      title: 'Start verifying your account',
      subtitle: 'Verify your identity to unlock more features',
      nextTier: 1,
    },
    1: {
      title: 'Upgrade your account in minutes',
      subtitle: 'Verify your identity to unlock more features',
      nextTier: 2,
    },
    2: {
      title: 'Go unlimited with Tier 3',
      subtitle: 'Increase your transaction limits', 
      nextTier: 3,
    },
  };

  // 2. If user is already Tier 3 or higher, don't show the card
  if (grade >= 3) return null;

  // 3. Fallback: If for some reason the tier isn't in our map, don't crash
  const config = tierTextMap[grade];
  if (!config) return null;

  const handleUpgrade = () => {
    navigation.navigate('kycScreen', { upgrade: true });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <View style={styles.leftContent}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{config.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{config.subtitle}</Text>
      </View>

      <TouchableOpacity 
        style={[styles.buttonOutline, { borderColor: colors.textPrimary }]} 
        onPress={handleUpgrade}
        activeOpacity={0.8}
      >
        <View style={[styles.innerButton, { backgroundColor: colors.textPrimary }]}>
          <Text style={[styles.innerButtonText, { color: colors.background }]}>Upgrade</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default KycUpgradeCard;

const styles = StyleSheet.create({
  placeholderCard: {
    height: 62,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: '#EEF5F1',
  },
  card: {
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    marginVertical: 10,
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
  },
  buttonOutline: {
    padding: 2.5,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#111',
  },
  innerButton: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  innerButtonText: {
    fontWeight: 'bold',
    fontSize: 11,
  },
});