import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Pressable,
  Easing,
  Keyboard,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SwipeTrack from '../../transactions/review/utilities/SwipeTrack';

const brandColor = '#0E3C2E';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const keyboardBottomPadding = Platform.OS === 'ios' ? (screenHeight > 750 ? 40 : 25) : 20;
const keyboardBottomOffset = Platform.OS === 'ios' ? 18 : 8;
const operationKeys = [
  { key: 'divide', icon: 'division', symbol: '/' },
  { key: 'multiply', icon: 'multiplication', symbol: '*' },
  { key: 'subtract', icon: 'minus', symbol: '-' },
  { key: 'add', icon: 'plus', symbol: '+' },
];

const operatorPattern = /[+\-*/]/;
const amountCurrencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const calculateExpression = (expression) => {
  const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.join('') !== expression || operatorPattern.test(tokens[0]) || operatorPattern.test(tokens[tokens.length - 1])) {
    return null;
  }

  const values = [];
  const operators = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };

  const applyOperator = () => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (operator === '/' && right === 0) return false;
    values.push(operator === '+' ? left + right : operator === '-' ? left - right : operator === '*' ? left * right : left / right);
    return true;
  };

  tokens.forEach((token) => {
    if (operatorPattern.test(token)) {
      while (operators.length && precedence[operators[operators.length - 1]] >= precedence[token]) {
        applyOperator();
      }
      operators.push(token);
    } else {
      values.push(Number(token));
    }
  });

  while (operators.length) {
    if (!applyOperator()) return null;
  }

  return Number.isFinite(values[0]) ? values[0] : null;
};

const formatAmount = (value) => String(Number(value.toFixed(2)));

const formatDisplayAmount = (value) => {
  if (!value) return '';

  const [integerPart, decimalPart] = String(value).split('.');
  const formattedInteger = amountCurrencyFormatter.format(Number(integerPart || 0));
  return decimalPart === undefined ? formattedInteger : `${formattedInteger}.${decimalPart}`;
};

const formatExpression = (expression) => expression.replaceAll('*', '×').replaceAll('/', '÷');

