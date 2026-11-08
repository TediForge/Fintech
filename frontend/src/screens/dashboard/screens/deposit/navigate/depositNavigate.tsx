import React from 'react';
import OnlineDepositScreen from '../screens/onlineDeposit';
import CashDepositScreen from '../screens/cashDeposit';

export const getDepositScreens = (Stack) => (
  <>
    <Stack.Screen name="OnlineDepositScreen" component={OnlineDepositScreen} />
    <Stack.Screen name="CashDepositScreen" component={CashDepositScreen} />
  </>
);

export default getDepositScreens;
