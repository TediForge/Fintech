import React from 'react';
import { View, Text, StyleSheet, Image, ImageBackground } from 'react-native';

const normalizeCardNumber = (number = "") => number.replace(/\D/g, '');

const formatCardNumber = (number = "") => {
  const digits = normalizeCardNumber(number);
  if (!digits) return '';
  return digits.match(/.{1,4}/g)?.join(' ') ?? digits;
};

const maskCardNumber = (number = "") => {
  const digits = normalizeCardNumber(number);
  if (!digits) return '';
  if (digits.length <= 8) {
    return digits.replace(/\d/g, '•').match(/.{1,4}/g)?.join(' ') ?? digits.replace(/\d/g, '•');
  }

  const firstSix = digits.slice(0, 6);
  const lastFour = digits.slice(-4);
  const middle = digits.slice(6, -4).replace(/\d/g, '•');
  const masked = `${firstSix}${middle}${lastFour}`;
  return masked.match(/.{1,4}/g)?.join(' ') ?? masked;
};

const ATMCard = ({ 
  mode = 'secure',
  cardHolder = "USER NAME", 
  cardNumber = "0000 0000 0000 0000", 
  expiryDate = "12/29", 
  cvv = '',
  cardType = "visa", 
  backgroundColor = "#1a1a1a",
  imageUrl = '',
}) => {
  const logos = {
    visa: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png",
    mastercard: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png"
  };

  const displayNumber = mode === 'full'
    ? formatCardNumber(cardNumber)
    : mode === 'secure'
      ? maskCardNumber(cardNumber)
      : '';

  const showDetails = mode !== 'preview';
  const showFooter = mode !== 'preview';
  const showCVV = mode === 'full' && cvv;

  const containerStyles = [styles.cardContainer, { backgroundColor }];
  const cardContent = (
    <> 
      {mode !== 'preview' && <View style={styles.chip} />}

      <View style={styles.logoContainer}>
        <Image 
          source={{ uri: logos[cardType] || logos.visa }} 
          style={styles.cardLogo} 
          resizeMode="contain"
        />
      </View>

      {showDetails && (
        <View style={styles.numberContainer}>
          <Text style={styles.cardNumberText}>{displayNumber}</Text>
        </View>
      )}

      {showDetails && (
        <View style={styles.bottomRow}>
          <View style={styles.detailsColumn}>
            <Text style={styles.label}>CARD HOLDER</Text>
            <Text style={styles.valueText}>{cardHolder.toUpperCase()}</Text>
          </View>

          <View style={styles.detailsColumn}>
            <Text style={styles.label}>EXPIRES</Text>
            <Text style={styles.valueText}>{expiryDate}</Text>
          </View>

          {showCVV && (
            <View style={styles.detailsColumn}>
              <Text style={styles.label}>CVV</Text>
              <Text style={styles.valueText}>{cvv}</Text>
            </View>
          )}
        </View>
      )}

      {showFooter && (
        <View style={styles.footer}>
          <Text style={styles.nllText}>Protected by NLL®</Text>
        </View>
      )}
    </>
  );

  return imageUrl && mode === 'preview' ? (
    <ImageBackground source={{ uri: imageUrl }} style={containerStyles} imageStyle={styles.imageBackground}>
      {cardContent}
    </ImageBackground>
  ) : (
    <View style={containerStyles}>
      {cardContent}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    aspectRatio: 1.586, // ISO/IEC 7810 standard
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    position: 'relative', // Necessary for absolute ratio positioning
  },
  chip: {
    position: 'absolute',
    left: '18%', // Start x
    top: '33%',  // Start y
    width: '10%', // 0.28 - 0.18
    height: '19%', // 0.52 - 0.33
    backgroundColor: '#d4af37',
    borderRadius: 4,
    zIndex: 2,
  },
  logoContainer: {
    position: 'absolute',
    top: '10%',
    right: '8%',
    width: '18%',
    height: '15%',
  },
  cardLogo: {
    width: '100%',
    height: '100%',
  },
  numberContainer: {
    position: 'absolute',
    top: '58%', // Positioned centrally following industry standard
    left: '8%',
    width: '84%',
  },
  cardNumberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: 'Courier', 
  },
  bottomRow: {
    position: 'absolute',
    bottom: '12%',
    left: '8%',
    flexDirection: 'row',
    gap: 25,
  },
  detailsColumn: {
    flexDirection: 'column',
  },
  label: {
    color: '#aaa',
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 2,
  },
  valueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: '5%',
    right: '8%',
  },
  nllText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '500',
  },
  imageBackground: {
    resizeMode: 'cover',
  },
});

export default ATMCard;