const InlineNumberKeyboard = ({ onKeyPress, onNext, isNextDisabled }) => {
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  const keys = [
    ['1', '2', '3', operationKeys[0]],
    ['4', '5', '6', operationKeys[1]],
    ['7', '8', '9', operationKeys[2]],
    ['.', '0', 'delete', operationKeys[3]],
  ];

  return (
    <View style={styles.numberKeyboard}>
      <View style={styles.numberKeyboardInner}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.numberKeyboardRow}>
            {row.map((value) => (
              <TouchableOpacity
                key={typeof value === 'string' ? value : value.key}
                style={[styles.numberKey, typeof value !== 'string' && styles.operationKey]}
                onPress={() => onKeyPress(value)}
                activeOpacity={0.4}
              >
                {typeof value !== 'string' ? (
                  <MaterialCommunityIcons name={value.icon} size={20} color={brandColor} />
                ) : value === 'delete' ? (
                  <Ionicons name="backspace-outline" size={24} color="#1A2F28" />
                ) : (
                  <Text style={styles.numberKeyText}>{value}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.keyboardFooter}>
          <SwipeTrack
            onConfirm={() => {
              setSwipeResetKey((previousKey) => previousKey + 1);
              onNext();
            }}
            disabled={isNextDisabled}
            resetTrigger={swipeResetKey}
          />
        </View>
      </View>
    </View>
  );
};

const TransferDetails02 = ({
  recipientInfo,
  selectedBank,
  accountNumber,
  amount,
  setAmount,
  setCurrentPage,
  processing,
  handleProceed,
}) => {
  const isCustomKeyboardVisible = true;
  const [isSystemKeyboardVisible, setIsSystemKeyboardVisible] = useState(false);
  const [operationExpression, setOperationExpression] = useState('');
  const scrollRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const cursorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsSystemKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsSystemKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isCustomKeyboardVisible ? 0 : 500,
      duration: 300,
      easing: Easing.bezier(0.33, 1, 0.68, 1),
      useNativeDriver: true,
    }).start();

    if (isCustomKeyboardVisible) {
      setTimeout(() => scrollRef.current?.scrollTo({ y: 120, animated: true }), 100);
    }
  }, [isCustomKeyboardVisible, slideAnim]);

  useEffect(() => {
    let animation;
    if (isCustomKeyboardVisible) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(cursorOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      );
      animation.start();
    } else {
      cursorOpacity.setValue(0);
    }
    return () => animation?.stop();
  }, [isCustomKeyboardVisible, cursorOpacity]);

  const closeAllKeyboards = () => {
    Keyboard.dismiss();
  };

  const onFinalSubmit = () => {
    closeAllKeyboards();
    handleProceed();
  };

  const isIncompleteExpression = Boolean(operationExpression && operatorPattern.test(operationExpression.slice(-1)));
  const isButtonDisabled = !amount || parseFloat(amount) <= 0 || processing || isIncompleteExpression;
  const recipientProfilePictureUrl = recipientInfo?.profilePictureUrl || recipientInfo?.avatarUrl;
  const selectedBankName = selectedBank?.bankName || '';

  const updateExpression = (nextExpression) => {
    setOperationExpression(nextExpression);
    const total = calculateExpression(nextExpression);
    if (total !== null) setAmount(formatAmount(total));
  };

  const handleKeyPress = (key) => {
    if (typeof key !== 'string') {
      const expression = operationExpression || amount;
      if (!expression || parseFloat(amount) <= 0) return;
      const nextExpression = operatorPattern.test(expression.slice(-1))
        ? `${expression.slice(0, -1)}${key.symbol}`
        : `${expression}${key.symbol}`;
      setOperationExpression(nextExpression);
      return;
    }

    if (key === 'delete') {
      if (!operationExpression) {
        setAmount((previousAmount) => previousAmount.slice(0, -1));
        return;
      }

      const nextExpression = operationExpression.slice(0, -1);
      if (!operatorPattern.test(nextExpression)) {
        setOperationExpression('');
        setAmount(nextExpression);
      } else {
        updateExpression(nextExpression);
      }
      return;
    }

    if (operationExpression) {
      const currentNumber = operationExpression.split(operatorPattern).pop();
      if (key === '.' && currentNumber.includes('.')) return;
      const nextExpression = `${operationExpression}${key === '.' && !currentNumber ? '0.' : key}`;
      updateExpression(nextExpression);
      return;
    }

    if (key === '.') {
      if (!amount.includes('.')) setAmount((previousAmount) => (previousAmount === '' ? '0.' : `${previousAmount}.`));
    } else {
      setAmount((previousAmount) => (previousAmount === '0' ? key : `${previousAmount}${key}`));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: isCustomKeyboardVisible ? 400 : 150 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => Keyboard.dismiss()}
        >
          <View style={{ marginTop: 10 }}>
            <View style={styles.customerCard}>
              <View style={styles.customerCardIcon}>
                {recipientProfilePictureUrl ? (
                  <Image source={{ uri: recipientProfilePictureUrl }} style={styles.recipientAvatar} />
                ) : (
                  <Ionicons name="person-circle" size={20} color={brandColor} />
                )}
              </View>
              <View style={styles.customerCardContent}>
                <Text style={styles.customerLabel}>Beneficiary</Text>
                <Text style={styles.customerName}>{recipientInfo?.name}</Text>
                <Text style={styles.customerAddress}>{`${selectedBankName} • ${accountNumber}`}</Text>
              </View>
              <TouchableOpacity onPress={() => setCurrentPage(1)}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountContainerMain}>
              <Pressable
                style={[styles.amountContainer, isCustomKeyboardVisible && styles.amountContainerActive]}
                onPress={() => {
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.label}>Enter Amount</Text>
                {operationExpression && (
                  <View style={styles.operationBadge}>
                    <Text style={styles.operationBadgeText}>{formatExpression(operationExpression)}</Text>
                  </View>
                )}
                <View style={styles.inputRow}>
                  <View style={styles.textCursorWrapper}>
                    <Text style={[styles.mainAmountInput, { color: amount ? '#111' : '#D1DCD9' }]}>
                      {formatDisplayAmount(amount) || amountCurrencyFormatter.format(0)}
                    </Text>
                    {isCustomKeyboardVisible && <Animated.View style={[styles.cursor, { opacity: cursorOpacity }]} />}
                  </View>
                </View>
              </Pressable>
            </View>

            {!isCustomKeyboardVisible && !isSystemKeyboardVisible && (
              <TouchableOpacity
                style={[styles.mainButton, isButtonDisabled && styles.disabledButton]}
                onPress={onFinalSubmit}
                disabled={isButtonDisabled}
              >
                <Text style={styles.mainButtonText}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>
      </ScrollView>

      <Animated.View style={[styles.keyboardWrapper, { transform: [{ translateY: slideAnim }], bottom: keyboardBottomOffset }]}>
        <InlineNumberKeyboard
          onKeyPress={handleKeyPress}
          onNext={onFinalSubmit}
          isNextDisabled={isButtonDisabled}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  amountContainerMain: { gap: 12, marginTop: 4 },
  amountContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E7EBEA' },
  amountContainerActive: { borderColor: brandColor, borderWidth: 1.5 },
  customerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 25 },
  customerCardIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  recipientAvatar: { width: 45, height: 45, borderRadius: 22.5 },
  customerCardContent: { flex: 1, marginLeft: 15 },
  customerLabel: { fontSize: 11, color: '#64748B' },
  customerName: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  customerAddress: { fontSize: 12, color: '#94A3B8' },
  editText: { color: brandColor, fontSize: 12, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6 },
  nairaLarge: { fontSize: 32, fontWeight: '700', color: '#1E293B', marginRight: 6 },
  mainAmountInput: { fontSize: 32, fontWeight: '700', color: '#1E293B' },
  operationBadge: { alignSelf: 'center', backgroundColor: '#EAF5EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2, marginBottom: 4 },
  operationBadgeText: { fontSize: 14, fontWeight: '600', color: brandColor },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  textCursorWrapper: { position: 'relative' },
  cursor: { position: 'absolute', left: '100%', top: 4, width: 2, height: 25, backgroundColor: brandColor, marginLeft: 3 },
  mainButton: { backgroundColor: brandColor, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 30, alignSelf: 'stretch', minHeight: 48 },
  disabledButton: { opacity: 0.5 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  keyboardWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -15 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    zIndex: 1000,
    paddingBottom: 10,
  },
  numberKeyboard: { position: 'absolute', bottom: 0, width: screenWidth, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 0.5, borderColor: '#E2E9E7', paddingBottom: keyboardBottomPadding + 12 },
  numberKeyboardInner: { paddingVertical: 14, paddingHorizontal: 20, width: '100%' },
  numberKeyboardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 3 },
  numberKey: { width: screenWidth / 4.5, height: 45, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F8F7', borderRadius: 10, borderWidth: 1, borderColor: '#E2E9E7' },
  numberKeyText: { fontSize: 18, fontWeight: '600', color: '#1A2F28' },
  operationKey: { width: screenWidth / 7, height: 45, marginLeft: 8, backgroundColor: '#EAF5EE', borderColor: '#C9DED3' },
  keyboardFooter: { marginTop: 10},
  keyboardNextButton: { backgroundColor: '#1B4D3E', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  keyboardNextButtonDisabled: { backgroundColor: '#D1DCD9' },
  keyboardNextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default TransferDetails02;
