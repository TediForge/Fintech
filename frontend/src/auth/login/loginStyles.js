// Copyright (c) 2026 Tediwave, all rights reserved, subject to the proprietary license located in the root directory
import { StyleSheet, Platform, StatusBar, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const baseWidth = 410; 
const scale = screenWidth / baseWidth;

const scaleSize = (size) => Math.round(size * scale);

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#022c22',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight * scale : 44 * scale,
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
  container2a1: {
    position: 'absolute',
    bottom: scaleSize(15),
    height: scaleSize(45),
    width: '90%',
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
    flexDirection: 'row',
  },
  container2a2: {
    position: 'absolute',
    top: '13%',
    height: scaleSize(54), // Fixed height to match components
    width: '88%',
    paddingHorizontal: scaleSize(12),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Forces left and right with gap
  },
  container2a3: {
    flex: 1,
    justifyContent: 'center',
  },
  container2a12: {
    height: '100%',
    width: '50%',
    borderRadius: 50 * scale,
    backgroundColor: '#FFFFFF',
    opacity: 0.95,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container2a13: {
    height: '100%',
    width: '50%',
    borderRadius: 50 * scale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageStyle: {
    width: '100%',
    height: '100%',
    borderRadius: 999 * scale,
  },
  greetingText: {
    fontSize: 12 * scale, // Reduced font size for better fit
    fontWeight: '500',
    color: '#f2f2f2',
    opacity: 0.8,
  },
  greetingText2: {
    fontSize: 17, // Reduced font size for better fit
    fontWeight: '700',
    color: '#f2f2f2',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  pictureWrapper: {
    height: scaleSize(54), // Height matches text container
    width: scaleSize(54),
    borderRadius: scaleSize(27),
    backgroundColor: '#111',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  container3: {
    height: '73%',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30 * scale,
    borderTopRightRadius: 30 * scale,
    opacity: 1,
    paddingHorizontal: 20 * scale,
  },
  phoneSection: {
    flex: 1,
    paddingTop: 35 * scale,
  },
  phoneHeader: {
    marginBottom: 30 * scale,
  },
  phoneHeadingText: {
    fontSize: 22 * scale,
    fontWeight: '700',
    color: '#091747',
    marginBottom: 6 * scale,
    textAlign: 'center',
  },
  phoneSubHeadingText: {
    fontSize: 14 * scale,
    color: '#888',
    lineHeight: 20 * scale,
    textAlign: 'center',
  },

  // UPDATED: Country and Phone in same row but SEPARATE bordered inputs with gap
  countryPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f2f2f2',
    borderRadius: 15,
    paddingHorizontal: 16 * scale,
    height: 60 * scale,
  },
  phoneInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f2f2f2',
    borderRadius: 15, 
    paddingHorizontal: 20 * scale,
    height: 60 * scale,
  },
  flagWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10 * scale,
  },
  flag: {
    width: 24 * scale,
    height: 16 * scale,
    marginRight: 6 * scale,
    borderRadius: 2 * scale,
  },
    flag2: {
    width: 24 * scale,
    height: 16 * scale,
    borderRadius: 2 * scale,
  },
  prefix: {
    fontSize: 16 * scale,
    color: '#333',
  },
  chevron: {
    marginLeft: 6 * scale,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16 * scale,
    color: '#000',
  },
  errorText: {
    color: '#D9534F',
    fontSize: 12 * scale,
    marginTop: 4 * scale,
  },
  loginButtonWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 * scale : 40 * scale,
    left: 28 * scale,
    right: 28 * scale,
  },
  loginButton: {
    backgroundColor: '#033c33',
    paddingVertical: 20 * scale,
    borderRadius: 50 * scale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14.5 * scale,
    fontWeight: '600',
  },
  buttonText2: {
    color: '#FFFFFF',
    fontSize: 14.5 * scale,
    fontWeight: '600',
    opacity: 0.8,
  },
  buttonText1: {
    color: '#022c22',
    fontSize: 14.5 * scale,
    fontWeight: '600',
  },
  page2Wrapper: {
    flex: 1,
    paddingTop: 40 * scale,
  },
  pinArea: {
    alignItems: 'center',
    marginBottom: 40 * scale,
  },
  pinInstruction: {
    fontSize: 16 * scale,
    color: '#888',
    marginBottom: 20 * scale,
    fontWeight: '500',
  },
  pinDotsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15 * scale,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA', 
  },
  pinDotActive: {
    backgroundColor: '#0E3C2E',
    borderColor: '#0E3C2E',
  },
  keypadArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 * scale : 20 * scale,
  },
  keypad: {
    width: '90%',
    alignSelf: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15 * scale,
  },
  key: {
    width: 72 * scale,
    height: 72 * scale,
    borderRadius: 36 * scale,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
  },
  keySpecial: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    fontSize: 26 * scale,
    color: '#091747',
    fontWeight: '500',
  },
  footerLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20 * scale,
    gap: 15 * scale,
  },
  footerLinkText: {
    color: '#0E3C2E',
    fontSize: 14 * scale,
    fontWeight: '600',
  },
  footerSeparator: {
    width: 1,
    height: 14 * scale,
    backgroundColor: '#DDD',
  },
  moreOptionsText2: {
    color: '#091747',
    fontSize: 14 * scale,
    fontWeight: '600',
    textAlign: 'center',
  },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  sheetContainer: {
    paddingTop: 10 * scale,
    paddingBottom: Platform.OS === 'ios' ? 40 * scale : 40 * scale,
    borderTopLeftRadius: 24 * scale,
    borderTopRightRadius: 24 * scale,
    backgroundColor: '#f5f8f7',
    width: '100%',
  },
  dragLine: {
    width: 40 * scale,
    height: 4 * scale,
    backgroundColor: '#E0E0E0',
    borderRadius: 2 * scale,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  content: {
    paddingHorizontal: 20 * scale,
  },
  sheetHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 22,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
  },
  sheetOptionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14 * scale,
    backgroundColor: '#FFFFFF',
    borderRadius: 14 * scale,
    marginBottom: 10 * scale,
    borderWidth: 0.1,
    borderColor: 'rgba(204, 204, 204, 0.80)',
    shadowColor: 'rgba(204, 204, 204, 0.80)',
    shadowOffset: { width: 0, height: 0.1 },
    shadowOpacity: 0.2,
    shadowRadius: 0.1,
    elevation: 0.1,
  },
  iconsContainer: {
    width: 40 * scale,
    height: 40 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14 * scale,
    backgroundColor: '#F7F9F8',
    borderRadius: 10 * scale,
  },
  optionTextWrapper: {
    flex: 1,
  },
  optionTitle: {
    fontWeight: '600',
    fontSize: 13,
    color: '#111',
  },
  optionDescription: {
    fontSize: 10,
    color: '#888',
    marginTop: 1 * scale,
  },
});