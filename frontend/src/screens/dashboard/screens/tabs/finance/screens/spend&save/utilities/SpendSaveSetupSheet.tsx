import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@providers/ThemeProvider';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';

const endpoint = `${apiConfig.baseUrl}/v1/banking/savings/spend&save/index.php`;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const isEnabledValue = (value) => value === true || value === '1' || value === 1;
const percentagePresets = ['5', '10', '15', '20'];
const fixedAmountPresets = ['500', '1000', '2500', '5000'];

const SpendSaveSetupSheet = ({ visible, onClose, onSaved, onRequirePin }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottomInset = Math.max(insets.bottom, 0);
  const [mode, setMode] = useState('percentage');
  const [percentage, setPercentage] = useState('5');
  const [fixedAmount, setFixedAmount] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [hasConfiguration, setHasConfiguration] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const keyboardTranslate = useRef(new Animated.Value(0)).current;
  const sheetTranslate = Animated.add(slideAnim, keyboardTranslate);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardHeight = Math.max(event.endCoordinates?.height || 0, 0);
      Animated.timing(keyboardTranslate, {
        toValue: Platform.OS === 'ios' ? -keyboardHeight : -(keyboardHeight - safeBottomInset),
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });

    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardTranslate, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardTranslate, safeBottomInset]);

  useEffect(() => {
    let cancelled = false;

    const loadConfiguration = async () => {
      setError(null);
      try {
        const sessionToken = await getSessionToken();
        const url = `${endpoint}?${new URLSearchParams({ [config.sessionToken]: sessionToken || '' })}`;
        const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.success !== true) {
          throw new Error(result?.message || 'Unable to load configuration');
        }

        const data = result.data;
        const initialMode = Number(data?.fixedSaveAmount || 0) > 0 ? 'fixed' : 'percentage';
        const initialPercentage = Number(data?.savePercentage || 0) > 0 ? String(data.savePercentage) : '5';
        const initialFixedAmount = Number(data?.fixedSaveAmount || 0) > 0 ? String(data.fixedSaveAmount) : '';
        const initialEnabled = data ? isEnabledValue(data.isEnabled) : true;

        if (!cancelled) {
          setHasConfiguration(Boolean(data));
          setEnabled(initialEnabled);
          setInitialValues({
            mode: initialMode,
            percentage: initialPercentage,
            fixedAmount: initialFixedAmount,
            enabled: initialEnabled,
          });
          if (initialMode === 'percentage') {
            setMode('percentage');
            setPercentage(initialPercentage);
            setFixedAmount('');
          } else {
            setMode('fixed');
            setFixedAmount(initialFixedAmount);
            setPercentage('');
          }
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError?.message || 'Unable to load configuration');
      } finally {
        if (!cancelled) {
          setSheetVisible(true);
          slideAnim.setValue(SCREEN_HEIGHT);
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 20,
            mass: 0.8,
            stiffness: 140,
            restSpeedThreshold: 0.01,
            restDisplacementThreshold: 0.01,
            useNativeDriver: true,
          }).start();
        }
      }
    };

    if (visible) {
      loadConfiguration();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setSheetVisible(false));
    }

    return () => {
      cancelled = true;
    };
  }, [slideAnim, visible]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSheetVisible(false);
      onClose?.();
    });
  };

  const submitConfiguration = async () => {
    const numericValue = Number(mode === 'percentage' ? percentage : fixedAmount);
    if (enabled && (!Number.isFinite(numericValue) || numericValue < 0 || (mode === 'percentage' && numericValue > 100))) {
      setError(mode === 'percentage' ? 'Enter a percentage from 0 to 100.' : 'Enter a valid saving amount.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const sessionToken = await getSessionToken();
      const payload = {
        [config.sessionToken]: sessionToken || '',
        isEnabled: enabled,
        ...(enabled && mode === 'percentage'
          ? { savePercentage: numericValue }
          : enabled ? { fixedSaveAmount: numericValue } : {}),
      };
      const response = await fetch(endpoint, {
        method: hasConfiguration ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || 'Unable to save Spend & Save settings');
      }

      onSaved?.(result.data);
      onClose?.();
    } catch (requestError) {
      setError(requestError?.message || 'Unable to save Spend & Save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const hasChanges = initialValues && (
      initialValues.mode !== mode ||
      initialValues.percentage !== percentage ||
      initialValues.fixedAmount !== fixedAmount ||
      initialValues.enabled !== enabled
    );

    if (!hasChanges) {
      handleDismiss();
      return;
    }

    const numericValue = Number(mode === 'percentage' ? percentage : fixedAmount);
    if (enabled && (!Number.isFinite(numericValue) || numericValue < 0 || (mode === 'percentage' && numericValue > 100))) {
      setError(mode === 'percentage' ? 'Enter a percentage from 0 to 100.' : 'Enter a valid saving amount.');
      return;
    }

    onRequirePin?.(submitConfiguration);
  };

  return (
    <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.modalRoot}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleDismiss} />
        <Animated.View style={[styles.sheet, { backgroundColor: isDark ? colors.surface : colors.card, transform: [{ translateY: sheetTranslate }] }]}> 
          <View style={styles.header}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>SPEND & SAVE</Text>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Set up your saving rule</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton} accessibilityLabel="Close setup">
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <>
              <View style={[styles.modeRow, !enabled && styles.disabledControls]}>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'percentage' && { backgroundColor: colors.accent }]}
                  onPress={() => setMode('percentage')}
                  disabled={!enabled}
                >
                  <Text style={[styles.modeText, { color: mode === 'percentage' ? '#fff' : colors.textPrimary }]}>Percentage</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, mode === 'fixed' && { backgroundColor: colors.accent }]}
                  onPress={() => setMode('fixed')}
                  disabled={!enabled}
                >
                  <Text style={[styles.modeText, { color: mode === 'fixed' ? '#fff' : colors.textPrimary }]}>Fixed amount</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }, !enabled && styles.disabledControls]}>Amount to save</Text>
              <View style={[styles.inputRow, { borderColor: colors.border || '#D7E3DE' }, !enabled && styles.disabledControls]}>
                <Text style={[styles.prefix, { color: colors.textPrimary }]}>{mode === 'percentage' ? '%' : '₦'}</Text>
                <TextInput
                  value={mode === 'percentage' ? percentage : fixedAmount}
                  onChangeText={mode === 'percentage' ? setPercentage : setFixedAmount}
                  keyboardType="decimal-pad"
                  placeholder={mode === 'percentage' ? '5' : '500'}
                  placeholderTextColor={colors.textDisabled}
                  style={[styles.input, { color: colors.textPrimary }]}
                  editable={enabled}
                />
              </View>
              <View style={[styles.presetRow, !enabled && styles.disabledControls]}>
                {(mode === 'percentage' ? percentagePresets : fixedAmountPresets).map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetButton, { borderColor: colors.accent }]}
                    onPress={() => mode === 'percentage' ? setPercentage(preset) : setFixedAmount(preset)}
                    disabled={!enabled}
                  >
                    <Text style={[styles.presetText, { color: colors.accent }]}> 
                      {mode === 'percentage' ? `${preset}%` : `₦${Number(preset).toLocaleString()}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.enabledRow} onPress={() => setEnabled((value) => !value)}>
                <View style={[styles.checkbox, { borderColor: enabled ? colors.accent : colors.textDisabled, backgroundColor: enabled ? colors.accent : 'transparent' }]}>
                  {enabled && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.enabledText, { color: colors.textPrimary }]}>Enable Spend & Save</Text>
              </TouchableOpacity>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.accent }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save settings</Text>}
              </TouchableOpacity>
          </>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { marginTop: 5, fontSize: 19, fontWeight: '800' },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  loader: { marginVertical: 50 },
  modeRow: { flexDirection: 'row', marginTop: 24, gap: 8 },
  modeButton: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#D7E3DE', paddingVertical: 12, alignItems: 'center' },
  modeText: { fontSize: 12, fontWeight: '700' },
  disabledControls: { opacity: 0.45 },
  label: { marginTop: 22, marginBottom: 8, fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, minHeight: 50, paddingHorizontal: 14 },
  prefix: { fontSize: 18, fontWeight: '700', marginRight: 8 },
  input: { flex: 1, fontSize: 18, fontWeight: '700', paddingVertical: 8 },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  presetButton: { flex: 1, minHeight: 36, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  presetText: { fontSize: 11, fontWeight: '800' },
  enabledRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  checkbox: { width: 21, height: 21, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  enabledText: { fontSize: 13, fontWeight: '600' },
  errorText: { marginTop: 14, color: '#B42318', fontSize: 11 },
  saveButton: { minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  disableButton: { alignItems: 'center', paddingVertical: 14 },
  disableText: { fontSize: 12, fontWeight: '700' },
});

export default SpendSaveSetupSheet;
