import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BRAND_COLOR = '#0E3C2E';
const CONTACT_ICON = 'https://cdn-icons-png.flaticon.com/128/46/46646.png';

const ProviderInputCard = ({
  label,
  imageUri,
  onProviderPress,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  maxLength,
  isDark = false,
  isContact = false,
  onContactPress,
  isButton = false,
  onButtonPress,
  buttonDisabled = false,
  buttonText = 'Verify',
}) => {
  const showContact = isContact && !isButton;
  const showButton = isButton && !isContact;

  return (
    <View style={[styles.card, isDark && styles.darkCard]}>
    <View style={styles.labelRow}>
      <Text style={[styles.cardLabel, isDark && styles.darkSecondaryText]}>{label}</Text>
    </View>

    <View style={styles.inputRow}>
      <TouchableOpacity style={styles.providerSelector} onPress={onProviderPress}>
        <View style={[styles.logoWrapper, isDark && styles.darkLogoWrapper]}>
          <Image source={{ uri: imageUri }} style={styles.providerLogo} />
        </View>
        <Ionicons name="chevron-down" size={14} color="#666" style={styles.dropIcon} />
      </TouchableOpacity>

      <View style={[styles.divider, isDark && styles.darkDivider]} />

      <TextInput
        style={[styles.input, isDark && styles.darkInput]}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#6F6F6F' : '#A0A0A0'}
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
      />

      {showContact && (
        <TouchableOpacity style={[styles.contactButton, isDark && styles.darkContactButton]} onPress={onContactPress}>
          <Image source={{ uri: CONTACT_ICON }} style={[styles.contactIcon, isDark && styles.darkIcon]} />
        </TouchableOpacity>
      )}

      {showButton && (
        <TouchableOpacity onPress={onButtonPress} style={styles.verifyButton} disabled={buttonDisabled}>
          <Text style={styles.verifyButtonText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
    </View>
  );
};

export default React.memo(ProviderInputCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    marginTop: 10,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  darkCard: { backgroundColor: '#1E1E1E', borderWidth: 0 },
  labelRow: { marginBottom: 12 },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  darkSecondaryText: { color: '#B0B0B0' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  providerSelector: { flexDirection: 'row', alignItems: 'center', paddingRight: 5 },
  logoWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  darkLogoWrapper: { backgroundColor: '#242424', borderColor: '#2E2E2E' },
  providerLogo: { width: 36, height: 36, borderRadius: 18, resizeMode: 'contain' },
  dropIcon: { marginLeft: 4 },
  divider: { width: 1, height: 15, backgroundColor: '#E0E0E0', marginHorizontal: 5 },
  darkDivider: { backgroundColor: '#2E2E2E' },
  input: { flex: 1, fontSize: 16, fontWeight: '700', color: BRAND_COLOR, paddingVertical: 5 },
  darkInput: { color: '#E4E4E4' },
  contactButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F7F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  darkContactButton: { backgroundColor: '#242424' },
  contactIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: BRAND_COLOR },
  darkIcon: { tintColor: '#E4E4E4' },
  verifyButton: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 12,
    height: 35.2,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    marginLeft: 10,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  verifyButtonText: { color: '#FFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});