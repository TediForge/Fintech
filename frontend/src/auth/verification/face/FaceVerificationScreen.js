import { Alert } from '@components/common/Alert';
import React, { useState, useEffect } from 'react';
import { View, Button, StyleSheet, Text, Image } from 'react-native';
import { getSessionToken } from '@hooks/useAuth';
import { FaceVerificationSheet } from './FaceVerificationSheet';

export default function FaceVerificationScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [selfieUri, setSelfieUri] = useState(null);
  const [sheetConfig, setSheetConfig] = useState({
    riskLevel: 'MEDIUM',
    getSelfie: false,
    livenessOnly: false
  });

  useEffect(() => {
    const initializeSession = async () => {
      const token = await getSessionToken();
      setSessionToken(token);
    };
    initializeSession();
  }, []); 

  const handleVerificationCallback = (result) => {
    setSheetOpen(false);
      
    if (result.status === 'SUCCESS') {
      const selfieInfo = result.liveSelfie ? "\n\nSelfie capture was returned to the caller." : "";
      if (result.liveSelfie) {
        setSelfieUri(result.liveSelfie);
      }
      Alert.sheet('Passed', 'Biometric verification completed.' + selfieInfo);
    } else {
      // Correctly captures manual modal dismissals or gesture drag cancel flags
      Alert.sheet('Session Terminated', `Reason: ${result.reason}`);
    }
  };

  const triggerExample = async (risk, getSelfie, livenessOnly = false) => {
    const activeSessionToken = sessionToken || (await getSessionToken());
    setSelfieUri(null); // Reset preview for new attempt
    setSessionToken(activeSessionToken);
    setSheetConfig({
      riskLevel: risk,
      getSelfie,
      livenessOnly
    });
    setSheetOpen(true);
  };

  return (
    <View style={styles.viewRoot}>
      <Text style={styles.headerText}>Face Verification Test Suite</Text>
      
      <View style={styles.group}>
        <Button 
          title="Standard (Med Risk, No Selfie)" 
          onPress={() => triggerExample('MEDIUM', false)} 
          color="#0E3C2E" 
        />
        <Button 
          title="High Security (High Risk + Selfie)" 
          onPress={() => triggerExample('HIGH', true)} 
          color="#D97706" 
        />
        <Button 
          title="Critical (4 Challenges + Selfie)" 
          onPress={() => triggerExample('CRITICAL', true)} 
          color="#EF4444" 
        />
        <Button 
          title="Low Friction (2 Challenges, Fast)" 
          onPress={() => triggerExample('LOW', false)} 
          color="#10B981" 
        />
        <Button
          title="Liveness Only (Capture Selfie, No Matching)"
          onPress={() => triggerExample('MEDIUM', true, true)}
          color="#0F766E"
        />
      </View>

      {selfieUri && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Last Verified Selfie:</Text>
          <Image source={{ uri: selfieUri }} style={styles.selfiePreview} />
        </View>
      )}
      
      <FaceVerificationSheet
        isVisible={sheetOpen}
        sessionId={sessionToken || undefined}
        riskLevel={sheetConfig.riskLevel}
        getSelfie={sheetConfig.getSelfie}
        livenessOnly={sheetConfig.livenessOnly}
        onVerificationComplete={handleVerificationCallback}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eff7f4', padding: 20 },
  headerText: { fontSize: 18, fontWeight: '800', color: '#0E3C2E', marginBottom: 30 },
  group: { width: '100%', gap: 14 },
  previewContainer: { marginTop: 30, alignItems: 'center' },
  previewLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10, textTransform: 'uppercase' },
  selfiePreview: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#10B981', backgroundColor: '#e2e8f0' }
});