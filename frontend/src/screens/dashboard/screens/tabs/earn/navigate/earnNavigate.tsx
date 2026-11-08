import React from 'react';
import SpecialOffersScreen from '../screens/specialOffers/SpecialOffersScreen';
import StreakScreen from '../screens/streak/StreakScreen';

export const earnScreens = {
  SpecialOffersScreen,
  StreakScreen,
};

export const getEarnScreens = (Stack) => (
  <>
    <Stack.Screen name="SpecialOffersScreen" component={SpecialOffersScreen} />
    <Stack.Screen name="StreakScreen" component={StreakScreen} />
  </>
);

export default earnScreens;
