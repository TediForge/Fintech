import React from 'react';
import KycScreen from '../index';

export const getKycScreens = (Stack) => (
  <>
    <Stack.Screen
      name="kycScreen"
      component={KycScreen}
      options={{ headerShown: false }}
    />
  </>
);
