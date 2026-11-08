import React from 'react';
import UserProfile from '..';
import EditEmailAddressScreen from '../screens/editEmailAddress';
import EditPhoneNumberScreen from '../screens/editPhonenumber';

export const getProfileScreens = (Stack) => (
  <>
    <Stack.Screen name="UserProfile" component={UserProfile} />
    <Stack.Screen name="EditEmailAddress" component={EditEmailAddressScreen} />
    <Stack.Screen name="EditPhoneNumber" component={EditPhoneNumberScreen} />
  </>
);
