import React from 'react';
import SpendSaveScreen from '../screens/spend&save';

export const getFinanceScreens = (Stack) => (
  <Stack.Screen
    name="SpendSaveScreen"
    component={SpendSaveScreen}
    options={{ headerShown: false }}
  />
);
