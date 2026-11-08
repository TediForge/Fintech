import { Alert } from '@components/common/Alert';
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import config from '@config/app';
import { apiConfig } from '@config/api';
import { getSessionToken } from '@hooks/useAuth';
import CreditTransactionReviewScreen from '../../../transactions/review/CreditTransactionReviewScreen';

const { width } = Dimensions.get('window');
const scale = width / 410;
const BRAND_DARK = "#0E3C2E";
const TEXT_MUTED = "#64748B";

const SellGiftCardDetails = ({ brand, country, getCurrencySymbol }) => {
  const navigation = useNavigation();
  const [amount, setAmount] = useState('');
  const [selectedDenom, setSelectedDenom] = useState(null);
  const [cardCode, setCardCode] = useState('');
  const [images, setImages] = useState([]); // Array to store image URIs
  const [receiptImages, setReceiptImages] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFixed = String(country?.denominationType || '').toLowerCase() === 'fixed';
  const activeAmount = isFixed ? selectedDenom : parseFloat(amount) || 0;
  const hasFixedDenoms = isFixed && country?.denominations?.length > 0;
  const requiresCardUpload = country?.requiresUpload === true && Number(country?.maxImageUpload || 0) > 0;
  const requiresReceipt = country?.receiptRequired === true;

  const payout = useMemo(() => {
    return activeAmount * (country?.rate || 0);
  }, [activeAmount, country]);

  const currencyCode = country?.currencyCode || country?.currency || 'USD';
  const currencySymbol = useMemo(() => {
    if (getCurrencySymbol) {
      return getCurrencySymbol(currencyCode);
    }
    return "$";
  }, [currencyCode, getCurrencySymbol]);

  const handleImagePicker = useCallback(async (type = 'card') => {
    const isReceipt = type === 'receipt';
    const imageList = isReceipt ? receiptImages : images;
    const uploadLimit = isReceipt ? 1 : Number(country?.maxImageUpload || 0);

    if (imageList.length >= uploadLimit) {
      Alert.sheet("Limit Reached", `You can only upload up to ${uploadLimit} image${uploadLimit === 1 ? '' : 's'} for this ${isReceipt ? 'receipt' : 'card'}.`);
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.sheet("Permission Denied", "Gallery access is required to select images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });

      const selectedUri = result.assets?.[0]?.uri;
      if (!result.canceled && selectedUri) {
        if (isReceipt) {
          setReceiptImages([selectedUri]);
        } else {
          setImages(prev => [...prev, selectedUri]);
        }
      }
    } catch (error) {
      console.error('[SellGiftCardDetails] image picker error:', error);
      Alert.sheet('Upload Error', 'Unable to open the image picker. Please try again.');
    }
  }, [images, receiptImages, country]);

  const removeImage = (type, index) => {
    if (type === 'receipt') {
      setReceiptImages((currentImages) => currentImages.filter((_, imageIndex) => imageIndex !== index));
      return;
    }

    setImages((currentImages) => currentImages.filter((_, imageIndex) => imageIndex !== index));
  };

  const amountValidationMessage = useMemo(() => {
    if (isFixed) return null;
    const minimumAmount = Number(country?.minimumAmount || 0);
    const maximumAmount = Number(country?.maximumAmount || Infinity);
    const enteredAmount = Number(amount);

    if (!amount.trim()) return null;
    if (!Number.isFinite(enteredAmount)) return 'Enter a valid amount';
    if (enteredAmount < minimumAmount) {
      return `Minimum amount is ${currencyCode} ${minimumAmount.toLocaleString()}`;
    }
    if (enteredAmount > maximumAmount) {
      return `Maximum amount is ${currencyCode} ${maximumAmount.toLocaleString()}`;
    }
    return null;
  }, [amount, country, isFixed, currencyCode]);

  const isProceedDisabled = useMemo(() => {
    const minimumAmount = Number(country?.minimumAmount || 0);
    const maximumAmount = Number(country?.maximumAmount || Infinity);
    const enteredAmount = Number(amount);

    const validAmount = isFixed
      ? selectedDenom !== null && Number.isFinite(selectedDenom) && selectedDenom >= minimumAmount && selectedDenom <= maximumAmount
      : Number.isFinite(enteredAmount) && enteredAmount >= minimumAmount && enteredAmount <= maximumAmount;

    const hasCardProof = cardCode.trim().length > 0 || images.length > 0;
    const hasReceiptProof = !requiresReceipt || receiptImages.length > 0;
    return !validAmount || !hasCardProof || !hasReceiptProof;
  }, [isFixed, selectedDenom, amount, country, cardCode, images, receiptImages, requiresReceipt]);

  const formatCurrencyValue = (value, fallback = '0') => {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) return fallback;
    return numericValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const cardTypeLabel = useMemo(() => {
    const normalized = String(country?.cardType || '').toLowerCase();
    if (normalized === 'ecode') return 'E-Code';
    if (normalized === 'physical') return 'Physical';
    return normalized ? normalized.replace(/_/g, ' ') : 'Card';
  }, [country?.cardType]);

  const reviewData = useMemo(() => {
    const rows = [
      { label: 'Brand', value: brand?.brand || 'Gift Card', icon: brand?.image },
      { label: 'Country', value: country?.country || 'Unknown' },
      { label: 'Card Type', value: cardTypeLabel },
      { label: 'Amount', value: `${currencyCode} ${formatCurrencyValue(activeAmount)}` },
    ];

    rows.push({
      label: 'Exchange Rate',
      value: `₦${Number(country?.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} / ${currencyCode}`,
    });

    return {
      payoutAmount: payout,
      confirmLabel: 'Swipe to Submit',
      finishLabel: 'Release to Submit',
      summaryRows: rows,
    };
  }, [activeAmount, brand, cardTypeLabel, country, currencyCode, currencySymbol, payout]);

  const handleContinue = () => {
    if (isProceedDisabled) {
      Alert.sheet('Incomplete Details', 'Please enter a valid amount and card details before continuing.');
      return;
    }
    setShowReview(true);
  };

  const handleSubmit = async () => {
    if (isSubmitting || isProceedDisabled) return;

    setIsSubmitting(true);
    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Your session has expired. Please log in again.');
      if (!country?.countryId) throw new Error('The selected gift-card country is unavailable. Please go back and select it again.');

      const formData = new FormData();
      formData.append('action', 'submit');
      formData.append(config.sessionToken, sessionToken);
      formData.append('countryId', String(country?.countryId || ''));
      formData.append('faceValue', String(activeAmount));
      if (cardCode.trim()) formData.append('eCodeString', cardCode.trim());

      const appendImage = (field, uri, index) => {
        const extension = uri.split('.').pop()?.toLowerCase();
        const type = extension === 'png' ? 'image/png' : 'image/jpeg';
        formData.append(field, {
          uri,
          type,
          name: `${field.replace(/\[\]/g, '')}-${Date.now()}-${index}.${extension === 'png' ? 'png' : 'jpg'}`,
        });
      };

      images.forEach((uri, index) => appendImage('imagePaths[]', uri, index));
      receiptImages.forEach((uri, index) => appendImage('receiptPaths[]', uri, index));

      const response = await fetch(`${apiConfig.baseUrl}/v1/banking/giftCards/sell/initialization/`, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      const responseText = await response.text();
      let result = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        result = {};
      }

      const isSuccessful = result.success === true || result.status === 'success';
      if (!response.ok || !isSuccessful) {
        console.error('[SellGiftCardDetails] submission failed', {
          status: response.status,
          response: result,
        });
        throw new Error(result.message || result.error || `Unable to submit the gift-card request (HTTP ${response.status}).`);
      }

      const reference = result.data?.reference;
      if (!reference) throw new Error('The request was submitted without a reference.');

      setShowReview(false);
      navigation.navigate('CreditTransactionResultScreen', {
        reference,
        transaction: reviewData,
      });
    } catch (error) {
      Alert.sheet('Submission Error', error.message || 'Unable to submit the gift-card request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FlatList
        style={styles.container}
        data={[{ id: 'details-form' }]}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        decelerationRate="normal"
        contentContainerStyle={styles.scrollContent}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        scrollEventThrottle={16}
        renderItem={() => (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.brandRow}>
                <View style={styles.logoContainer}>
                  <Image source={{ uri: brand?.image }} style={styles.brandLogo} />
                </View>
                <View style={styles.brandInfo}>
                  <Text style={styles.brandName}>{brand?.brand}</Text>
                  <Text style={styles.typeName}>{cardTypeLabel} Card</Text>
                </View>
              </View>

              <View style={styles.countryRow}>
                <View style={styles.flagContainer}>
                  <Image source={{ uri: country?.flagUrl }} style={styles.flag} />
                </View>
                <View style={styles.countryInfo}>
                  <Text style={styles.countryName}>{country?.country}</Text>
                  <Text style={styles.rateInfo}>Exchange Rate: ₦{Number(country?.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} / {currencyCode}</Text>
                </View>
              </View>
            </View>

            {/* Amount Selection / Input */}
            {hasFixedDenoms ? (
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Select Denomination ({currencyCode})</Text>
                <View style={styles.denomGrid}>
                  {country.denominations.map((denom) => (
                    <TouchableOpacity 
                      key={denom}
                      style={[styles.denomTile, selectedDenom === denom && styles.activeDenomTile]}
                      onPress={() => setSelectedDenom(denom)}
                    >
                      <Text style={[styles.denomText, selectedDenom === denom && styles.activeDenomText]}>
                        {currencyCode} {denom.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Enter Amount ({currencyCode})</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
                <View style={styles.limitRow}>
                  <Text style={styles.limitText}>
                    Min: {currencyCode} {country?.minimumAmount} • Max: {currencyCode} {country?.maximumAmount}
                  </Text>
                </View>
                {amountValidationMessage ? (
                  <View style={styles.validationRow}>
                    <Text style={styles.validationText}>{amountValidationMessage}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Assets Upload / Code Section */}
            <View style={styles.assetsCard}>
              <Text style={styles.inputLabel}>Card Details</Text>
              
              <View style={styles.codeWrapper}>
                <Ionicons name="keypad-outline" size={20} color={BRAND_DARK} style={styles.inputIcon} />
                <TextInput 
                  style={styles.codeField}
                  placeholder="Type Card Code / PIN here"
                  value={cardCode}
                  onChangeText={setCardCode}
                  autoCapitalize="characters"
                />
              </View>

              {requiresCardUpload && (
                <>
                  <Text style={styles.uploadHint}>Upload card images (Max {country.maxImageUpload})</Text>
                  <View style={styles.imageGrid}>
                    {images.map((uri, index) => (
                      <View key={index} style={styles.imagePreviewWrapper}>
                        <Image source={{ uri }} style={styles.previewImage} />
                        <TouchableOpacity
                          style={styles.removeImageBtn}
                          onPress={() => removeImage('card', index)}
                        >
                          <Ionicons name="close-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {images.length < Number(country.maxImageUpload) && (
                      <TouchableOpacity style={styles.uploadBtn} onPress={() => handleImagePicker('card')}>
                        <Ionicons name="camera-outline" size={28} color={TEXT_MUTED} />
                        <Text style={styles.uploadBtnText}>Add Card Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {requiresReceipt && (
                <>
                  <Text style={[styles.uploadHint, styles.receiptHint]}>Upload receipt</Text>
                  <View style={styles.imageGrid}>
                    {receiptImages.map((uri, index) => (
                      <View key={index} style={styles.imagePreviewWrapper}>
                        <Image source={{ uri }} style={styles.previewImage} />
                        <TouchableOpacity
                          style={styles.removeImageBtn}
                          onPress={() => removeImage('receipt', index)}
                        >
                          <Ionicons name="close-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {receiptImages.length === 0 && (
                      <TouchableOpacity style={styles.uploadBtn} onPress={() => handleImagePicker('receipt')}>
                        <Ionicons name="receipt-outline" size={28} color={TEXT_MUTED} />
                        <Text style={styles.uploadBtnText}>Add Receipt</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>

            {/* Payout Display */}
            <View style={styles.payoutCard}>
                <Text style={styles.payoutLabel}>You Receive</Text>
                <Text style={styles.payoutValue}>₦{Number(payout || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>

            {/* Action Button */}
            <TouchableOpacity 
              style={[
                styles.proceedBtn, 
                isProceedDisabled && styles.disabledBtn
              ]}
              activeOpacity={0.8}
              disabled={isProceedDisabled}
              onPress={handleContinue}
            >
              <Text style={styles.proceedBtnText}>Continue to Sell</Text>
            </TouchableOpacity>
          </>
        )}
      />

      <CreditTransactionReviewScreen
        visible={showReview}
        submitting={isSubmitting}
        data={reviewData}
        onClose={() => setShowReview(false)}
        onConfirm={handleSubmit}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 50, paddingTop: 20, paddingHorizontal: 16 },
  summaryCard: { backgroundColor: '#FFF', borderRadius: 20 * scale, padding: 20 * scale, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', paddingBottom: 15 },
  logoContainer: { width: 50 * scale, height: 50 * scale, borderRadius: 12 * scale, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  brandLogo: { width: 34 * scale, height: 34 * scale, resizeMode: 'contain' },
  brandInfo: { marginLeft: 15 * scale },
  brandName: { fontSize: 16 * scale, fontWeight: '800', color: BRAND_DARK },
  typeName: { fontSize: 12 * scale, color: TEXT_MUTED, marginTop: 2 },
  countryRow: { flexDirection: 'row', alignItems: 'center' },
  flagContainer: { width: 34 * scale, height: 34 * scale, borderRadius: 17 * scale, overflow: 'hidden' },
  flag: { width: '100%', height: '100%' },
  countryInfo: { marginLeft: 15 * scale },
  countryName: { fontSize: 14 * scale, fontWeight: '700', color: '#1E293B' },
  rateInfo: { fontSize: 11 * scale, color: '#10B981', fontWeight: '600', marginTop: 2 },
  inputCard: { backgroundColor: '#FFF', borderRadius: 20 * scale, padding: 20 * scale, marginBottom: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  inputLabel: { fontSize: 11 * scale, fontWeight: '700', color: TEXT_MUTED, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  denomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 * scale },
  denomTile: { paddingVertical: 12 * scale, paddingHorizontal: 15 * scale, borderRadius: 12 * scale, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#F1F5F9', minWidth: '30%', alignItems: 'center' },
  activeDenomTile: { borderColor: BRAND_DARK, backgroundColor: 'rgba(14, 60, 46, 0.05)' },
  denomText: { fontSize: 14 * scale, fontWeight: '700', color: BRAND_DARK },
  activeDenomText: { color: BRAND_DARK },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: BRAND_DARK, paddingBottom: 5 },
  currencySymbol: { fontSize: 24 * scale, fontWeight: '800', color: BRAND_DARK, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 32 * scale, fontWeight: '900', color: BRAND_DARK, padding: 0 },
  limitRow: { marginTop: 10 },
  limitText: { fontSize: 11 * scale, color: TEXT_MUTED },
  validationRow: { marginTop: 8 },
  validationText: { fontSize: 11 * scale, color: '#D14343', fontWeight: '600' },
  assetsCard: { backgroundColor: '#FFF', borderRadius: 20 * scale, padding: 20 * scale, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  codeWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12 * scale, paddingHorizontal: 12 * scale, height: 50 * scale, marginBottom: 15 },
  inputIcon: { marginRight: 10 },
  codeField: { flex: 1, fontSize: 14 * scale, fontWeight: '600', color: BRAND_DARK },
  uploadHint: { fontSize: 11 * scale, fontWeight: '600', color: TEXT_MUTED, marginBottom: 12 },
  receiptHint: { marginTop: 14 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 * scale },
  imagePreviewWrapper: { width: 80 * scale, height: 80 * scale, borderRadius: 12 * scale, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImageBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: '#FFF', borderRadius: 10 },
  uploadBtn: { width: 80 * scale, height: 80 * scale, borderRadius: 12 * scale, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  uploadBtnText: { fontSize: 10 * scale, fontWeight: '700', color: TEXT_MUTED, marginTop: 4 },
  payoutCard: { backgroundColor: 'rgba(14, 60, 46, 0.05)', borderRadius: 20 * scale, padding: 20 * scale, marginBottom: 25, alignItems: 'center' },
  payoutLabel: { fontSize: 12 * scale, fontWeight: '600', color: TEXT_MUTED, marginBottom: 5 },
  payoutValue: { fontSize: 24 * scale, fontWeight: '900', color: BRAND_DARK },
  proceedBtn: { backgroundColor: BRAND_DARK, height: 56 * scale, borderRadius: 16 * scale, justifyContent: 'center', alignItems: 'center', shadowColor: BRAND_DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  proceedBtnText: { color: '#FFF', fontSize: 16 * scale, fontWeight: '700' },
  disabledBtn: { opacity: 0.5 },
});

export default SellGiftCardDetails;