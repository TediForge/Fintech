import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@providers/ThemeProvider';

const BRAND_COLOR = '#0E3C2E';
const presetAmounts = [100, 200, 500, 1000, 1500, 2000];
const DEFAULT_BANNER = 'https://paysmart.com.ng/assets/images/trybanner3.png';

const AmountSelector = ({
  amount = '',
  setAmount = () => {},
  title = "Top up Airtime",
  showCashback = true,
  cashbackPercent = 1,
  onSubmit,
  data = null,           // Custom items (e.g., bouquets)
  onItemPress = null,    // Override click handler
  selectedId = null,     // Active item tracking
  showManualInput = true,// Toggle numeric input row
  bannerSource = DEFAULT_BANNER,
}) => {
  const items = data || presetAmounts;
  const { isDark } = useTheme();

  return (
    <View style={styles.amountContainerMain}>
      <View style={styles.bannerContainer}>
        <Image 
          source={{ uri: bannerSource }} 
          style={styles.bannerImage} 
        />
      </View>

      <View style={[styles.amountContainer, isDark && { backgroundColor: '#1E1E1E', borderWidth: 0 }]}>
        <Text style={[styles.label, isDark && { color: '#B0B0B0' }]}>{title}</Text>
        <View style={styles.amountGrid}>
          {items.map((item, index) => {
            const val = typeof item === 'object' ? (item.amount || 0) : item;
            const subText = typeof item === 'object' ? item.subText : null;
            const planSize = typeof item === 'object' ? item.planSize : null;
            const itemId = typeof item === 'object' ? (item.id || val) : val;
            const active = selectedId !== null ? (itemId === selectedId) : (amount === val.toString());
            
            // Logic: A badge is present if showCashback is on (and no subText exists) 
            // OR if subText itself is provided.
            const hasBadge = (showCashback && !subText) || !!subText;
            const tileHeight = planSize ? 82 : (hasBadge ? 70 : 50);
            return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              style={[
                styles.amountTile, 
                isDark && { backgroundColor: '#242424' },
                active && (isDark ? { backgroundColor: '#2D2D2D' } : styles.activeAmountTile), 
                { height: tileHeight }
              ]}
              onPress={() => (onItemPress ? onItemPress(item) : onSubmit(val.toString()))}
            >
              {/* LAYER 2: Badge Section (Cashback or Plan Title) */}
              {showCashback && !subText && (
                <View style={styles.cashbackContainer}>
                  <Text style={[styles.cashbackText, isDark && { color: '#4CAF50' }]}>
                    ₦{(val * (cashbackPercent / 100)).toFixed(0)} Cashback
                  </Text>
                </View>
              )}
              {subText && (
                <View style={styles.cashbackContainer}>
                  <Text style={[styles.cashbackText, isDark && { color: '#B0B0B0' }]} numberOfLines={1}>{subText}</Text>
                </View>
              )}

              {/* LAYER 3: Amount Section */}
              <View style={[
                styles.amountSection, 
                isDark && { backgroundColor: '#2D2D2D' },
                active && styles.activeAmountSection,
                hasBadge ? styles.amountSectionWithBadge : styles.amountSectionNoBadge,
                planSize && styles.amountSectionWithPlanSize,
              ]}>
                {planSize && (
                  <Text style={[styles.planSizeText, isDark && { color: '#B0B0B0' }, active && styles.activeAmountText]} numberOfLines={1}>
                    {planSize}
                  </Text>
                )}
                <Text style={[
                  planSize ? styles.amountTextWithPlanSize : styles.amountText,
                  isDark && { color: '#E4E4E4' },
                  active && styles.activeAmountText,
                ]}>
                  <Text style={[styles.nairaTextInner, isDark && { color: '#B0B0B0' }, active && styles.activeAmountText]}>₦</Text>
                  {val.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
            );
          })}
        </View>

        {showManualInput && (
          <View style={styles.utilityPaymentActionRow}>
          <View style={[styles.utilityInputComponent, isDark && { borderBottomColor: '#2E2E2E' }]}>
            <View style={styles.utilityNairaIconBox}>
              <Image 
                source={{ uri: 'https://cdn-icons-png.flaticon.com/128/9382/9382260.png' }} 
                style={styles.utilityNairaVector} 
              />
            </View>
            <TextInput
              style={[styles.utilityNumericInputField, isDark && { color: '#E4E4E4' }]}
              placeholder="0.00"
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              placeholderTextColor={isDark ? "#6F6F6F" : "#999"}
              textAlignVertical="center"
            />
          </View>
          <TouchableOpacity 
            onPress={() => onSubmit()} 
            activeOpacity={0.9}
            style={[styles.utilityCompactPayBtn, isDark && { elevation: 0, shadowOpacity: 0 }]}
          >
            <Text style={styles.utilityCompactPayText}>Pay</Text>
          </TouchableOpacity>
        </View>
        )}
      </View>
    </View>
  );
};

