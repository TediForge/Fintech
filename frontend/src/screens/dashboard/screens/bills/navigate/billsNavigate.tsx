import React from 'react';
import BillsScreen from '..';
import AirtimeScreen from '../screens/airtime';
import DataScreen from '../screens/data';
import CableTvScreen from '../screens/cable';
import BettingScreen from '../screens/betting';
import EducationScreen from '../screens/education';
import ElectricityScreen from '../screens/electricity';
import ScheduledBills from '../screens/schedule';

export const getBillsScreens = (Stack) => (
  <>
    <Stack.Screen name="Bills" component={BillsScreen} />
    <Stack.Screen name="DataScreen" component={DataScreen} />
    <Stack.Screen name="AirtimeScreen" component={AirtimeScreen} />
    <Stack.Screen name="ElectricityScreen" component={ElectricityScreen} />
    <Stack.Screen name="CableTvScreen" component={CableTvScreen} />
    <Stack.Screen name="EducationScreen" component={EducationScreen} />
    <Stack.Screen name="BettingScreen" component={BettingScreen} />
    <Stack.Screen name="ScheduledBills" component={ScheduledBills} />
  </>
);

export default getBillsScreens;