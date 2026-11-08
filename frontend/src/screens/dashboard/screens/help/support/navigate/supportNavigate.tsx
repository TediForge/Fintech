import React from 'react';
import CustomerService from '../';
import ChatRoom from '../screens/chat/';
import FindUsScreen from '../screens/findUs/';

export const getSupportScreens = (Stack) => (
  <>
    <Stack.Screen name="CustomerService" component={CustomerService} />
    <Stack.Screen name="ChatRoom" component={ChatRoom} />
    <Stack.Screen name="FindUsScreen" component={FindUsScreen} />
  </>
);

export default getSupportScreens;
