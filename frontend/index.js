import { registerRootComponent } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';

import App from './App';

// Register the App component as the root, wrapped with GestureHandlerRootView
// This is required for PanGesture / Gesture.Pan to function correctly
registerRootComponent(() => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <App />
  </GestureHandlerRootView>
));