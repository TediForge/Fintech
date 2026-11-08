import React from 'react';
import PinManagementScreen from '../screens/pinManagement';
import PasswordManagementScreen from '../screens/passwordManagement';
import LanguageScreen from '../screens/language/LanguageScreen';

export const settingsScreens = {
  'reset-pin': PinManagementScreen,
  'change-passcode': PasswordManagementScreen,
  'password-management': PasswordManagementScreen,
  'language-settings': LanguageScreen,
};

export const getSettingsScreens = (Stack) => (
  <>
    <Stack.Screen name="reset-pin" component={PinManagementScreen} />
    <Stack.Screen name="change-passcode" component={PasswordManagementScreen} />
    <Stack.Screen name="password-management" component={PasswordManagementScreen} />
    <Stack.Screen name="language-settings" component={LanguageScreen} />
  </>
);

export default settingsScreens;