export default React.memo(AmountSelector);

const styles = StyleSheet.create({
  amountContainerMain: {
    zIndex: 1,
    marginVertical: 10,
  },
  bannerContainer: {
    zIndex: 0,
    marginBottom: -25,
    width: '100%',
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  amountContainer: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 16,
    borderWidth: 0.1,
    borderColor: "rgba(204, 204, 204, 0.80)",
    shadowColor: "rgba(204, 204, 204, 0.80)",
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  label: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#666', 
    textTransform: 'uppercase', 
    letterSpacing: 0.3, 
    marginBottom: 15 
  },
  
  // =============================================
  // PRESET AMOUNT TILES STYLES
  // =============================================
  
  // 1. Grid Wrapper
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap', 
    gap: 10 
  },
  
  // 2. Individual Tile (Outer Container)
  amountTile: {
    width: '31%',
    height: 70,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderWidth: 0.0, 
    borderColor: '#F3F4F6',
  },
  activeAmountTile: { backgroundColor: '#E8F2EE' },

  // 3. Inner White Section (Holds the text)
  // Note: Margins here prevent squishing the cashback badge
  amountSection: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 10,   // Perfect concentric curve (16 outer - 5 margin)
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountSectionWithBadge: {
    marginHorizontal: 6,
    marginBottom: 6,
  },
  amountSectionNoBadge: {
    margin: 6, // Uniform margin centers the box perfectly
  },
  activeAmountSection: { 
    borderColor: BRAND_COLOR 
  },

  // 4. Cashback Badge (Top Layer)
  cashbackContainer: {
    width: '100%',
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashbackText: { fontSize: 8, color: '#2FB86D', fontWeight: '800' },

  // 5. Typography
  amountText: { fontSize: 14, fontWeight: '700', color: '#333' },
  amountTextWithPlanSize: { fontSize: 10, fontWeight: '700', color: '#333' },
  amountSectionWithPlanSize: { paddingVertical: 10 },
  planSizeText: { fontSize: 13, fontWeight: '800', color: '#666', marginBottom: 2 },
  activeAmountText: { color: BRAND_COLOR },
  nairaTextInner: { fontSize: 10, fontWeight: '700', color: '#666' },
   
  // =============================================

  utilityPaymentActionRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginTop: 15,
    height: 44
  },
  utilityInputComponent: { 
    flexDirection: 'row', 
    alignItems: 'center',  
    borderBottomWidth: 1.2,
    borderBottomColor: '#E2E8E6',
    borderStyle: 'dashed', 
    width: '72%', 
    height: '80%',
    paddingVertical: 0
  },
  utilityNairaIconBox: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  utilityNairaVector: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    opacity: 0.8
  },
  utilityNumericInputField: { 
    flex: 1, 
    paddingHorizontal: 6, 
    fontSize: 17, 
    color: '#000', 
    fontWeight: '700',
    height: '100%',
    paddingVertical: 0
  },
  utilityCompactPayBtn: {
    backgroundColor: BRAND_COLOR,
    height: '80%',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center', 
    width: '25%',
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  utilityCompactPayText: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: '700' 
  },
});

/**
 * USAGE GUIDE FOR DEVELOPERS:
 * * import AmountSelector from './utilities/AmountSelector';
 * * const MyBillScreen = () => {
 * const [amount, setAmount] = useState('');
 * * const handleProceed = (selectedAmount) => {
 * // Use selectedAmount if coming from a tile, otherwise fallback to the state
 * const finalAmount = selectedAmount || amount;
 * * if (!finalAmount || parseFloat(finalAmount) < 100) {
 * }
 * // Trigger transaction logic...
 * };
 * * return (
 * <AmountSelector 
 * amount={amount}
 * setAmount={setAmount}
 * title="Top up Airtime"
 * onSubmit={handleProceed}
 * />
 * );
 * };
 */