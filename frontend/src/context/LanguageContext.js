import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const storageKey = 'app-language';
const defaultLanguage = 'en';

const LanguageContext = createContext({
  language: defaultLanguage,
  setLanguage: async () => {},
  changeLanguage: async () => {},
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(defaultLanguage);

  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(storageKey);
        if (savedLanguage) setLanguageState(savedLanguage);
      } catch (error) {
        console.warn('LanguageProvider: failed to load saved language', error);
      }
    };
    loadSavedLanguage();
  }, []);

  const setLanguage = useCallback(async (nextLanguage) => {
    const normalizedLanguage = nextLanguage || defaultLanguage;
    setLanguageState(normalizedLanguage);
    try {
      await AsyncStorage.setItem(storageKey, normalizedLanguage);
    } catch (error) {
      console.warn('LanguageProvider: failed to persist language', error);
    }
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage,
    changeLanguage: setLanguage,
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};

export const getStoredLanguage = async () => {
  try {
    return (await AsyncStorage.getItem(storageKey)) || defaultLanguage;
  } catch (error) {
    console.warn('LanguageProvider: failed to read stored language', error);
    return defaultLanguage;
  }
};

export default LanguageContext;