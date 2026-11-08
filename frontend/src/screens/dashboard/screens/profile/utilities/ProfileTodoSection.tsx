import React, { useCallback, useEffect, useState } from 'react';
import { Modal, TouchableWithoutFeedback, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import PinSetup from '@auth/verification/pin/pinSetup';
import EmailOtp from '@auth/verification/otp/email';
import { useAuthState } from '@hooks/useAuth';
import { checkUserCompliance } from '@hooks/useCompliance';
import UnifiedServiceSection from '@components/extra/UnifiedServiceSection';

const TODO_STEPS = [
  { id: 'email', title: 'Verify Your Email', subtitle: 'Confirm your email address', sheetRef: 'email', icon: 'mail-outline' },
  { id: 'kyc', title: 'Complete KYC', subtitle: 'Finish your KYC checks now', sheetRef: 'kyc', icon: 'shield-checkmark-outline' },
  { id: 'pinSetup', title: 'Create 4-digit PIN', subtitle: 'Set up your new PIN today', sheetRef: 'pin', icon: 'keypad-outline' },
];

const ProfileTodoSection = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { isAuthenticated, sessionToken } = useAuthState();
  const [completedFields, setCompletedFields] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null);
  const [emailOtpRequestId, setEmailOtpRequestId] = useState(null);

  const syncStatus = useCallback(async () => {
    if (!isAuthenticated || !sessionToken) {
      setCompletedFields([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await checkUserCompliance(sessionToken);
      if (result.success) {
        setCompletedFields(Array.isArray(result.completedFields) ? result.completedFields : []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, sessionToken]);

  useEffect(() => {
    if (isFocused) {
      syncStatus();
    }
  }, [isFocused, syncStatus]);

  const handleTodoPress = (item) => {
    if (item.sheetRef === 'pin' || item.sheetRef === 'email') {
      setActiveSheet(item.sheetRef);
      return;
    }

    if (item.sheetRef === 'kyc') {
      navigation.navigate('kycScreen');
    }
  };

  const handleModalClose = () => {
    setActiveSheet(null);
    syncStatus();
  };

  if (!isAuthenticated) {
    return null;
  }

  const incompleteItems = TODO_STEPS
    .filter((item) => !completedFields.includes(item.id))
    .map((item) => ({ ...item, status: 'go' }));
  const visibleItems = isExpanded ? incompleteItems : incompleteItems.slice(0, 2);

  if (!isLoading && incompleteItems.length === 0) {
    return null;
  }

  return (
    <>
      <UnifiedServiceSection
        title="Your to-do list"
        items={visibleItems}
        rowMode="button"
        marginVertical={0}
        isLoading={isLoading}
        onItemPress={handleTodoPress}
        onHeaderAction={incompleteItems.length > 2 ? () => setIsExpanded((expanded) => !expanded) : undefined}
        headerActionLabel={isExpanded ? 'Show less' : 'View all'}
      />

      <Modal transparent visible={!!activeSheet} animationType="slide" onRequestClose={handleModalClose}>
        <TouchableWithoutFeedback onPress={handleModalClose}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' }} />
        </TouchableWithoutFeedback>
        {activeSheet === 'pin' && <PinSetup visible onClose={handleModalClose} />}
        {activeSheet === 'email' && (
          <EmailOtp
            visible
            purpose="emailVerification"
            requestId={emailOtpRequestId}
            onRequestIdChange={setEmailOtpRequestId}
            onClose={handleModalClose}
            onVerified={() => {
              setEmailOtpRequestId(null);
              handleModalClose();
            }}
          />
        )}
      </Modal>
    </>
  );
};

export default ProfileTodoSection;