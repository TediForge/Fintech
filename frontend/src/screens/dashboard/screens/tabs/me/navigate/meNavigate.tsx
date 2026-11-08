import React from 'react';
import NewsUpdatesScreen from '../screens/newsUpdates/NewsUpdatesScreen';

export const getMeScreens = (Stack) => (
  <>
    <Stack.Screen name="NewsUpdatesScreen" component={NewsUpdatesScreen} />
  </>
);
