import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import config from '@config/app';
import { brandConfig } from '@config/brand';
const { width } = Dimensions.get('window');
const scale = width / 410;
const BRAND_COLOR = '#0E3C2E';

const ReferralCodeCard = ({ code = 'PAY-SMART-82', link, onShare }) => {
  const [copied, setCopied] = useState(false);

  const steps = [
    {
      id: 1,
      title: 'Share Code',
      icon: 'https://cdn-icons-png.flaticon.com/128/9872/9872434.png',
      description: 'Get your referral code from your account',
    },
    {
      id: 2,
      title: 'Share Code',
      icon: 'https://cdn-icons-png.flaticon.com/128/3790/3790110.png',
      description: 'Share your code with friends to join now',
    },
    {
      id: 3,
      title: 'Get Paid',
      icon: 'https://cdn-icons-png.flaticon.com/128/9011/9011529.png',
      description: 'Earn rewards when they join and transact',
    },
  ];

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (typeof onShare === 'function') {
      await onShare();
      return;
    }

    const referralLink = link || `${config.website.replace(/\/$/, '')}/r/${code}`;
    const message = `Join me on ${brandConfig.brandName} using my referral link:\n${referralLink}\n\nUse code ${code} to get started with rewards.`;
    try {
      await Share.share({ message, title: `Join ${brandConfig.brandName}` });
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.stepsRow}>
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <View style={styles.stepItem}>
              <View style={styles.iconWrapper}>
                <Image source={{ uri: step.icon }} style={styles.stepIcon} />
              </View>
              <Text style={styles.desc}>{step.description}</Text>
            </View>
            {index < steps.length - 1 && (
              <Ionicons name="chevron-forward" size={16} color="#DDD" style={{ marginTop: 15 }} />
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.codeContainer}>
        <View style={styles.codeInfo}>
          <Text style={styles.label}>YOUR REFERRAL CODE</Text>
          <View style={styles.dashedBox}>
            <Text style={styles.codeText}>{code}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity 
            onPress={copyToClipboard}
            style={[styles.actionBtn, copied && styles.copyBtnActive]}
            activeOpacity={0.7}
          >
            <Image 
              source={{ uri: copied ? 'https://cdn-icons-png.flaticon.com/128/10469/10469499.png' : 'https://cdn-icons-png.flaticon.com/128/1621/1621635.png' }} 
              style={[styles.buttonIcon, { tintColor: copied ? '#FFF' : BRAND_COLOR }]} 
            />
            <Text style={[styles.actionBtnText, copied && { color: '#FFF' }]}>
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleShare}
            style={styles.shareBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.shareBtnText}>Share Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ReferralCodeCard;

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 20,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#e6f2ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepIcon: {
    width: 22,
    height: 22,
    opacity: 0.8,
  },
  buttonIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  desc: {
    fontSize: 8,
    textAlign: 'center',
  },
  codeContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  codeInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: '#AAA',
    letterSpacing: 1,
    marginBottom: 8,
  },
  dashedBox: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  codeText: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND_COLOR,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 45,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: BRAND_COLOR,
    gap: 8,
  },
  copyBtnActive: {
    backgroundColor: '#2FB86D',
    borderColor: '#2FB86D',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 45,
    borderRadius: 6,
    backgroundColor: BRAND_COLOR,
    gap: 8,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
});