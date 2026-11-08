import { Alert } from '@components/common/Alert';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { getSessionToken } from '@hooks/useAuth';
import config from '@config/app';
import { apiConfig } from '@config/api';
import EmailOtp from '@auth/verification/otp/email';
import PinEntrySheet from './utilities/PinEntrySheet';

const PinReset = ({ visible, onClose }) => {
  const [requestId, setRequestId] = useState(null);
  const [verifiedRequestId, setVerifiedRequestId] = useState(null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);

  const initiateReset = async () => {
    setIsInitiating(true);
    try {
      const token = await getSessionToken();
      const response = await fetch(`${apiConfig.baseUrl}/v1/auth/verification/pin/index.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initiateResetPin', [config.sessionToken]: token }),
      });
      const result = await response.json();
      if (response.ok && result?.success === true && result?.requestId) {
        setRequestId(result.requestId);
        setShowOtp(true);
      } else {
        Alert.sheet('PIN Reset Error', result?.message || 'Unable to start PIN reset.');
        onClose?.();
      }
    } catch (error) {
      Alert.sheet('Connection Error', 'Unable to start PIN reset.');
      onClose?.();
    } finally {
      setIsInitiating(false);
    }
  };

  React.useEffect(() => {
    if (visible) initiateReset();
    else {
      setRequestId(null);
      setVerifiedRequestId(null);
      setShowOtp(false);
      setShowPinEntry(false);
    }
  }, [visible]);

  return (
    <>
      <Modal transparent visible={visible && isInitiating} animationType="fade">
        <View style={styles.loading}><Text style={styles.loadingText}>Starting PIN reset...</Text></View>
      </Modal>
      <EmailOtp
        visible={visible && showOtp}
        purpose="pinReset"
        requestId={requestId}
        onRequestIdChange={setRequestId}
        onClose={() => setShowOtp(false)}
        onVerified={({ requestId: verifiedId } = {}) => {
          setVerifiedRequestId(verifiedId || requestId);
          setShowOtp(false);
          setShowPinEntry(true);
        }}
      />
      <PinEntrySheet
        visible={visible && showPinEntry}
        onClose={() => { setShowPinEntry(false); onClose?.(); }}
        action="resetPin"
        requestId={verifiedRequestId}
        title="Set your new PIN"
        successMessage="Your transaction PIN was reset successfully."
      />
    </>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  loadingText: { backgroundColor: '#FFF', color: '#111827', padding: 20, borderRadius: 12, fontWeight: '600' },
});

export default PinReset;