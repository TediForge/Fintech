import { Alert } from '@components/common/Alert';
import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { View, Text, TextInput, Image, ImageBackground, StatusBar, TouchableOpacity, Keyboard, TouchableWithoutFeedback, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import styles from './ForgotStyles';
import { isValidPhone } from './ForgotActions';
import LoadingScreen from '@components/Loading/LoadingScreen';
import config from '@config/app';
import { apiConfig } from '@config/api';

const ForgotScreen = forwardRef(({ isModal = false }, ref) => {
  const [email, setEmail] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isOpen, setIsOpen] = useState(!isModal);
  const navigation = useNavigation();

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useImperativeHandle(ref, () => ({
    open,
    close,
  }));

  useEffect(() => {
    if (isModal) {
      setIsOpen(false);
    }
  }, [isModal]);

  const handleFocus = () => {
    setIsFocused(true);
    setShowError(false);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!isValidPhone(email)) setShowError(true);
    else setShowError(false);
  };

  const handleContinueEmail = async () => {
    if (!email.trim()) {
      Alert.sheet('Notice', 'Please enter your email');
      return;
    }

    try {
      setLoading(true);
      setLoadingMessage('Validating email...');

      const response = await fetch(`${apiConfig.baseUrl}/v1/auth/reset-request/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      setLoadingMessage('Sending reset link...');
      const data = await response.json();
      setLoading(false);

      if (data.status) {
        Alert.sheet('Sent Sucessfully', data.message || 'Reset Link Sent To Your Email');
        setEmail(''); // clear input
      } else {
        Alert.sheet('Notice', data.message || 'Failed to send reset link');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setLoading(false);
      Alert.sheet('Notice', 'Something went wrong. Please try again.');
    }
  };

  const content = (
    <>
      <StatusBar barStyle="light-content" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ImageBackground
                        source={{ uri: 'https://paysmart.com.ng//assets/brand-logos/adaptive-background.png' }} style={styles.container}>
          {/* Top card */}
          <View style={styles.container2}>
            <View style={styles.container2a}>
              <TouchableOpacity onPress={() => (isModal ? close() : navigation.goBack())}>
                <View style={styles.backbuttonview}>
                  <Image
                    source={{ uri: 'https://cdn-icons-png.flaticon.com/512/318/318276.png' }}
                    style={styles.backicon}
                  />
                  <Text style={styles.backtext}>Back</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.headertextholder}>
                <Text style={styles.smallHeaderText}>You can't remember?</Text>
                <Text style={styles.bigHeaderText}>No Problem!</Text>
              </View>
            </View>
          </View>

          {/* Email input & reset button */}
          <View style={styles.container3}>
            <View style={{ marginTop: 20 }}>
              <View style={styles.topHead}>
  {/* Left Side: Branding Icon Only */}
  <View style={styles.headerSideContainer}>
    <View style={styles.brandIconSmall}>
      <Image 
        source={{ uri: 'https://paysmart.com.ng/assets/brand-logos/icon.png' }} 
        style={styles.logoTiny} 
      />
    </View>
  </View>

  {/* Right Side: Fixed Step Counter (1/1) */}
  <View style={styles.headerSideContainer}>
    <View style={[styles.stepCircle, styles.stepBorder100]}>
      <Text style={styles.stepText}>
        1<Text style={styles.stepTotal}>/1</Text>
      </Text>
    </View>
  </View>
</View>

                {/* Header for Forgot Password - Short Version */}
                <View style={styles.headertextPage2holder}>
                  <Text style={styles.bigPage2HeaderText}>Reset Password</Text>
                  <Text style={styles.smallPage2HeaderText}>
                    We will send you instructions on how to reset your password by email.
                  </Text>
                </View>

              <View
                style={[
                  styles.emailInputWrapper,
                  {
                    borderColor: showError
                      ? '#D9534F'
                      : isFocused
                      ? '#2FB86D'
                      : '#f2f2f2',
                  },
                ]}
              >
                <View style={styles.iconWrapper}>
                  <Image
                    source={{ uri: 'https://cdn-icons-png.flaticon.com/128/16769/16769110.png' }}
                    style={styles.icon}
                  />
                </View>

                <TextInput
                  style={styles.emailInput}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(text) => setEmail(text)}
                  autoCapitalize="none"
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </View>

              {showError && (
                <Text style={styles.errorText}>Please enter a valid email address</Text>
              )}
            </View>

            <View style={styles.loginButtonWrapper}>
              <TouchableOpacity
                style={[
                  styles.loginButton,
                  { opacity: isValidPhone(email) ? 1 : 0.4 },
                ]}
                disabled={!isValidPhone(email)}
                onPress={handleContinueEmail}
              >
                <Text style={styles.loginButtonText}>Reset Password</Text>
              </TouchableOpacity>
              {/* Support Text Section */}
                          <View style={styles.supportContainer}>
                            <Text style={styles.supportText}>Having troubles? Please contact Support at </Text>
                            <TouchableOpacity onPress={() => Alert.sheet('Support', 'Opening email client...')}>
                              <Text style={styles.supportEmail}>support@paysmart.com.ng</Text>
                            </TouchableOpacity>
                          </View>
            </View>
          </View>
        </ImageBackground>
      </TouchableWithoutFeedback>

      <LoadingScreen visible={loading} message={loadingMessage} />
    </>
  );

  if (isModal) {
    return (
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        {content}
      </Modal>
    );
  }

  return content;
});

ForgotScreen.Internal = ForgotScreen;

export default ForgotScreen;
