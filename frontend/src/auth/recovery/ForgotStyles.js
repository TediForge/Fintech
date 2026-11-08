import { StyleSheet, Platform, StatusBar, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const BASE_WIDTH = 410; // design base width
const scale = width / BASE_WIDTH;

const scaleSize = (size) => Math.round(size * scale);

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#022c22',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : scaleSize(44),
  },
  container2: {
    height: '27%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container2a: {
    position: 'relative',
    height: '62%',
    width: '80%',
    borderRadius: scaleSize(20),
    backgroundColor: '#033c33',
    borderWidth: 1,
    borderColor: '#044d3f',
    padding: scaleSize(15),
  },
  backbuttonview: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: scaleSize(40),
    paddingHorizontal: scaleSize(12),
    borderRadius: scaleSize(20),
    backgroundColor: 'rgba(255,255,255,0.5)',
    zIndex: 10,
  },
  backicon: {
    width: scaleSize(20),
    height: scaleSize(20),
    marginRight: scaleSize(8),
    resizeMode: 'contain',
    tintColor: '#033c33',
  },
  backtext: {
    fontSize: scaleSize(16),
    color: '#033c33',
    fontWeight: '500',
  },
  headertextholder: {
    position: 'absolute',
    top: scaleSize(61),
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  smallHeaderText: {
    fontSize: scaleSize(14),
    color: '#fff',
    opacity: 0.8,
    marginBottom: scaleSize(4),
  },
  bigHeaderText: {
    fontSize: scaleSize(24),
    fontWeight: '700',
    color: '#fff',
  },
  container3: {
    height: '73%',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scaleSize(30),
    borderTopRightRadius: scaleSize(30),
    paddingHorizontal: scaleSize(20),
  },
  emailInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: scaleSize(50),
    paddingHorizontal: scaleSize(20),
    height: scaleSize(60),
  },
  iconWrapper: {
    marginRight: scaleSize(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: scaleSize(20),
    height: scaleSize(20),
  },
  emailInput: {
    flex: 1,
    fontSize: scaleSize(16),
    color: '#000',
  },
  errorText: {
    color: '#D9534F',
    fontSize: scaleSize(12),
    marginTop: scaleSize(4),
    marginLeft: scaleSize(10),
  },
 loginButtonWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 * scale : 20 * scale,
    left: 25 * scale,
    right: 25 * scale,
    flexDirection: 'column', // Stacked vertically
    alignItems: 'center',    // Center children horizontally
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  loginButton: {
    backgroundColor: '#033c33',
    paddingVertical: 18 * scale,
    borderRadius: 50 * scale,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 13 * scale, // Space between button and support text
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14.5,
    fontWeight: '600',
  },
  /** Support Text Styles **/
  supportContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginBottom: 5 * scale,
  },
  supportText: {
    fontSize: 13 * scale,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  supportEmail: {
    fontSize: 13 * scale,
    color: '#2FB86D', // Using your branding green
    fontWeight: '500',
    textDecorationLine: 'none',
  },

  // --- Main Header Container ---
  topHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13 * scale,
    width: '100%',
    height: 60 * scale,
  },

  // --- Fixed-Width Containers for Symmetry ---
  headerSideContainer: {
    width: 50 * scale, 
    height: 50 * scale,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- Branding Icon Styles ---
  brandIconSmall: {
    width: 42 * scale,
    height: 42 * scale,
    borderRadius: 12 * scale,
    backgroundColor: '#E8F5E9', // Soft Tediwave light green
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0F0DB',
    overflow: 'hidden',
  },
  logoTiny: {
    width: 42 * scale, // Matches container for "cover" effect
    height: 42 * scale,
    resizeMode: 'cover',
  },

  // --- Progress Circle Counter (Static 1/1) ---
  stepCircle: {
    width: 46 * scale,
    height: 46 * scale,
    borderRadius: 23 * scale,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#2FB86D', // Full green circle for single step
  },

  // Text within Circle
  stepText: {
    fontSize: 14 * scale,
    fontWeight: '800',
    color: '#022c22',
    textAlign: 'center',
  },
  stepTotal: {
    fontSize: 10 * scale,
    color: '#888',
    fontWeight: '400',
  },

  
  headertextPage2holder: {
    alignItems: 'left',
    marginBottom: 20 * scale,
  },
  bigPage2HeaderText: {
    fontSize: 22 * scale, 
    fontWeight: '600',
    color: '#022c22',
    marginBottom: 5 * scale,
  },
  smallPage2HeaderText: {
    fontSize: 15 * scale, 
    color: '#666',
    opacity: 0.8,
  },
});
