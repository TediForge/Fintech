import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  StatusBar, 
  Image,
  TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import useApiClient from '@hooks/apiClient';
import ScreenHeader from '@components/headers/ScreenHeader';

import config from '@config/app';
import { brandConfig } from '@config/brand';
const BRAND_COLOR = '#0E3C2E';

const PayAMerchant = ({ navigation }) => {
  const { user } = useApiClient();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {/* Sample Gradient Background */}
      <LinearGradient colors={['#eff7f4', '#f5f8f7']} style={StyleSheet.absoluteFillObject} />
      
      <ScreenHeader
        title="Pay A Merchant"
        backgroundColor="#eff7f4"
        textColor="#000"
        iconColor="#000"
        rightComponent={
          <TouchableOpacity 
            onPress={() => navigation.navigate('Settings', { page: 'account' })}
            style={{ padding: 5 }}
          >
            <Image 
                          source={{ uri: 'https://cdn-icons-png.flaticon.com/128/3917/3917762.png' }} 
                          style={{ width: 18, height: 18 }} 
                        />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {/* Merchant ID Input Card - Styled like Amount Card */}
        <View style={styles.inputCard}>
          <Text style={styles.label}>Merchant ID / Username</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="business" size={24} color={BRAND_COLOR} style={{ marginRight: 10 }} />
            <TextInput 
              style={styles.input} 
              placeholder="E.g. PS-12345"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Scan Option */}
        <TouchableOpacity style={styles.scanBtn}>
          <Ionicons name="qr-code-outline" size={22} color="#FFF" style={{ marginRight: 10 }} />
          <Text style={styles.scanText}>Scan Merchant QR</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Payments to verified merchants are processed instantly and secured by {brandConfig.brandName}.
          </Text>
        </View>
      </View>
    </View>
  );
};

export default PayAMerchant;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { 
    flex: 1, 
    paddingHorizontal: 20, 
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 70 : 110 
  },
  inputCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  label: { fontSize: 13, color: '#666', fontWeight: '600', marginBottom: 12 },
  inputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8
  },
  input: { 
    flex: 1, 
    fontSize: 18, 
    fontWeight: '700', 
    color: BRAND_COLOR, 
    padding: 0 
  },
  scanBtn: { 
    backgroundColor: '#1A1A1A', 
    flexDirection: 'row', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  scanText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  infoBox: {
    flexDirection: 'row',
    marginTop: 25,
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'flex-start'
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 10,
    lineHeight: 18
  }
});